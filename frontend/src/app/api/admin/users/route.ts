import { NextResponse } from "next/server";
import { createSupabaseServerClient, isAdminEmail } from "@/lib/supabase-server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

interface UserRow {
  id: string | null;
  email: string | null;
  signed_up: string | null;
  last_active: string | null;
  total_prompts: number;
  prompts_7d: number;
  prompts_24h: number;
  models_used: string[];
  top_intent: string | null;
  top_intent_count: number;
  brand_docs: number;
  safety_incidents: number;
  feedback_given: number;
  positive_rate: number;
  is_anonymous?: boolean;
  providers?: string[];
  linkedin_sub?: string | null;
  linkedin_name?: string | null;
  linkedin_picture?: string | null;
  linkedin_profile_url?: string | null;
  linkedin_search_url?: string | null;
}

// LinkedIn OIDC ("Sign In with LinkedIn") gives us standard OIDC claims
// only — sub, name, email, picture, locale. It does NOT include the
// vanity profile URL (that requires r_basicprofile, gated behind LinkedIn
// Partner Program). So we surface two URLs per LinkedIn user:
//   1. A direct attempt: linkedin.com/in/{sub} — resolves for users who
//      never set a custom vanity slug (their public id == sub).
//   2. A search fallback: linkedin.com/search/results/people/?keywords=…
//      pre-filled with the user's LinkedIn-provided name. Always opens
//      a usable result page, just one extra click.
interface LinkedInIdentity {
  sub: string | null;
  name: string | null;
  picture: string | null;
  profile_url: string;
  search_url: string;
}

