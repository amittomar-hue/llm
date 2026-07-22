// ─────────────────────────────────────────────────────────────────
// /api/settings/api-keys — GET (list) + POST (create) for the
// authenticated user's API keys. The plaintext of a newly-created
// key is returned ONE TIME here; the DB only ever stores the SHA-256
// hash + display prefix.
// ─────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabase } from "@/lib/supabase";
import { generateApiKey } from "@/lib/api-keys";

export const runtime = "nodejs";

const MAX_KEYS_PER_USER = 10;

export async function GET() {
  const supa = await createSupabaseServerClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = getSupabase();
  if (!service) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  // Never return key_hash. key_prefix + name + last_used_at is enough
  // for the UI to identify a key without ever exposing anything usable.
  const { data, error } = await service
    .from("api_keys")
    .select("id, name, key_prefix, last_used_at, created_at, revoked_at")
    .eq("user_id", user.id)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ keys: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supa = await createSupabaseServerClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = getSupabase();
  if (!service) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const name = (body?.name ?? "").toString().trim().slice(0, 80);
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  // Per-user cap — prevents runaway key generation and keeps the UI list
  // finite. 10 is arbitrary but generous for real integrations.
  const { count } = await service
    .from("api_keys")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("revoked_at", null);
  if ((count ?? 0) >= MAX_KEYS_PER_USER) {
    return NextResponse.json(
      { error: `Key limit reached (${MAX_KEYS_PER_USER}). Revoke an old key to create another.` },
      { status: 400 }
    );
  }

  const { plaintext, hash, prefix } = generateApiKey();

  const { data: row, error } = await service
    .from("api_keys")
    .insert({
      user_id: user.id,
      name,
      key_hash: hash,
      key_prefix: prefix,
    })
    .select("id, name, key_prefix, last_used_at, created_at")
    .single();

  if (error || !row) {
    return NextResponse.json({ error: error?.message ?? "Insert failed" }, { status: 500 });
  }

  // plaintext returned EXACTLY ONCE. The UI is responsible for making
  // the user copy it before dismissing the modal.
  return NextResponse.json({
    key: row,
    plaintext,
    warning:
      "Save this key now — you will not be able to see it again. If you lose it, revoke and regenerate.",
  });
}
