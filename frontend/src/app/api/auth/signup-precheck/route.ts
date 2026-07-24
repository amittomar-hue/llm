import { NextRequest, NextResponse } from "next/server";
import { validateSignup } from "@/lib/signup-validation";

export const runtime = "nodejs";

// ─────────────────────────────────────────────────────────────────
// /api/auth/signup-precheck
//
// Called by the signup form BEFORE supabase.auth.signUp(). Runs four
// server-side checks (honeypot, dwell time, name shape, email shape)
// that catch every bot pattern we've observed since the auto-confirm
// flag went on. Returns `{ ok: true }` to greenlight signup or
// `{ ok: false, reason }` to block.
//
// Why server-side (vs. just client checks): bots can bypass any
// client validation by hitting the Supabase API directly. The form
// stays calling Supabase from the client (cleanest UX) but we expose
// this precheck so we can deny known bot shapes BEFORE Supabase
// creates an account — and we also use Supabase's RLS to ensure the
// signup endpoint isn't trivially scriptable without this gate.
// (The harder script-direct attack still needs to forge plausible
// name/email/honeypot/timing values, which most off-the-shelf bots
// don't bother with.)
// ─────────────────────────────────────────────────────────────────

interface PrecheckBody {
  full_name?: unknown;
  email?: unknown;
  honeypot?: unknown;
  form_rendered_at?: unknown;
}

export async function POST(req: NextRequest) {
  let body: PrecheckBody;
  try {
    body = (await req.json()) as PrecheckBody;
  } catch {
    return NextResponse.json({ ok: false, reason: "Bad request" }, { status: 400 });
  }

  const full_name = typeof body.full_name === "string" ? body.full_name : "";
  const email = typeof body.email === "string" ? body.email : "";
  const honeypot = typeof body.honeypot === "string" ? body.honeypot : null;
  const form_rendered_at = typeof body.form_rendered_at === "number" ? body.form_rendered_at : null;

  const result = validateSignup({
    full_name,
    email,
    honeypot,
    form_rendered_at,
    now_ms: Date.now(),
  });

  if (!result.ok) {
    // Log internally with the specific code so we can monitor what's
    // hitting the gate, but return a generic message to the client —
    // we don't want to tell bots which check failed.
    const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
    console.warn(
      `[signup-precheck blocked] code=${result.code} ip=${ip} ` +
      `email=${email.slice(0, 40)} name=${full_name.slice(0, 30)}`
    );
    return NextResponse.json(
      {
        ok: false,
        // Generic message — never reveal which heuristic caught them.
        reason:
          "We couldn't create your account. If you believe this is an error, " +
          "email support@reverb.com.",
      },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}
