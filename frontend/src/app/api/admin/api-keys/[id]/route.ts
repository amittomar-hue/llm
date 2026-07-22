// ─────────────────────────────────────────────────────────────────
// /api/admin/api-keys/[id] — admin-revoke ANY user's key.
//
// Different from /api/settings/api-keys/[id] (user self-revoke): no
// ownership check — admin can revoke any key. Same soft-revoke via
// revoked_at so the audit trail survives.
// ─────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, isAdminEmail } from "@/lib/supabase-server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const supa = await createSupabaseServerClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = getSupabase();
  if (!service) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error, data } = await service
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .is("revoked_at", null)
    .select("id, user_id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Key not found or already revoked" }, { status: 404 });

  return NextResponse.json({ ok: true, revoked_id: data.id });
}
