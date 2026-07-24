// ─────────────────────────────────────────────────────────────────
// HubSpot CRM client for Reverb.
//
// Handles:
//   • OAuth code → token exchange
//   • Token refresh (HubSpot access tokens live 30 minutes, refresh
//     tokens live 6 months rolling)
//   • Contact lookup by email + auto-fetch of associated company +
//     latest deal so the model gets a full CRM snapshot per contact
//
// Wire path for MVP contact grounding:
//   User prompt "write a nurture for alice@acme.com"
//     → chat route extracts the email
//     → getHubspotContext(userId, "alice@acme.com")
//     → returns { name, company, deal_stage, ... }
//     → injected as a system message before the model call
// ─────────────────────────────────────────────────────────────────

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import { encryptToken, decryptToken } from "./tokens";

const HUBSPOT_AUTH_URL = "https://app.hubspot.com/oauth/authorize";
const HUBSPOT_TOKEN_URL = "https://api.hubapi.com/oauth/v1/token";
const HUBSPOT_API_BASE = "https://api.hubapi.com";

// Scopes required by Reverb's read-only contact-context lookups.
// crm.objects.contacts.read       — resolve name + email + basic props
// crm.objects.companies.read      — associated company (name, domain, industry, size)
// crm.objects.deals.read          — latest deal (stage, amount, close date)
// oauth                           — required baseline
export const HUBSPOT_SCOPES = [
  "oauth",
  "crm.objects.contacts.read",
  "crm.objects.companies.read",
  "crm.objects.deals.read",
];

export interface HubspotConnection {
  id: string;
  user_id: string;
  provider: "hubspot";
  portal_id: string | null;
  access_token: string;   // plaintext after decrypt
  refresh_token: string;  // plaintext after decrypt
  expires_at: string;     // ISO
  scopes: string[];
}

/**
 * Build the HubSpot OAuth authorization URL. The user is redirected here
 * by /api/settings/integrations/hubspot/connect; on grant, HubSpot bounces
 * them to our /api/auth/hubspot/callback with ?code=…&state=…
 *
 * codeChallenge is required when the HubSpot app has PKCE enforcement
 * enabled (the default for marketplace apps). Pass the base64url SHA-256
 * of the code_verifier here; store the verifier itself in an HttpOnly
 * cookie and replay it in exchangeCode.
 */
export function buildAuthorizeUrl(
  state: string,
  codeChallenge?: string
): string {
  const clientId = process.env.HUBSPOT_CLIENT_ID;
  const redirectUri = process.env.HUBSPOT_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    throw new Error("HUBSPOT_CLIENT_ID / HUBSPOT_REDIRECT_URI env vars missing");
  }
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: HUBSPOT_SCOPES.join(" "),
    state,
  });
  if (codeChallenge) {
    params.set("code_challenge", codeChallenge);
    params.set("code_challenge_method", "S256");
  }
  return `${HUBSPOT_AUTH_URL}?${params.toString()}`;
}

interface HubspotTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;   // seconds
  token_type: string;
  hub_id?: number;
}

async function exchangeCode(
  code: string,
  codeVerifier?: string
): Promise<HubspotTokenResponse> {
  const clientId = process.env.HUBSPOT_CLIENT_ID;
  const clientSecret = process.env.HUBSPOT_CLIENT_SECRET;
  const redirectUri = process.env.HUBSPOT_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("HubSpot OAuth env vars missing");
  }
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
  });
  if (codeVerifier) body.set("code_verifier", codeVerifier);
  const res = await fetch(HUBSPOT_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HubSpot token exchange failed: ${res.status} ${text.slice(0, 200)}`);
  }
  return (await res.json()) as HubspotTokenResponse;
}

async function refreshTokens(refreshToken: string): Promise<HubspotTokenResponse> {
  const clientId = process.env.HUBSPOT_CLIENT_ID;
  const clientSecret = process.env.HUBSPOT_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("HubSpot client creds missing");
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });
  const res = await fetch(HUBSPOT_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HubSpot token refresh failed: ${res.status} ${text.slice(0, 200)}`);
  }
  return (await res.json()) as HubspotTokenResponse;
}

