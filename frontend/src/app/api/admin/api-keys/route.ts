// ─────────────────────────────────────────────────────────────────
// /api/admin/api-keys — admin-only view of every user's API keys.
//
// Returns rows joined with the owning user's email so the admin can
// see WHO created each key. Includes revoked keys (with revoked_at
// populated) so admin has a full audit trail.
//
// NEVER exposes key_hash — that would let an admin impersonate a
// user via the /api/v1/* surface. Only display fields go over the
// wire: id, name, key_prefix, timestamps, owner metadata.
// ─────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { createSupabaseServerClient, isAdminEmail } from "@/lib/supabase-server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET() {
  const supa = await createSupabaseServerClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = getSupabase();
  if (!service) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  // Deliberately do NOT select key_hash — admin has no need to see it,
  // and if the DB dump ever leaks we lose defense-in-depth. Prefix is
  // safe because it can't be used to authenticate.
  const { data: keys, error } = await service
    .from("api_keys")
    .select("id, user_id, name, key_prefix, last_used_at, created_at, revoked_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch every auth user in one call and map user_id → email. Cheap for
  // now (< 1000 users); switch to targeted getUserById lookups if the
  // active user pool grows past listUsers' single-page limit.
  const { data: { users } } = await service.auth.admin.listUsers({ perPage: 1000 });
  const emailById = new Map<string, string | null>();
  for (const u of users ?? []) {
    emailById.set(u.id, u.email ?? null);
  }

  const rows = (keys ?? []).map((k) => ({
    id: k.id as string,
    user_id: k.user_id as string,
    user_email: emailById.get(k.user_id as string) ?? null,
    name: k.name as string,
    key_prefix: k.key_prefix as string,
    last_used_at: k.last_used_at as string | null,
    created_at: k.created_at as string,
    revoked_at: k.revoked_at as string | null,
  }));

  const active = rows.filter((r) => !r.revoked_at).length;
  const revoked = rows.filter((r) => r.revoked_at).length;
  const usedLast7d = rows.filter((r) => {
    if (!r.last_used_at) return false;
    return Date.now() - new Date(r.last_used_at).getTime() < 7 * 86400000;
  }).length;

  return NextResponse.json({
    keys: rows,
    summary: {
      total: rows.length,
      active,
      revoked,
      used_last_7d: usedLast7d,
    },
  });
}
