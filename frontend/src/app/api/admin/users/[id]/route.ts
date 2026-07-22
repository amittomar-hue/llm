import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, isAdminEmail } from "@/lib/supabase-server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

// Per-user activity drill-down. Admin clicks a user in the Users tab →
// this returns their full prompt history, brand docs, feedback timeline,
// and safety incidents. The [id] param can be a profile UUID OR the
// literal "anonymous" for the unauthenticated bucket.
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const supa = await createSupabaseServerClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = getSupabase();
  if (!service) return NextResponse.json({ error: "Supabase missing" }, { status: 503 });

  const { id } = await ctx.params;
  const isAnonymous = id === "anonymous";

  // Profile (skip for anonymous)
  let profile: { id: string; email: string | null; created_at: string } | null = null;
  let linkedin: {
    sub: string | null;
    name: string | null;
    picture: string | null;
    profile_url: string;
    search_url: string;
  } | null = null;
  let providers: string[] = [];

  if (!isAnonymous) {
    const { data } = await service
      .from("profiles")
      .select("id, email, created_at")
      .eq("id", id)
      .maybeSingle();
    profile = data as typeof profile;
    if (!profile) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Look up auth identities so we can attach the LinkedIn-derived
    // profile URL + picture to the drawer. LinkedIn OIDC only gives
    // us the OIDC standard claims (sub, name, picture, email) — no
    // vanity URL. So we construct one URL using `sub` (resolves for
    // users without a custom vanity slug) and a name-search fallback
    // for the rest.
    const { data: authUser } = await service.auth.admin.getUserById(id);
    if (authUser?.user) {
      providers = [...new Set((authUser.user.identities ?? []).map((i) => i.provider))];
      const li = (authUser.user.identities ?? []).find((i) => i.provider === "linkedin_oidc");
      if (li) {
        const d = (li.identity_data ?? {}) as Record<string, unknown>;
        const sub = (d.sub as string | undefined) ?? null;
        const name = (d.name as string | undefined)
          ?? [d.given_name, d.family_name].filter(Boolean).join(" ")
          ?? null;
        linkedin = {
          sub,
          name,
          picture: (d.picture as string | undefined) ?? null,
          profile_url: sub ? `https://www.linkedin.com/in/${sub}` : "https://www.linkedin.com/",
          search_url: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(name ?? "")}`,
        };
      }
    }
  }

  // Build the interactions filter once
  const interactionsBase = service
    .from("interactions")
    .select("id, user_query, intent, response, model, session_id, web_search_used, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const { data: interactions } = isAnonymous
    ? await interactionsBase.is("user_id", null)
    : await interactionsBase.eq("user_id", id);

  // Brand documents
  const { data: brandDocs } = isAnonymous
    ? { data: [] as Array<{ id: string; filename: string; doc_type: string; total_chars: number; uploaded_at: string }> }
    : await service
        .from("brand_documents")
        .select("id, filename, doc_type, total_chars, uploaded_at")
        .eq("user_id", id)
        .order("uploaded_at", { ascending: false });

  // Safety incidents
  const { data: incidents } = isAnonymous
    ? await service
        .from("safety_incidents")
        .select("id, occurred_at, kind, severity, categories, excerpt, action_taken")
        .is("user_id", null)
        .order("occurred_at", { ascending: false })
        .limit(50)
    : await service
        .from("safety_incidents")
        .select("id, occurred_at, kind, severity, categories, excerpt, action_taken")
        .eq("user_id", id)
        .order("occurred_at", { ascending: false })
        .limit(50);

  // Feedback for this user's interactions
  const interactionIds = (interactions ?? []).map((i) => i.id);
  let feedbackByInteraction: Record<string, number> = {};
  if (interactionIds.length > 0) {
    const { data: fbs } = await service
      .from("feedbacks")
      .select("interaction_id, rating")
      .in("interaction_id", interactionIds);
    for (const f of fbs ?? []) {
      feedbackByInteraction[f.interaction_id as string] = f.rating as number;
    }
  }

  // Compute aggregates for the header strip
  const totalPrompts = interactions?.length ?? 0;
  const sessions = new Set((interactions ?? []).map((i) => i.session_id).filter(Boolean)).size;
  const models: Record<string, number> = {};
  const intents: Record<string, number> = {};
  let webSearchCount = 0;
  for (const i of interactions ?? []) {
    if (i.model) models[i.model as string] = (models[i.model as string] ?? 0) + 1;
    const it = (i.intent as string | null) ?? "general";
    intents[it] = (intents[it] ?? 0) + 1;
    if (i.web_search_used) webSearchCount++;
  }

  return NextResponse.json({
    profile: isAnonymous
      ? { id: "anonymous", email: null, created_at: null, is_anonymous: true }
      : profile,
    identity: isAnonymous ? null : { providers, linkedin },
    summary: {
      total_prompts: totalPrompts,
      sessions,
      models,
      intents,
      web_search_count: webSearchCount,
      brand_docs_count: brandDocs?.length ?? 0,
      safety_incidents_count: incidents?.length ?? 0,
    },
    interactions: (interactions ?? []).map((i) => ({
      ...i,
      user_rating: feedbackByInteraction[i.id] ?? null,
    })),
    brand_docs: brandDocs ?? [],
    safety_incidents: incidents ?? [],
  });
}