/** Called by the /api/auth/hubspot/callback route after the user grants. */
export async function persistNewConnection(
  service: SupabaseClient,
  userId: string,
  code: string,
  codeVerifier?: string
): Promise<void> {
  const tokens = await exchangeCode(code, codeVerifier);
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  // Upsert on (user_id, provider) — reconnecting replaces the old row.
  const { error } = await service
    .from("crm_connections")
    .upsert(
      {
        user_id: userId,
        provider: "hubspot",
        portal_id: tokens.hub_id ? String(tokens.hub_id) : null,
        access_token: encryptToken(tokens.access_token),
        refresh_token: encryptToken(tokens.refresh_token),
        expires_at: expiresAt,
        scopes: HUBSPOT_SCOPES,
        connected_at: new Date().toISOString(),
      },
      { onConflict: "user_id,provider" }
    );
  if (error) throw new Error(`Failed to persist connection: ${error.message}`);
}

/**
 * Get the user's HubSpot connection with the access token guaranteed
 * fresh for the next ~30 minutes. Refreshes preemptively if the current
 * token expires within 60 seconds. Returns null if no connection exists.
 */
export async function getFreshConnection(
  service: SupabaseClient,
  userId: string
): Promise<HubspotConnection | null> {
  const { data: row } = await service
    .from("crm_connections")
    .select("id, user_id, provider, portal_id, access_token, refresh_token, expires_at, scopes")
    .eq("user_id", userId)
    .eq("provider", "hubspot")
    .maybeSingle();
  if (!row) return null;

  let accessToken: string;
  let refreshToken: string;
  try {
    accessToken = decryptToken(row.access_token as string);
    refreshToken = decryptToken(row.refresh_token as string);
  } catch (e) {
    // Ciphertext tampered or key rotated — force user to reconnect.
    console.error("[hubspot] token decrypt failed:", e);
    return null;
  }

  const expiresMs = new Date(row.expires_at as string).getTime();
  const soonMs = Date.now() + 60_000;
  if (expiresMs <= soonMs) {
    // Refresh preemptively.
    try {
      const fresh = await refreshTokens(refreshToken);
      accessToken = fresh.access_token;
      refreshToken = fresh.refresh_token;
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
        provider: "hubspot",
        portal_id: (row.portal_id as string | null) ?? null,
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: newExpiresAt,
        scopes: (row.scopes as string[] | null) ?? [],
      };
    } catch (e) {
      console.error("[hubspot] refresh failed:", e);
      return null;
    }
  }

  return {
    id: row.id as string,
    user_id: row.user_id as string,
    provider: "hubspot",
    portal_id: (row.portal_id as string | null) ?? null,
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: row.expires_at as string,
    scopes: (row.scopes as string[] | null) ?? [],
  };
}

// ─────────────────────────────────────────────────────────────────
// Contact lookup
// ─────────────────────────────────────────────────────────────────

interface HubspotContact {
  id: string;
  properties: Record<string, string | null | undefined>;
}

interface HubspotAssociations {
  results?: Array<{ id: string; type?: string }>;
}

interface ContactSearchResponse {
  total: number;
  results: HubspotContact[];
}

async function hubspotGet<T>(
  connection: HubspotConnection,
  path: string,
  query?: Record<string, string>
): Promise<T | null> {
  const url = new URL(HUBSPOT_API_BASE + path);
  if (query) {
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${connection.access_token}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`[hubspot] GET ${path} ${res.status}: ${text.slice(0, 200)}`);
    return null;
  }
  return (await res.json()) as T;
}

