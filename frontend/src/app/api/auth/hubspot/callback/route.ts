// ─────────────────────────────────────────────────────────────────
// /api/auth/hubspot/callback
//
// HubSpot redirects here with ?code=&state=. We:
//   1. Verify the state HMAC matches a userId + non-expired timestamp
//   2. Also verify the currently-logged-in user matches the state's userId
//      (defense-in-depth — the state alone would be replayable by anyone
//      who intercepted the redirect URL)
//   3. Exchange the code for tokens and persist the encrypted connection
//   4. Bounce the user back to /settings/integrations with a status query
// ─────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabase } from "@/lib/supabase";
import { persistNewConnection } from "@/lib/crm/hubspot";
import { PKCE_COOKIE } from "@/app/api/settings/integrations/hubspot/connect/route";

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
  url.searchParams.set("hubspot", status);
  if (reason) {
    // Trim + cap to keep the URL sane. 400 chars is plenty for HubSpot errors.
    url.searchParams.set("reason", reason.slice(0, 400));
  }
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const oauthError = req.nextUrl.searchParams.get("error");

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

  // Belt-and-suspenders: the current session must own the state's userId.
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== verified.userId) {
    return redirectTo(req, "/signin?next=/settings/integrations", "session_mismatch");
  }

  const service = getSupabase();
  if (!service) {
    return redirectTo(req, "/settings/integrations", "server_misconfigured");
  }

  const verifier = req.cookies.get(PKCE_COOKIE)?.value;
  if (!verifier) {
    return redirectTo(req, "/settings/integrations", "missing_pkce_cookie");
  }

  try {
    await persistNewConnection(service, user.id, code, verifier);
  } catch (e) {
    console.error("[hubspot callback]", e);
    const reason = e instanceof Error ? e.message : "unknown";
    return redirectTo(req, "/settings/integrations", "exchange_failed", reason);
  }

  const res = redirectTo(req, "/settings/integrations", "connected");
  // Cookie has served its purpose; clear it so a replay can't reuse it.
  res.cookies.set(PKCE_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
