// ─────────────────────────────────────────────────────────────────
// Zoho CRM client for Reverb.
//
// Zoho has a data-center concept — every user is provisioned in one
// of six regions (US/EU/IN/AU/JP/CN) and the API endpoints differ
// per region. The OAuth flow returns an `accounts-server` and a
// `location` query param that tell us which DC to talk to. We store
// the region string ("us", "eu", "in", "au", "jp", "cn") in the
// crm_connections.portal_id column (piggybacking on that existing
// field so no schema migration is required for the new provider).
//
// Auth flow specifics:
//   • Authorize URL: https://accounts.zoho.com/oauth/v2/auth
//     (Zoho 302-redirects to the user's actual region if different)
//   • Token URL: https://accounts.zoho.{region}/oauth/v2/token
//   • API base: https://www.zohoapis.{region}/crm/v6
//   • Auth header on API calls: `Authorization: Zoho-oauthtoken <token>`
//     (NOT `Bearer <token>` — this is a Zoho quirk)
//   • Access tokens live 1 hour; refresh tokens are long-lived.
//
// Shape parity with hubspot.ts: same CrmContactContext / CrmContactList
// interfaces, so /api/chat can inject Zoho results the same way it
// injects HubSpot results — no per-provider branching in the chat route.
// ─────────────────────────────────────────────────────────────────

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import { encryptToken, decryptToken } from "./tokens";
import type {
  CrmContactContext,
  CrmContactList,
  CrmContactSummary,
  CrmEngagement,
  CrmDealStageChange,
} from "./hubspot";

// ─── Region routing ─────────────────────────────────────────────────
export type ZohoRegion = "us" | "eu" | "in" | "au" | "jp" | "cn";
const DEFAULT_REGION: ZohoRegion = "us";

// TLD suffix per region — accounts.zoho.{suffix} / www.zohoapis.{suffix}
const REGION_TLD: Record<ZohoRegion, string> = {
  us: "com",
  eu: "eu",
  in: "in",
  au: "com.au",
  jp: "jp",
  cn: "com.cn",
};

function tld(region: ZohoRegion): string {
  return REGION_TLD[region] ?? REGION_TLD[DEFAULT_REGION];
}

/** Parse the `accounts-server` param Zoho appends to the OAuth callback. */
export function regionFromAccountsServer(url: string | null): ZohoRegion {
  if (!url) return DEFAULT_REGION;
  const lower = url.toLowerCase();
  if (lower.includes(".eu")) return "eu";
  if (lower.includes(".in")) return "in";
  if (lower.includes(".com.au")) return "au";
  if (lower.includes(".jp")) return "jp";
  if (lower.includes(".com.cn")) return "cn";
  return "us";
}

// Scopes required by Reverb's read-only CRM grounding.
// See https://www.zoho.com/crm/developer/docs/api/v6/scopes.html
export const ZOHO_SCOPES = [
  "ZohoCRM.modules.contacts.READ",
  "ZohoCRM.modules.accounts.READ",
  "ZohoCRM.modules.deals.READ",
  "ZohoCRM.modules.activities.READ",
  "ZohoCRM.modules.notes.READ",
  "ZohoCRM.users.READ",
  "ZohoCRM.org.READ",
];

export interface ZohoConnection {
  id: string;
  user_id: string;
  provider: "zoho";
  region: ZohoRegion;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  scopes: string[];
}

// ─── OAuth URL builders ─────────────────────────────────────────────

export function buildAuthorizeUrl(state: string, codeChallenge?: string): string {
  const clientId = process.env.ZOHO_CLIENT_ID;
  const redirectUri = process.env.ZOHO_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    throw new Error("ZOHO_CLIENT_ID / ZOHO_REDIRECT_URI env vars missing");
  }
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: ZOHO_SCOPES.join(","),
    redirect_uri: redirectUri,
    access_type: "offline",   // required to get a refresh_token
    prompt: "consent",        // force consent so refresh_token is re-issued on re-auth
    state,
  });
  if (codeChallenge) {
    params.set("code_challenge", codeChallenge);
    params.set("code_challenge_method", "S256");
  }
  // Always start at the .com accounts server — Zoho will 302 to the
  // user's actual data center during login if they're on a different DC.
  return `https://accounts.zoho.com/oauth/v2/auth?${params.toString()}`;
}

interface ZohoTokenResponse {
  access_token: string;
  refresh_token?: string;   // only on the initial exchange, not on refresh
  expires_in: number;       // seconds
  api_domain?: string;      // "https://www.zohoapis.com" — confirms region
  token_type: string;
}