async function hubspotPost<T>(
  connection: HubspotConnection,
  path: string,
  body: unknown
): Promise<T | null> {
  const res = await fetch(HUBSPOT_API_BASE + path, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${connection.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`[hubspot] POST ${path} ${res.status}: ${text.slice(0, 200)}`);
    return null;
  }
  return (await res.json()) as T;
}

/**
 * The context Reverb injects into the chat when it detects a CRM contact
 * in the user's prompt. Structured so the model can copy specific values
 * ("Alice", "Discovery stage", "$50K deal") into the generated content
 * without paraphrasing them wrong.
 */
export interface CrmEngagement {
  kind: "email" | "call" | "meeting" | "note";
  timestamp: string | null;   // ISO
  subject: string | null;     // email subject / call title / meeting title
  direction: string | null;   // INCOMING / OUTGOING for emails+calls
  summary: string | null;     // short body/notes preview, trimmed
}

export interface CrmDealStageChange {
  stage: string;
  changed_at: string; // ISO
}

export interface CrmContactContext {
  contact_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  job_title: string | null;
  lifecycle_stage: string | null;
  lead_status: string | null;
  // Source / origin ("how did we get this contact")
  original_source: string | null;         // hs_analytics_source (e.g. ORGANIC_SEARCH, PAID_SEARCH, DIRECT_TRAFFIC)
  source_drill_1: string | null;          // hs_analytics_source_data_1
  source_drill_2: string | null;          // hs_analytics_source_data_2
  first_url: string | null;               // hs_analytics_first_url
  created_at: string | null;              // ISO
  last_activity_at: string | null;        // hs_last_activity_date
  // Company
  company_name: string | null;
  company_domain: string | null;
  company_industry: string | null;
  company_size: string | null;
  // Latest deal (still the primary one — richer detail below in history)
  latest_deal_name: string | null;
  latest_deal_stage: string | null;
  latest_deal_amount: string | null;
  latest_deal_close_date: string | null;
  latest_deal_stage_history: CrmDealStageChange[];  // ordered oldest → newest
  // Journey / touchpoints
  recent_engagements: CrmEngagement[];    // top 10 across emails/calls/meetings/notes, sorted DESC by timestamp
  marketing_last_open_at: string | null;
  marketing_last_click_at: string | null;
  marketing_last_email_name: string | null;
  // Meta
  portal_id: string | null;
  hubspot_url: string;
}