function buildLinkedInIdentity(identityData: Record<string, unknown>): LinkedInIdentity {
  const sub = (identityData.sub as string | undefined) ?? null;
  const name = (identityData.name as string | undefined)
    ?? [identityData.given_name, identityData.family_name].filter(Boolean).join(" ")
    ?? null;
  const picture = (identityData.picture as string | undefined) ?? null;
  return {
    sub,
    name,
    picture,
    profile_url: sub ? `https://www.linkedin.com/in/${sub}` : "https://www.linkedin.com/",
    search_url: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(name ?? "")}`,
  };
}

export async function GET() {
  const supa = await createSupabaseServerClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = getSupabase();
  if (!service) return NextResponse.json({ error: "Supabase missing" }, { status: 503 });

  // Pull profiles + their interaction aggregates
  const { data: profiles } = await service
    .from("profiles")
    .select("id, email, created_at");

  // Pull every auth.user with their identities so we can surface which
  // provider(s) each user signed up with — LinkedIn especially, since
  // the admin wants a "View on LinkedIn" link in the user row.
  // listUsers is paginated to 1000/page which is plenty for now; revisit
  // when we cross that threshold (use materialized join table at that
  // point so we're not pulling auth.users on every admin refresh).
  const { data: { users: authUsers } } = await service.auth.admin.listUsers({ perPage: 1000 });
  const linkedinByUser = new Map<string, LinkedInIdentity>();
  const providersByUser = new Map<string, string[]>();
  for (const u of authUsers ?? []) {
    const provs: string[] = [];
    for (const ident of u.identities ?? []) {
      provs.push(ident.provider);
      if (ident.provider === "linkedin_oidc") {
        linkedinByUser.set(u.id, buildLinkedInIdentity(ident.identity_data ?? {}));
      }
    }
    if (provs.length > 0) providersByUser.set(u.id, [...new Set(provs)]);
  }

  // Pull all interactions for aggregation. With <10K rows this is fine;
  // when it grows we'll switch to materialized views.
  const { data: interactions } = await service
    .from("interactions")
    .select("id, user_id, user_email, intent, model, created_at, session_id");

  // Brand docs by user
  const { data: brandDocs } = await service
    .from("brand_documents")
    .select("user_id");

  // Safety incidents by user
  const { data: incidents } = await service
    .from("safety_incidents")
    .select("user_id, user_email");

  // Feedback joined to interaction's user_id
  const { data: feedbacks } = await service
    .from("feedbacks")
    .select("rating, interaction_id");

  const interactionUserMap = new Map<string, string | null>();
  for (const i of interactions ?? []) {
    interactionUserMap.set(i.id, (i.user_id as string | null) ?? null);
  }

  // Aggregate per user_id
  const userAgg: Record<string, {
    total: number; last7d: number; last24h: number;
    last_active: string | null; models: Set<string>;
    intents: Record<string, number>;
  }> = {};

  const now = Date.now();
  const day = 86400000;
  for (const i of interactions ?? []) {
    const key = (i.user_id as string | null) ?? "__anonymous__";
    if (!userAgg[key]) {
      userAgg[key] = { total: 0, last7d: 0, last24h: 0, last_active: null, models: new Set(), intents: {} };
    }
    const agg = userAgg[key];
    agg.total++;
    const createdAt = i.created_at as string;
    const age = now - new Date(createdAt).getTime();
    if (age <= 7 * day) agg.last7d++;
    if (age <= 1 * day) agg.last24h++;
    if (!agg.last_active || createdAt > agg.last_active) agg.last_active = createdAt;
    if (i.model) agg.models.add(i.model as string);
    const intent = (i.intent as string | null) ?? "general";
    agg.intents[intent] = (agg.intents[intent] ?? 0) + 1;
  }

  // Brand-doc counts by user_id
  const brandCount: Record<string, number> = {};
  for (const b of brandDocs ?? []) {
    const k = (b.user_id as string | null) ?? "__anonymous__";
    brandCount[k] = (brandCount[k] ?? 0) + 1;
  }

  // Safety counts
  const safetyCount: Record<string, number> = {};
  for (const s of incidents ?? []) {
    const k = (s.user_id as string | null) ?? "__anonymous__";
    safetyCount[k] = (safetyCount[k] ?? 0) + 1;
  }

  // Feedback per user_id (via interaction lookup)
  const feedbackAgg: Record<string, { total: number; positive: number }> = {};
  for (const f of feedbacks ?? []) {
    const interactionId = f.interaction_id as string;
    const userId = interactionUserMap.get(interactionId) ?? null;
    const k = userId ?? "__anonymous__";
    if (!feedbackAgg[k]) feedbackAgg[k] = { total: 0, positive: 0 };
    feedbackAgg[k].total++;
    if ((f.rating as number) === 1) feedbackAgg[k].positive++;
  }

  // Build rows for registered users
  const rows: UserRow[] = (profiles ?? []).map((p) => {
    const k = p.id as string;
    const agg = userAgg[k];
    const fb = feedbackAgg[k];
    const intents = agg?.intents ?? {};
    const top = Object.entries(intents).sort(([, a], [, b]) => b - a)[0];
    const li = linkedinByUser.get(k);
    return {
      id: k,
      email: (p.email as string | null) ?? null,
      signed_up: p.created_at as string,
      last_active: agg?.last_active ?? null,
      total_prompts: agg?.total ?? 0,
      prompts_7d: agg?.last7d ?? 0,
      prompts_24h: agg?.last24h ?? 0,
      models_used: agg ? [...agg.models] : [],
      top_intent: top?.[0] ?? null,
      top_intent_count: top?.[1] ?? 0,
      brand_docs: brandCount[k] ?? 0,
      safety_incidents: safetyCount[k] ?? 0,
      feedback_given: fb?.total ?? 0,
      positive_rate: fb && fb.total > 0 ? fb.positive / fb.total : 0,
      providers: providersByUser.get(k) ?? [],
      linkedin_sub: li?.sub ?? null,
      linkedin_name: li?.name ?? null,
      linkedin_picture: li?.picture ?? null,
      linkedin_profile_url: li?.profile_url ?? null,
      linkedin_search_url: li?.search_url ?? null,
    };
  });

  // Anonymous aggregate row
  const anon = userAgg["__anonymous__"];
  if (anon && anon.total > 0) {
    const intents = anon.intents;
    const top = Object.entries(intents).sort(([, a], [, b]) => b - a)[0];
    const fb = feedbackAgg["__anonymous__"];
    rows.push({
      id: null,
      email: null,
      signed_up: null,
      last_active: anon.last_active,
      total_prompts: anon.total,
      prompts_7d: anon.last7d,
      prompts_24h: anon.last24h,
      models_used: [...anon.models],
      top_intent: top?.[0] ?? null,
      top_intent_count: top?.[1] ?? 0,
      brand_docs: brandCount["__anonymous__"] ?? 0,
      safety_incidents: safetyCount["__anonymous__"] ?? 0,
      feedback_given: fb?.total ?? 0,
      positive_rate: fb && fb.total > 0 ? fb.positive / fb.total : 0,
      is_anonymous: true,
    });
  }

  // Sort: registered users by last_active desc (nulls last), anonymous always at bottom
  rows.sort((a, b) => {
    if (a.is_anonymous && !b.is_anonymous) return 1;
    if (!a.is_anonymous && b.is_anonymous) return -1;
    if (!a.last_active && !b.last_active) return 0;
    if (!a.last_active) return 1;
    if (!b.last_active) return -1;
    return b.last_active.localeCompare(a.last_active);
  });

  return NextResponse.json({
    total_registered: profiles?.length ?? 0,
    total_anonymous_prompts: anon?.total ?? 0,
    total_prompts_all: interactions?.length ?? 0,
    users: rows,
  });
}