async function exchangeCode(
  code: string,
  region: ZohoRegion,
  codeVerifier?: string
): Promise<ZohoTokenResponse> {
  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  const redirectUri = process.env.ZOHO_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Zoho OAuth env vars missing");
  }
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
  });
  if (codeVerifier) body.set("code_verifier", codeVerifier);
  const url = `https://accounts.zoho.${tld(region)}/oauth/v2/token`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Zoho token exchange failed: ${res.status} ${text.slice(0, 200)}`);
  }
  return (await res.json()) as ZohoTokenResponse;
}

async function refreshTokens(
  refreshToken: string,
  region: ZohoRegion
): Promise<ZohoTokenResponse> {
  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Zoho client creds missing");
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });
  const url = `https://accounts.zoho.${tld(region)}/oauth/v2/token`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Zoho token refresh failed: ${res.status} ${text.slice(0, 200)}`);
  }
  return (await res.json()) as ZohoTokenResponse;
}

/** Called by /api/auth/zoho/callback after the user grants access. */
export async function persistNewConnection(
  service: SupabaseClient,
  userId: string,
  code: string,
  region: ZohoRegion,
  codeVerifier?: string
): Promise<void> {
  const tokens = await exchangeCode(code, region, codeVerifier);
  if (!tokens.refresh_token) {
    // Zoho only returns refresh_token when prompt=consent AND user grants
    // fresh — if the app was already authorized, they won't get one. We
    // force prompt=consent above but log defensively.
    throw new Error("Zoho did not return a refresh_token (already authorized without consent prompt?)");
  }
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  const { error } = await service
    .from("crm_connections")
    .upsert(
      {
        user_id: userId,
        provider: "zoho",
        portal_id: region,   // region stashed here — see file-header comment
        access_token: encryptToken(tokens.access_token),
        refresh_token: encryptToken(tokens.refresh_token),
        expires_at: expiresAt,
        scopes: ZOHO_SCOPES,
        connected_at: new Date().toISOString(),
      },
      { onConflict: "user_id,provider" }
    );
  if (error) throw new Error(`Failed to persist connection: ${error.message}`);
}

/**
 * Get the user's Zoho connection with the access token guaranteed fresh
 * for the next ~1 hour. Refreshes preemptively if the token expires
 * within 60 seconds. Returns null if no connection exists.
 */
export async function getFreshConnection(
  service: SupabaseClient,
  userId: string
): Promise<ZohoConnection | null> {
  const { data: row } = await service
    .from("crm_connections")
    .select("id, user_id, provider, portal_id, access_token, refresh_token, expires_at, scopes")
    .eq("user_id", userId)
    .eq("provider", "zoho")
    .maybeSingle();
  if (!row) return null;

  const region = ((row.portal_id as string | null) ?? DEFAULT_REGION) as ZohoRegion;
  let accessToken: string;
  let refreshToken: string;
  try {
    accessToken = decryptToken(row.access_token as string);
    refreshToken = decryptToken(row.refresh_token as string);
  } catch (e) {
    console.error("[zoho] token decrypt failed:", e);
    return null;
  }

  const expiresMs = new Date(row.expires_at as string).getTime();
  const soonMs = Date.now() + 60_000;
  if (expiresMs <= soonMs) {
    try {
      const fresh = await refreshTokens(refreshToken, region);
      accessToken = fresh.access_token;
      // Zoho typically doesn't return a new refresh_token on refresh — keep the old one.
      if (fresh.refresh_token) refreshToken = fresh.refresh_token;
      const newExpiresAt = new Date(Date.now() + fresh.expires_in * 1000).toISOString();
      await service
        .from("crm_connections")
        .update({
          access_token: encryptToken(accessToken),
          refresh_token: encryptToken(refreshToken),
          expires_at: newExpiresAt,
          last_refreshed_at: new Date().toISOString(),
        })
        .eq("id", row.id as string);
      return {
        id: row.id as string,
        user_id: row.user_id as string,
        provider: "zoho",
        region,
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: newExpiresAt,
        scopes: (row.scopes as string[] | null) ?? [],
      };
    } catch (e) {
      console.error("[zoho] refresh failed:", e);
      return null;
    }
  }

  return {
    id: row.id as string,
    user_id: row.user_id as string,
    provider: "zoho",
    region,
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: row.expires_at as string,
    scopes: (row.scopes as string[] | null) ?? [],
  };
}

// ─── API helpers ────────────────────────────────────────────────────

function apiBase(region: ZohoRegion): string {
  return `https://www.zohoapis.${tld(region)}/crm/v6`;
}