/** Human-readable relative date. "2 days ago", "3 weeks ago", etc. */
function relDate(iso: string | null): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const diffMs = Date.now() - t;
  const day = 86_400_000;
  if (diffMs < 0) return "in the future";
  if (diffMs < day) return "today";
  const days = Math.round(diffMs / day);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(months / 12)}y ago`;
}

/** Format a CrmContactContext as a compact system-prompt block. */
export function formatContactForContext(ctx: CrmContactContext): string {
  const lines: string[] = [
    `CRM CONTEXT (from HubSpot — authoritative on this recipient):`,
    `- Contact: ${ctx.full_name ?? ctx.email} <${ctx.email}>`,
  ];
  if (ctx.job_title) lines.push(`- Role: ${ctx.job_title}`);
  if (ctx.company_name) {
    const bits = [ctx.company_name];
    if (ctx.company_industry) bits.push(ctx.company_industry);
    if (ctx.company_size) bits.push(`${ctx.company_size} employees`);
    if (ctx.company_domain) bits.push(ctx.company_domain);
    lines.push(`- Company: ${bits.join(" · ")}`);
  }
  if (ctx.lifecycle_stage) lines.push(`- Lifecycle stage: ${ctx.lifecycle_stage}`);
  if (ctx.lead_status) lines.push(`- Lead status: ${ctx.lead_status}`);

  // Origin block — how did we get this contact
  const originBits: string[] = [];
  if (ctx.original_source) originBits.push(ctx.original_source);
  if (ctx.source_drill_1) originBits.push(ctx.source_drill_1);
  if (ctx.source_drill_2) originBits.push(ctx.source_drill_2);
  if (originBits.length) lines.push(`- Original source: ${originBits.join(" / ")}`);
  if (ctx.first_url) lines.push(`- First-touch URL: ${ctx.first_url}`);
  if (ctx.created_at) {
    const rel = relDate(ctx.created_at);
    lines.push(`- In CRM since: ${ctx.created_at.slice(0, 10)}${rel ? ` (${rel})` : ""}`);
  }
  if (ctx.last_activity_at) {
    const rel = relDate(ctx.last_activity_at);
    lines.push(`- Last activity: ${ctx.last_activity_at.slice(0, 10)}${rel ? ` (${rel})` : ""}`);
  }

  // Deal + stage-history block
  if (ctx.latest_deal_name || ctx.latest_deal_stage) {
    const dealBits: string[] = [];
    if (ctx.latest_deal_name) dealBits.push(ctx.latest_deal_name);
    if (ctx.latest_deal_stage) dealBits.push(`stage: ${ctx.latest_deal_stage}`);
    if (ctx.latest_deal_amount) dealBits.push(`amount: ${ctx.latest_deal_amount}`);
    if (ctx.latest_deal_close_date) dealBits.push(`close: ${ctx.latest_deal_close_date}`);
    lines.push(`- Latest deal: ${dealBits.join(" · ")}`);
    if (ctx.latest_deal_stage_history.length > 1) {
      const stagePath = ctx.latest_deal_stage_history
        .slice(-5)
        .map((s) => `${s.stage} (${s.changed_at.slice(0, 10)})`)
        .join(" → ");
      lines.push(`  · Stage path: ${stagePath}`);
    }
  }

  // Marketing engagement block
  if (ctx.marketing_last_email_name || ctx.marketing_last_open_at || ctx.marketing_last_click_at) {
    const mBits: string[] = [];
    if (ctx.marketing_last_email_name) mBits.push(`last sent: "${ctx.marketing_last_email_name}"`);
    if (ctx.marketing_last_open_at) mBits.push(`opened ${relDate(ctx.marketing_last_open_at) ?? ctx.marketing_last_open_at.slice(0, 10)}`);
    if (ctx.marketing_last_click_at) mBits.push(`clicked ${relDate(ctx.marketing_last_click_at) ?? ctx.marketing_last_click_at.slice(0, 10)}`);
    lines.push(`- Marketing email engagement: ${mBits.join(" · ")}`);
  }

  // Journey block — the touchpoint timeline
  if (ctx.recent_engagements.length > 0) {
    lines.push("");
    lines.push("RECENT TOUCHPOINTS (most recent first — use these to reference specific past interactions):");
    for (const e of ctx.recent_engagements.slice(0, 10)) {
      const when = e.timestamp ? e.timestamp.slice(0, 10) : "unknown date";
      const rel = e.timestamp ? relDate(e.timestamp) : null;
      const dir = e.direction ? ` (${e.direction.toLowerCase()})` : "";
      const subj = e.subject ? ` — "${e.subject}"` : "";
      const body = e.summary ? `\n     ${e.summary}` : "";
      lines.push(`  · ${when}${rel ? ` [${rel}]` : ""} · ${e.kind}${dir}${subj}${body}`);
    }
  }

  lines.push("");
  lines.push(`- HubSpot record: ${ctx.hubspot_url}`);
  lines.push("");
  lines.push(
    `USE THIS CONTEXT: reference the contact by first name, the company by name, and adapt the ` +
    `messaging tone/depth to their lifecycle stage. When writing a follow-up, ANCHOR on the most ` +
    `recent touchpoints above (e.g. "following up on our call last week about X", "re: the proposal ` +
    `I sent Tuesday"). Do NOT invent past interactions that aren't in the touchpoint list. If a ` +
    `field is missing, don't reference it. Never expose the raw HubSpot record link in the output.`
  );
  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────
// Engagement (email/call/meeting/note) fetch helpers
// ─────────────────────────────────────────────────────────────────

