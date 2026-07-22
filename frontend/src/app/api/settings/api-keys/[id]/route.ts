// ─────────────────────────────────────────────────────────────────
// /api/settings/api-keys/[id] — DELETE (revoke) a specific key.
// We soft-revoke (set revoked_at) rather than hard-delete so that
// audit / usage history remains queryable if we ever surface it.
// ─────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const supa = await createSupabaseServerClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = getSupabase();
  if (!service) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // Ownership check via .eq("user_id", user.id) is critical — without
  // it a user could revoke someone else's key by guessing UUIDs.
  const { error, data } = await service
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Key not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