async function zohoGet<T>(
  connection: ZohoConnection,
  path: string,
  query?: Record<string, string>
): Promise<T | null> {
  const url = new URL(apiBase(connection.region) + path);
  if (query) {
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Zoho-oauthtoken ${connection.access_token}` },
  });
  if (res.status === 204 || res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`[zoho] GET ${path} ${res.status}: ${text.slice(0, 200)}`);
    return null;
  }
  return (await res.json()) as T;
}

// ─── Zoho record shapes ─────────────────────────────────────────────

interface ZohoContact {
  id: string;
  Email?: string | null;
  First_Name?: string | null;
  Last_Name?: string | null;
  Full_Name?: string | null;
  Title?: string | null;
  Account_Name?: { name: string; id: string } | string | null;
  Lead_Source?: string | null;
  Lead_Status?: string | null;
  Modified_Time?: string | null;
  Created_Time?: string | null;
  Last_Activity_Time?: string | null;
}
interface ContactsResponse {
  data?: ZohoContact[];
  info?: { count?: number; more_records?: boolean; per_page?: number; page?: number };
}
interface ZohoAccount {
  id: string;
  Account_Name?: string | null;
  Website?: string | null;
  Industry?: string | null;
  Employees?: number | null;
}
interface ZohoDeal {
  id: string;
  Deal_Name?: string | null;
  Stage?: string | null;
  Amount?: number | null;
  Closing_Date?: string | null;
  Contact_Name?: { id: string } | null;
  Created_Time?: string | null;
  Modified_Time?: string | null;
}

function accountName(a: ZohoContact["Account_Name"]): string | null {
  if (!a) return null;
  if (typeof a === "string") return a;
  return a.name ?? null;
}

// ─── Contact lookup by email ────────────────────────────────────────

/**
 * Look up a Zoho contact by email. Returns null if not found.
 * Enriches with associated Account, latest Deal (via Contact_Name filter
 * on Deals), and recent engagements (notes only for MVP — Activities
 * module in Zoho covers tasks/events/calls separately and has different
 * shapes; leaving that for the next depth pass).
 */
export async function lookupContactByEmail(
  connection: ZohoConnection,
  email: string
): Promise<CrmContactContext | null> {
  // Zoho search by email:
  //   GET /Contacts/search?email={email}
  const searchRes = await zohoGet<ContactsResponse>(
    connection,
    "/Contacts/search",
    { email: email.toLowerCase().trim() }
  );
  if (!searchRes || !searchRes.data || searchRes.data.length === 0) return null;
  const contact = searchRes.data[0];

  // Parallel: fetch account details + associated deals + notes
  const accountObj = contact.Account_Name && typeof contact.Account_Name === "object"
    ? contact.Account_Name
    : null;
  const accountId = accountObj?.id ?? null;

  const [accountRes, dealsRes, notes] = await Promise.all([
    accountId
      ? zohoGet<{ data?: ZohoAccount[] }>(
          connection,
          `/Accounts/${accountId}`
        )
      : Promise.resolve(null),
    // Deals related to this contact
    zohoGet<{ data?: ZohoDeal[] }>(
      connection,
      `/Contacts/${contact.id}/Deals`
    ),
    // Notes related to this contact
    zohoGet<{ data?: Array<{ id: string; Note_Content?: string; Modified_Time?: string; Created_Time?: string }> }>(
      connection,
      `/Contacts/${contact.id}/Notes`
    ),
  ]);

  const account = accountRes?.data?.[0] ?? null;
  const deals = dealsRes?.data ?? [];
  // Pick the most-recently-modified deal as "latest".
  deals.sort((a, b) => {
    const ta = a.Modified_Time ? Date.parse(a.Modified_Time) : 0;
    const tb = b.Modified_Time ? Date.parse(b.Modified_Time) : 0;
    return tb - ta;
  });
  const latestDeal = deals[0] ?? null;

  // Engagements: from Notes only for MVP. Trim body coarsely.
  const trim = (s: string | null | undefined, n: number): string | null => {
    if (!s) return null;
    const stripped = s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!stripped) return null;
    return stripped.length > n ? stripped.slice(0, n) + "…" : stripped;
  };
  const engagements: CrmEngagement[] = (notes?.data ?? [])
    .slice(0, 10)
    .map((n): CrmEngagement => ({
      kind: "note",
      timestamp: n.Modified_Time ?? n.Created_Time ?? null,
      subject: null,
      direction: null,
      summary: trim(n.Note_Content, 200),
    }))
    .sort((a, b) => {
      const ta = a.timestamp ? Date.parse(a.timestamp) : 0;
      const tb = b.timestamp ? Date.parse(b.timestamp) : 0;
      return tb - ta;
    });

  const first = contact.First_Name ?? null;
  const last = contact.Last_Name ?? null;
  const full = contact.Full_Name ?? [first, last].filter(Boolean).join(" ") ?? null;

  // Deal-stage history isn't easily available via the standard read API
  // (would need audit-log access). Leave empty.
  const dealStageHistory: CrmDealStageChange[] = [];

  return {
    contact_id: contact.id,
    email: contact.Email ?? email,
    first_name: first,
    last_name: last,
    full_name: full || null,
    job_title: contact.Title ?? null,
    lifecycle_stage: contact.Lead_Status ?? null,   // Zoho uses Lead_Status; no separate lifecycle
    lead_status: contact.Lead_Status ?? null,
    original_source: contact.Lead_Source ?? null,
    source_drill_1: null,
    source_drill_2: null,
    first_url: null,
    created_at: contact.Created_Time ?? null,
    last_activity_at: contact.Last_Activity_Time ?? contact.Modified_Time ?? null,
    company_name: accountName(contact.Account_Name) ?? account?.Account_Name ?? null,
    company_domain: account?.Website ?? null,
    company_industry: account?.Industry ?? null,
    company_size: account?.Employees != null ? String(account.Employees) : null,
    latest_deal_name: latestDeal?.Deal_Name ?? null,
    latest_deal_stage: latestDeal?.Stage ?? null,
    latest_deal_amount: latestDeal?.Amount != null ? String(latestDeal.Amount) : null,
    latest_deal_close_date: latestDeal?.Closing_Date ?? null,
    latest_deal_stage_history: dealStageHistory,
    recent_engagements: engagements,
    marketing_last_open_at: null,
    marketing_last_click_at: null,
    marketing_last_email_name: null,
    portal_id: connection.region,
    hubspot_url: `https://crm.zoho.${tld(connection.region)}/crm/EntityInfo.do?module=Contacts&id=${contact.id}`,
  };
}