interface HubspotObjectWithHistory extends HubspotContact {
  propertiesWithHistory?: Record<string, Array<{ value: string; timestamp: string }>>;
}

interface BatchReadResponse {
  results: HubspotContact[];
}

async function fetchEngagements(
  connection: HubspotConnection,
  contactId: string,
  kind: "emails" | "calls" | "meetings" | "notes",
  limit: number
): Promise<CrmEngagement[]> {
  // 1. Get associated engagement IDs
  const assoc = await hubspotGet<HubspotAssociations>(
    connection,
    `/crm/v4/objects/contacts/${contactId}/associations/${kind}`
  );
  const ids = (assoc?.results ?? []).map((r) => r.id).filter(Boolean);
  if (ids.length === 0) return [];

  // 2. Batch-read the engagement objects with the properties we need.
  // Different engagement objects expose subject/direction under different
  // property names — request the union and pluck what applies.
  const propertyMap: Record<typeof kind, string[]> = {
    emails: ["hs_email_subject", "hs_email_direction", "hs_email_text", "hs_timestamp", "hs_createdate"],
    calls: ["hs_call_title", "hs_call_direction", "hs_call_body", "hs_timestamp", "hs_createdate"],
    meetings: ["hs_meeting_title", "hs_meeting_body", "hs_timestamp", "hs_createdate"],
    notes: ["hs_note_body", "hs_timestamp", "hs_createdate"],
  };

  // HubSpot limits batch-read to 100 IDs per call; we ask for at most 25 here
  // via slicing.
  const batchIds = ids.slice(0, 25).map((id) => ({ id }));
  const batch = await hubspotPost<BatchReadResponse>(
    connection,
    `/crm/v3/objects/${kind}/batch/read`,
    {
      inputs: batchIds,
      properties: propertyMap[kind],
    }
  );

  const trim = (s: string | null | undefined, n: number): string | null => {
    if (!s) return null;
    // Strip HTML tags coarsely — HubSpot email/note bodies are HTML.
    const stripped = s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!stripped) return null;
    return stripped.length > n ? stripped.slice(0, n) + "…" : stripped;
  };

  const engagements: CrmEngagement[] = (batch?.results ?? []).map((obj) => {
    const p = obj.properties;
    const ts = (p.hs_timestamp as string) ?? (p.hs_createdate as string) ?? null;
    if (kind === "emails") {
      return {
        kind: "email",
        timestamp: ts,
        subject: (p.hs_email_subject as string) ?? null,
        direction: (p.hs_email_direction as string) ?? null,
        summary: trim(p.hs_email_text as string, 200),
      };
    }
    if (kind === "calls") {
      return {
        kind: "call",
        timestamp: ts,
        subject: (p.hs_call_title as string) ?? null,
        direction: (p.hs_call_direction as string) ?? null,
        summary: trim(p.hs_call_body as string, 200),
      };
    }
    if (kind === "meetings") {
      return {
        kind: "meeting",
        timestamp: ts,
        subject: (p.hs_meeting_title as string) ?? null,
        direction: null,
        summary: trim(p.hs_meeting_body as string, 200),
      };
    }
    return {
      kind: "note",
      timestamp: ts,
      subject: null,
      direction: null,
      summary: trim(p.hs_note_body as string, 200),
    };
  });

  // Sort DESC by timestamp, then apply the caller's cap.
  engagements.sort((a, b) => {
    const ta = a.timestamp ? Date.parse(a.timestamp) : 0;
    const tb = b.timestamp ? Date.parse(b.timestamp) : 0;
    return tb - ta;
  });
  return engagements.slice(0, limit);
}

/**
 * Look up a HubSpot contact by email and enrich with associated company +
 * most-recent deal + origin source + engagement timeline + deal stage
 * history. Returns null if no contact matches. Uses parallel fetches to
 * keep total latency near a single round-trip after the initial search.
 */
