// ─────────────────────────────────────────────────────────────────
// /api/auth/zoho/callback
//
// Zoho redirects here with ?code=&state=&accounts-server=&location=
//   accounts-server → which Zoho DC issued the auth (e.g. https://accounts.zoho.in)
//   location        → same as accounts-server but shorter code (US, EU, IN…)
//
// We use accounts-server to determine the region so the token exchange
// hits the correct DC (they're not fungible — a US-issued code cannot
// be exchanged at accounts.zoho.eu).
// ─────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabase } from "@/lib/supabase";
import { persistNewConnection, regionFromAccountsServer } from "@/lib/crm/zoho";
import { ZOHO_PKCE_COOKIE } from "@/app/api/settings/integrations/zoho/connect/route";

export const runtime = "nodejs";

interface VerifiedState {
  userId: string;
  expiresMs: number;
}

function verifyState(state: string): VerifiedState | null {
  const secret = process.env.CRM_OAUTH_STATE_SECRET;
  if (!secret) return null;
  let decoded: string;
  try {
    decoded = Buffer.from(state, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const parts = decoded.split(".");
  if (parts.length !== 3) return null;
  const [userId, expiresStr, mac] = parts;
  const expiresMs = Number(expiresStr);
  if (!Number.isFinite(expiresMs) || expiresMs < Date.now()) return null;
  const expected = createHmac("sha256", secret)
    .update(`${userId}.${expiresMs}`)
    .digest("base64url");
  const macBuf = Buffer.from(mac, "utf8");
  const expBuf = Buffer.from(expected, "utf8");
  if (macBuf.length !== expBuf.length) return null;
  if (!timingSafeEqual(macBuf, expBuf)) return null;
  return { userId, expiresMs };
}

function redirectTo(
  req: NextRequest,
  path: string,
  status: string,
  reason?: string
): NextResponse {
  const url = new URL(path, req.url);
  url.searchParams.set("zoho", status);
  if (reason) url.searchParams.set("reason", reason.slice(0, 400));
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const oauthError = req.nextUrl.searchParams.get("error");
  const accountsServer = req.nextUrl.searchParams.get("accounts-server");
  const location = req.nextUrl.searchParams.get("location");

  if (oauthError) {
    return redirectTo(req, "/settings/integrations", `denied_${oauthError}`);
  }
  if (!code || !state) {
    return redirectTo(req, "/settings/integrations", "missing_params");
  }

  const verified = verifyState(state);
  if (!verified) {
    return redirectTo(req, "/settings/integrations", "invalid_state");
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== verified.userId) {
    return redirectTo(req, "/signin?next=/settings/integrations", "session_mismatch");
  }

  const service = getSupabase();
  if (!service) {
    return redirectTo(req, "/settings/integrations", "server_misconfigured");
  }

  const verifier = req.cookies.get(ZOHO_PKCE_COOKIE)?.value;
  if (!verifier) {
    return redirectTo(req, "/settings/integrations", "missing_pkce_cookie");
  }

  // Prefer the `accounts-server` param — it's the URL Zoho used to issue
  // the code. `location` is a short code (US/EU/IN/AU/JP/CN) as backup.
  const region = regionFromAccountsServer(accountsServer ?? location);

  try {
    await persistNewConnection(service, user.id, code, region, verifier);
  } catch (e) {
    console.error("[zoho callback]", e);
    const reason = e instanceof Error ? e.message : "unknown";
    return redirectTo(req, "/settings/integrations", "exchange_failed", reason);
  }

  const res = redirectTo(req, "/settings/integrations", "connected");
  res.cookies.set(ZOHO_PKCE_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
