// ─────────────────────────────────────────────────────────────────
// /api/settings/integrations
//
// GET    → list the current user's CRM connections (no ciphertext,
//          reads from v_crm_connections_public)
// DELETE → disconnect a provider by ?provider=hubspot. Removes the
//          row entirely so the next connect starts a fresh OAuth flow.
// ─────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

const VALID_PROVIDERS = new Set(["hubspot", "salesforce", "pipedrive", "zoho"]);

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const service = getSupabase();
  if (!service) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  // Query the base table with an explicit safe-column list (no
  // access_token / refresh_token ciphertext). Service-role client
  // bypasses RLS by design here — the userId filter below is the
  // access boundary. This intentionally does not use the public view
  // so the migration doesn't have to have applied the view for the
  // page to work (base table is all we need).
  const { data, error } = await service
    .from("crm_connections")
    .select("id, provider, portal_id, expires_at, scopes, connected_at, last_refreshed_at")
    .eq("user_id", user.id)
    .order("connected_at", { ascending: false });

  if (error) {
    // Distinguish "table not created yet" from other DB errors so the UI
    // can prompt for the migration instead of showing a scary generic error.
    const msg = error.message ?? "";
    const missingTable =
      msg.includes("Could not find the table") ||
      msg.includes("does not exist") ||
      msg.includes("relation") ||
      error.code === "42P01" ||
      error.code === "PGRST205";
    if (missingTable) {
      return NextResponse.json(
        {
          error: "migration_not_applied",
          detail: "The crm_connections table doesn't exist yet. Run the SQL migration in Supabase → SQL Editor.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "list_failed", detail: msg }, { status: 500 });
  }

  return NextResponse.json({
    connections: (data ?? []).map((row) => ({
      id: row.id,
      provider: row.provider,
      portal_id: row.portal_id,
      scopes: row.scopes ?? [],
      connected_at: row.connected_at,
      expires_at: row.expires_at,
      last_refreshed_at: row.last_refreshed_at,
    })),
  });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const provider = req.nextUrl.searchParams.get("provider");
  if (!provider || !VALID_PROVIDERS.has(provider)) {
    return NextResponse.json({ error: "invalid_provider" }, { status: 400 });
  }

  const service = getSupabase();
  if (!service) {
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
  }

  const { error } = await service
    .from("crm_connections")
    .delete()
    .eq("user_id", user.id)
    .eq("provider", provider);

  if (error) {
    return NextResponse.json({ error: "delete_failed", detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, provider });
}