export async function lookupContactByEmail(
  connection: HubspotConnection,
  email: string
): Promise<CrmContactContext | null> {
  const searchRes = await hubspotPost<ContactSearchResponse>(
    connection,
    "/crm/v3/objects/contacts/search",
    {
      filterGroups: [
        {
          filters: [{ propertyName: "email", operator: "EQ", value: email.toLowerCase().trim() }],
        },
      ],
      properties: [
        // Identity
        "email",
        "firstname",
        "lastname",
        "jobtitle",
        "lifecyclestage",
        "hs_lead_status",
        // Origin
        "hs_analytics_source",
        "hs_analytics_source_data_1",
        "hs_analytics_source_data_2",
        "hs_analytics_first_url",
        "createdate",
        "hs_last_activity_date",
        // Marketing email engagement rollups
        "hs_email_last_email_name",
        "hs_email_last_open_date",
        "hs_email_last_click_date",
      ],
      limit: 1,
    }
  );
  if (!searchRes || searchRes.total === 0 || !searchRes.results[0]) return null;

  const contact = searchRes.results[0];
  const props = contact.properties;

  // Fetch all associations in parallel. We only need IDs at this stage.
  const [companyAssoc, dealAssoc, recentEmails, recentCalls, recentMeetings, recentNotes] =
    await Promise.all([
      hubspotGet<HubspotAssociations>(
        connection,
        `/crm/v4/objects/contacts/${contact.id}/associations/companies`
      ),
      hubspotGet<HubspotAssociations>(
        connection,
        `/crm/v4/objects/contacts/${contact.id}/associations/deals`
      ),
      fetchEngagements(connection, contact.id, "emails", 5),
      fetchEngagements(connection, contact.id, "calls", 3),
      fetchEngagements(connection, contact.id, "meetings", 3),
      fetchEngagements(connection, contact.id, "notes", 2),
    ]);

  const companyId = companyAssoc?.results?.[0]?.id;
  const dealId = dealAssoc?.results?.[0]?.id;

  // Round 2 — company + deal detail (with deal stage history) in parallel.
  const [companyRes, dealRes] = await Promise.all([
    companyId
      ? hubspotGet<HubspotContact>(
          connection,
          `/crm/v3/objects/companies/${companyId}`,
          { properties: "name,domain,industry,numberofemployees" }
        )
      : Promise.resolve(null),
    dealId
      ? hubspotGet<HubspotObjectWithHistory>(
          connection,
          `/crm/v3/objects/deals/${dealId}`,
          {
            properties: "dealname,dealstage,amount,closedate",
            propertiesWithHistory: "dealstage",
          }
        )
      : Promise.resolve(null),
  ]);

  const companyProps = companyRes?.properties ?? {};
  const dealProps = dealRes?.properties ?? {};

  // Merge all engagements into one timeline, then cap.
  const timeline: CrmEngagement[] = [...recentEmails, ...recentCalls, ...recentMeetings, ...recentNotes];
  timeline.sort((a, b) => {
    const ta = a.timestamp ? Date.parse(a.timestamp) : 0;
    const tb = b.timestamp ? Date.parse(b.timestamp) : 0;
    return tb - ta;
  });
  const recentEngagements = timeline.slice(0, 10);

  // Extract stage history from propertiesWithHistory (oldest → newest).
  const dealStageHistory: CrmDealStageChange[] = [];
  const rawHistory = dealRes?.propertiesWithHistory?.dealstage ?? [];
  for (const h of rawHistory) {
    if (h.value && h.timestamp) {
      dealStageHistory.push({ stage: h.value, changed_at: h.timestamp });
    }
  }
  // HubSpot returns history in DESC (newest first). Flip to ASC for readability.
  dealStageHistory.reverse();

  const firstName = props.firstname ?? null;
  const lastName = props.lastname ?? null;
  const fullName = [firstName, lastName].filter(Boolean).join(" ") || null;

  return {
    contact_id: contact.id,
    email: (props.email as string) ?? email,
    first_name: firstName,
    last_name: lastName,
    full_name: fullName,
    job_title: (props.jobtitle as string) ?? null,
    lifecycle_stage: (props.lifecyclestage as string) ?? null,
    lead_status: (props.hs_lead_status as string) ?? null,
    original_source: (props.hs_analytics_source as string) ?? null,
    source_drill_1: (props.hs_analytics_source_data_1 as string) ?? null,
    source_drill_2: (props.hs_analytics_source_data_2 as string) ?? null,
    first_url: (props.hs_analytics_first_url as string) ?? null,
    created_at: (props.createdate as string) ?? null,
    last_activity_at: (props.hs_last_activity_date as string) ?? null,
    company_name: (companyProps.name as string) ?? null,
    company_domain: (companyProps.domain as string) ?? null,
    company_industry: (companyProps.industry as string) ?? null,
    company_size: (companyProps.numberofemployees as string) ?? null,
    latest_deal_name: (dealProps.dealname as string) ?? null,
    latest_deal_stage: (dealProps.dealstage as string) ?? null,
    latest_deal_amount: (dealProps.amount as string) ?? null,
    latest_deal_close_date: (dealProps.closedate as string) ?? null,
    latest_deal_stage_history: dealStageHistory,
    recent_engagements: recentEngagements,
    marketing_last_open_at: (props.hs_email_last_open_date as string) ?? null,
    marketing_last_click_at: (props.hs_email_last_click_date as string) ?? null,
    marketing_last_email_name: (props.hs_email_last_email_name as string) ?? null,
    portal_id: connection.portal_id,
    hubspot_url: connection.portal_id
      ? `https://app.hubspot.com/contacts/${connection.portal_id}/contact/${contact.id}`
      : `https://app.hubspot.com/contacts/contact/${contact.id}`,
  };
}