// ─── Contact list ───────────────────────────────────────────────────

export async function listRecentContacts(
  connection: ZohoConnection,
  limit = 20
): Promise<CrmContactList> {
  // GET /Contacts?fields=...&sort_by=Modified_Time&sort_order=desc&per_page=20
  const res = await zohoGet<ContactsResponse>(connection, "/Contacts", {
    fields: "Email,First_Name,Last_Name,Full_Name,Title,Account_Name,Lead_Source,Lead_Status,Modified_Time,Last_Activity_Time,Created_Time",
    sort_by: "Modified_Time",
    sort_order: "desc",
    per_page: String(Math.min(limit, 100)),
  });
  if (!res || !res.data) return { contacts: [], total: 0, returned: 0 };

  const contacts: CrmContactSummary[] = res.data.map((c) => {
    const first = c.First_Name ?? null;
    const last = c.Last_Name ?? null;
    const full = c.Full_Name ?? [first, last].filter(Boolean).join(" ") ?? null;
    return {
      contact_id: c.id,
      email: c.Email ?? null,
      first_name: first,
      last_name: last,
      full_name: full || null,
      job_title: c.Title ?? null,
      company: accountName(c.Account_Name),
      lifecycle_stage: c.Lead_Status ?? null,
      lead_status: c.Lead_Status ?? null,
      last_activity_at: c.Last_Activity_Time ?? c.Modified_Time ?? null,
      created_at: c.Created_Time ?? null,
    };
  });

  // Zoho's info block gives us the total via a separate /Contacts?per_page=1&fields=id call
  // if we care; for MVP we set total = returned (no separate count call).
  return { contacts, total: contacts.length, returned: contacts.length };
}

// ─── Public wrappers matching hubspot's shape ───────────────────────

export async function getZohoContext(
  userId: string,
  email: string
): Promise<CrmContactContext | null> {
  const service = getSupabase();
  if (!service) return null;
  const conn = await getFreshConnection(service, userId);
  if (!conn) return null;
  return lookupContactByEmail(conn, email);
}

export async function getZohoContactList(
  userId: string,
  limit = 20
): Promise<CrmContactList | null> {
  const service = getSupabase();
  if (!service) return null;
  const conn = await getFreshConnection(service, userId);
  if (!conn) return null;
  return listRecentContacts(conn, limit);
}

export async function getZohoContactJourneys(
  userId: string,
  limit = 3
): Promise<CrmContactContext[] | null> {
  const service = getSupabase();
  if (!service) return null;
  const conn = await getFreshConnection(service, userId);
  if (!conn) return null;

  const summary = await listRecentContacts(conn, limit);
  if (summary.contacts.length === 0) return [];

  const enrichments = await Promise.all(
    summary.contacts
      .map((c) => c.email)
      .filter((e): e is string => Boolean(e))
      .map(async (email) => {
        try {
          return await lookupContactByEmail(conn, email);
        } catch (err) {
          console.error("[zoho] enrichment failed for", email, err);
          return null;
        }
      })
  );
  return enrichments.filter((c): c is CrmContactContext => c !== null);
}
