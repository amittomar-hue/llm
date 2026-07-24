// ─────────────────────────────────────────────────────────────────
// /api/settings/integrations/zoho/connect
//
// Starts the Zoho OAuth flow. Mirrors the HubSpot connect route:
//   • HMAC-signed state token binds the user id + timestamp
//   • Generate PKCE verifier + challenge (Zoho supports PKCE; we
//     always send it so if the app is configured with PKCE required,
//     the flow still succeeds)
//   • Stash the verifier in an HttpOnly SameSite=Lax cookie
//   • Redirect to accounts.zoho.com — Zoho will 302 the user into
//     their actual data center during login if they're on EU/IN/AU/JP/CN.
// ─────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { buildAuthorizeUrl } from "@/lib/crm/zoho";

export const runtime = "nodejs";

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const ZOHO_PKCE_COOKIE = "reverb_zoho_pkce";

function signState(userId: string): string {
  const secret = process.env.CRM_OAUTH_STATE_SECRET;
  if (!secret) throw new Error("CRM_OAUTH_STATE_SECRET env var missing");
  const expiresMs = Date.now() + STATE_TTL_MS;
  const payload = `${userId}.${expiresMs}`;
  const mac = createHmac("sha256", secret).update(payload).digest("base64url");
  return Buffer.from(`${payload}.${mac}`, "utf8").toString("base64url");
}

function generateCodeVerifier(): string {
  return randomBytes(64).toString("base64url");
}

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
    res.cookies.set(ZOHO_PKCE_COOKIE, verifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: STATE_TTL_MS / 1000,
    });
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: "zoho_config_missing", detail: msg }, { status: 500 });
  }
}