/**
 * Convenience: given a user_id and an email, resolve the contact context
 * through the fresh-connection path. Returns null if the user isn't
 * connected OR if HubSpot has no record for that email.
 */
export async function getHubspotContext(
  userId: string,
  email: string
): Promise<CrmContactContext | null> {
  const service = getSupabase();
  if (!service) return null;
  const conn = await getFreshConnection(service, userId);
  if (!conn) return null;
  return lookupContactByEmail(conn, email);
}

// ─────────────────────────────────────────────────────────────────
// Contact LIST (for "show me my contacts" style questions)
// ─────────────────────────────────────────────────────────────────

export interface CrmContactSummary {
  contact_id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  job_title: string | null;
  company: string | null;
  lifecycle_stage: string | null;
  lead_status: string | null;
  last_activity_at: string | null;
  created_at: string | null;
}

export interface CrmContactList {
  contacts: CrmContactSummary[];
  total: number;      // total in the portal, not just returned
  returned: number;   // count actually returned
}

/** List up to N most-recently-modified contacts from the connected HubSpot. */
export async function listRecentContacts(
  connection: HubspotConnection,
  limit = 20
): Promise<CrmContactList> {
  const res = await hubspotPost<ContactSearchResponse>(
    connection,
    "/crm/v3/objects/contacts/search",
    {
      // No filters — return everything, sorted by last modified.
      properties: [
        "email",
        "firstname",
        "lastname",
        "jobtitle",
        "company",
        "lifecyclestage",
        "hs_lead_status",
        "hs_last_activity_date",
        "createdate",
      ],
      sorts: [{ propertyName: "lastmodifieddate", direction: "DESCENDING" }],
      limit: Math.min(limit, 100),
    }
  );
  if (!res) return { contacts: [], total: 0, returned: 0 };

  const contacts: CrmContactSummary[] = res.results.map((c) => {
    const p = c.properties;
    const first = (p.firstname as string) ?? null;
    const last = (p.lastname as string) ?? null;
    const full = [first, last].filter(Boolean).join(" ") || null;
    return {
      contact_id: c.id,
      email: (p.email as string) ?? null,
      first_name: first,
      last_name: last,
      full_name: full,
      job_title: (p.jobtitle as string) ?? null,
      company: (p.company as string) ?? null,
      lifecycle_stage: (p.lifecyclestage as string) ?? null,
      lead_status: (p.hs_lead_status as string) ?? null,
      last_activity_at: (p.hs_last_activity_date as string) ?? null,
      created_at: (p.createdate as string) ?? null,
    };
  });

  return { contacts, total: res.total ?? contacts.length, returned: contacts.length };
}

