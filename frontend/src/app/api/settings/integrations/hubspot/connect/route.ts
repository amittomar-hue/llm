// ─────────────────────────────────────────────────────────────────
// /api/settings/integrations/hubspot/connect
//
// Starts the HubSpot OAuth flow. HubSpot marketplace apps default to
// PKCE-enforced authorization. We:
//   1. Generate a random code_verifier (RFC 7636 §4.1: 43-128 chars
//      of unreserved URL chars)
//   2. Compute code_challenge = base64url(SHA-256(code_verifier))
//   3. Set the verifier in an HttpOnly, SameSite=Lax cookie (survives
//      the HubSpot round-trip because Lax allows top-level nav)
//   4. Sign a short-lived state token binding the user id + timestamp
//   5. Redirect to HubSpot with client_id + redirect_uri + state +
//      code_challenge + code_challenge_method=S256
//
// State token format (base64url wrapper):
//   "userId.expiresMs.HMAC(secret, userId + ':' + expiresMs)"
// Verified in /api/auth/hubspot/callback along with the cookie.
// ─────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { buildAuthorizeUrl } from "@/lib/crm/hubspot";

export const runtime = "nodejs";

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const PKCE_COOKIE = "reverb_hs_pkce";

function signState(userId: string): string {
  const secret = process.env.CRM_OAUTH_STATE_SECRET;
  if (!secret) throw new Error("CRM_OAUTH_STATE_SECRET env var missing");
  const expiresMs = Date.now() + STATE_TTL_MS;
  const payload = `${userId}.${expiresMs}`;
  const mac = createHmac("sha256", secret).update(payload).digest("base64url");
  return Buffer.from(`${payload}.${mac}`, "utf8").toString("base64url");
}

/** RFC 7636 §4.1: 43-128 chars from [A-Z][a-z][0-9]-._~ — base64url of
 *  random bytes fits that alphabet natively. 64 bytes → 86 chars. */
function generateCodeVerifier(): string {
  return randomBytes(64).toString("base64url");
}

/** RFC 7636 §4.2: challenge = base64url(SHA-256(verifier)) */
function computeCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/signin?next=/settings/integrations", req.url));
  }
  try {
    const state = signState(user.id);
    const verifier = generateCodeVerifier();
    const challenge = computeCodeChallenge(verifier);
    const url = buildAuthorizeUrl(state, challenge);
    const res = NextResponse.redirect(url);
    // HttpOnly so JS can't read it. SameSite=Lax so it comes back with
    // the top-level nav from hubspot.com → reverb.com. Secure in prod.
    res.cookies.set(PKCE_COOKIE, verifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: STATE_TTL_MS / 1000,
    });
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: "hubspot_config_missing", detail: msg }, { status: 500 });
  }
}