/** Format a contact list as a compact markdown table system-prompt block. */
export function formatContactListForContext(list: CrmContactList): string {
  if (list.returned === 0) {
    return "CRM DATA: The connected HubSpot has no contacts, or the search returned nothing.";
  }
  const rows = list.contacts
    .map((c) => {
      const name = c.full_name ?? c.email ?? "(no name)";
      const role = c.job_title ? ` · ${c.job_title}` : "";
      const co = c.company ? ` @ ${c.company}` : "";
      const stage = c.lifecycle_stage ? ` [${c.lifecycle_stage}${c.lead_status ? `/${c.lead_status}` : ""}]` : "";
      const email = c.email ? ` <${c.email}>` : "";
      const activity = c.last_activity_at ? ` — last activity ${c.last_activity_at.slice(0, 10)}` : "";
      return `- ${name}${email}${role}${co}${stage}${activity}`;
    })
    .join("\n");

  return (
    `CRM DATA — user's HubSpot contact list (${list.returned} shown of ${list.total.toLocaleString()} total contacts, ` +
    `most recently modified first):\n\n${rows}\n\n` +
    `USE THIS DATA: When the user asks about "their contacts" or "who's in HubSpot" or similar, ` +
    `answer with this list directly — do NOT give generic advice about "how to manage a contact list". ` +
    `Present the info clearly (table or grouped list). If the user asks about a specific person, ` +
    `pull their details from this list. If they want more than the ${list.returned} shown, tell them ` +
    `to be more specific (e.g. filter by company, lifecycle stage, or ask about a specific person by email).`
  );
}

/** Convenience wrapper matching getHubspotContext's connection-resolution flow. */
export async function getHubspotContactList(
  userId: string,
  limit = 20
): Promise<CrmContactList | null> {
  const service = getSupabase();
  if (!service) return null;
  const conn = await getFreshConnection(service, userId);
  if (!conn) return null;
  return listRecentContacts(conn, limit);
}

/**
 * When the user asks about JOURNEYS specifically (not just "who's in my CRM"),
 * fetch full contact enrichment (touchpoints, source, deal-stage history) for
 * the top N recent contacts. Kept small (default 3) because each contact
 * enrichment costs ~10 HubSpot API calls; 20 contacts × 10 = 200 calls which
 * would blow both latency and rate limits.
 *
 * Runs the per-contact enrichments in parallel so total wall-clock is roughly
 * the slowest single contact (~1-2 seconds), not sum-of-all.
 */
export async function getHubspotContactJourneys(
  userId: string,
  limit = 3
): Promise<CrmContactContext[] | null> {
  const service = getSupabase();
  if (!service) return null;
  const conn = await getFreshConnection(service, userId);
  if (!conn) return null;

  // Grab N most-recently-modified contacts (just to get emails).
  const summary = await listRecentContacts(conn, limit);
  if (summary.contacts.length === 0) return [];

  // Enrich each in parallel. Fall through gracefully on individual failures.
  const enrichments = await Promise.all(
    summary.contacts
      .map((c) => c.email)
      .filter((e): e is string => Boolean(e))
      .map(async (email) => {
        try {
          return await lookupContactByEmail(conn, email);
        } catch (err) {
          console.error("[hubspot] enrichment failed for", email, err);
          return null;
        }
      })
  );

  return enrichments.filter((c): c is CrmContactContext => c !== null);
}
