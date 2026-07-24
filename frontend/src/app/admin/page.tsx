"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, MessageSquare, ThumbsUp, ThumbsDown, Users, RefreshCw, Globe, ChevronRight, Search, Radar, ExternalLink, Clock, Brain, Zap, Activity, Shield, ShieldAlert, ShieldCheck, EyeOff, AlertTriangle, FileText, User as UserIcon, Mail, KeyRound, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Interaction {
  id: string;
  user_query: string;
  intent: string | null;
  response: string;
  model: string;
  user_email: string | null;
  web_search_used: boolean;
  created_at: string;
}

interface Stats {
  totals: { interactions: number; feedbacks: number; users: number };
  by_intent: { intent: string; count: number }[];
  by_user: { user_email: string; count: number; last_activity: string }[];
}

interface IntelItem {
  id: string;
  topic: string;
  category: string;
  asset_type: string | null;
  title: string;
  url: string;
  summary: string | null;
  source: string | null;
  scraped_at: string;
  converted_to_training: boolean;
}

interface IntelRunInfo {
  started_at: string;
  finished_at: string | null;
  items_added: number;
  items_skipped: number;
}

interface ConversionRunInfo {
  started_at: string;
  finished_at: string | null;
  intel_processed: number;
  pairs_created: number;
  pairs_skipped: number;
}

interface IntelBreakdown {
  [asset_type: string]: { total: number; converted: number; pending: number };
}

interface IntelTotals {
  intel_total: number;
  intel_pending_conversion: number;
  training_pairs_total: number;
  training_pairs_original?: number;
  training_pairs_evolved?: number;
}

interface LearningHealth {
  total_interactions: number;
  positive: number;
  negative: number;
  total_examples: number;
  examples_actually_used: number;
  total_retrievals: number;
  negative_patterns_logged: number;
  last_retrieval_at: string | null;
}
interface LearningExample {
  id: string;
  intent: string;
  query_summary: string;
  exemplar_response: string;
  score: number;
  usage_count: number;
  last_used_at: string | null;
  created_at: string;
}
interface NegativePattern {
  id: string;
  intent: string;
  query_text: string;
  reason: string | null;
  created_at: string;
}

interface SafetyHealth {
  total_incidents: number;
  last_24h: number;
  last_7d: number;
  input_unsafe: number;
  output_unsafe: number;
  prompt_injection: number;
  pii_redacted: number;
  high_severity: number;
  last_incident_at: string | null;
}
interface SafetyIncident {
  id: string;
  occurred_at: string;
  user_email: string | null;
  kind: "input_unsafe" | "output_unsafe" | "prompt_injection" | "pii_redacted";
  severity: "low" | "medium" | "high";
  categories: string[];
  excerpt: string | null;
  action_taken: string;
  model: string | null;
  metadata: Record<string, unknown>;
}

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

function LinkedInGlyph({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.852 3.37-1.852 3.601 0 4.267 2.37 4.267 5.455v6.288zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.063 2.063 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

interface UserDetail {
  profile: {
    id: string;
    email: string | null;
    created_at: string | null;
    is_anonymous?: boolean;
  } | null;
  identity?: {
    providers: string[];
    linkedin: {
      sub: string | null;
      name: string | null;
      picture: string | null;
      profile_url: string;
      search_url: string;
    } | null;
  } | null;
  summary: {
    total_prompts: number;
    sessions: number;
    models: Record<string, number>;
    intents: Record<string, number>;
    web_search_count: number;
    brand_docs_count: number;
    safety_incidents_count: number;
  };
  interactions: Array<{
    id: string;
    user_query: string;
    intent: string | null;
    response: string;
    model: string;
    session_id: string | null;
    web_search_used: boolean;
    created_at: string;
    user_rating: number | null;
  }>;
  brand_docs: Array<{ id: string; filename: string; doc_type: string; total_chars: number; uploaded_at: string }>;
  safety_incidents: Array<{ id: string; occurred_at: string; kind: string; severity: string; categories: string[]; excerpt: string | null; action_taken: string }>;
}

interface AdminApiKey {
  id: string;
  user_id: string;
  user_email: string | null;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  created_at: string;
  revoked_at: string | null;
}

interface AdminApiKeySummary {
  total: number;
  active: number;
  revoked: number;
  used_last_7d: number;
}

export default function AdminPage() {
  const [tab, setTab] = useState<"prompts" | "users" | "intel" | "learning" | "safety" | "apikeys">("prompts");
  const [stats, setStats] = useState<Stats | null>(null);
  const [items, setItems] = useState<Interaction[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [emailFilter, setEmailFilter] = useState("");
  const [intentFilter, setIntentFilter] = useState("");
  const [selected, setSelected] = useState<Interaction | null>(null);

  // Intel state
  const [intel, setIntel] = useState<IntelItem[]>([]);
  const [intelCategory, setIntelCategory] = useState("");
  const [intelAssetType, setIntelAssetType] = useState("");
  const [lastRun, setLastRun] = useState<IntelRunInfo | null>(null);
  const [lastConversion, setLastConversion] = useState<ConversionRunInfo | null>(null);
  const [breakdown, setBreakdown] = useState<IntelBreakdown>({});
  const [intelTotals, setIntelTotals] = useState<IntelTotals | null>(null);
  const [scraping, setScraping] = useState(false);
  const [converting, setConverting] = useState(false);

  // Learning state
  const [learningHealth, setLearningHealth] = useState<LearningHealth | null>(null);
  const [learningExamples, setLearningExamples] = useState<LearningExample[]>([]);
  const [negativePatterns, setNegativePatterns] = useState<NegativePattern[]>([]);

  // Safety state
  const [safetyHealth, setSafetyHealth] = useState<SafetyHealth | null>(null);
  const [safetyIncidents, setSafetyIncidents] = useState<SafetyIncident[]>([]);
  const [safetyKindFilter, setSafetyKindFilter] = useState<string>("");

  // Users tab state
  const [users, setUsers] = useState<UserRow[]>([]);
  const [usersSummary, setUsersSummary] = useState<{ total_registered: number; total_anonymous_prompts: number; total_prompts_all: number } | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [loadingUserDetail, setLoadingUserDetail] = useState(false);

  // API Keys tab state — global view of every user's issued keys so
  // admin can spot suspicious activity + revoke without waiting on
  // the owner to log in.
  const [apiKeys, setApiKeys] = useState<AdminApiKey[]>([]);
  const [apiKeysSummary, setApiKeysSummary] = useState<AdminApiKeySummary | null>(null);

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "100" });
    if (emailFilter) params.set("email", emailFilter);
    if (intentFilter) params.set("intent", intentFilter);
    const [statsRes, itemsRes] = await Promise.all([
      fetch("/api/admin/stats").then((r) => r.json()),
      fetch(`/api/admin/interactions?${params}`).then((r) => r.json()),
    ]);
    setStats(statsRes);
    setItems(itemsRes.items ?? []);
    setTotal(itemsRes.total ?? 0);
    setLoading(false);
  };

  const loadIntel = async () => {
    const params = new URLSearchParams({ limit: "100" });
    if (intelCategory) params.set("category", intelCategory);
    if (intelAssetType) params.set("asset_type", intelAssetType);
    const res = await fetch(`/api/admin/intel?${params}`).then((r) => r.json());
    setIntel(res.items ?? []);
    setLastRun(res.last_run ?? null);
    setLastConversion(res.last_conversion ?? null);
    setBreakdown(res.breakdown ?? {});
    setIntelTotals(res.totals ?? null);
  };

  const triggerScrape = async () => {
    setScraping(true);
    // Fire all 4 slices in parallel so we cover the full 130+ topic set
    await Promise.all([
      fetch("/api/cron/scrape-intel?slice=0", { method: "GET" }),
      fetch("/api/cron/scrape-intel?slice=1", { method: "GET" }),
      fetch("/api/cron/scrape-intel?slice=2", { method: "GET" }),
      fetch("/api/cron/scrape-intel?slice=3", { method: "GET" }),
    ]);
    await loadIntel();
    setScraping(false);
  };

  const triggerConvert = async () => {
    setConverting(true);
    await fetch("/api/cron/convert-pairs?limit=50", { method: "GET" });
    await loadIntel();
    setConverting(false);
  };

  const loadLearning = async () => {
    const res = await fetch("/api/admin/learning").then((r) => r.json());
    setLearningHealth(res.health);
    setLearningExamples(res.examples ?? []);
    setNegativePatterns(res.negatives ?? []);
  };

  const loadSafety = async () => {
    const params = new URLSearchParams({ limit: "100" });
    if (safetyKindFilter) params.set("kind", safetyKindFilter);
    const res = await fetch(`/api/admin/safety?${params}`).then((r) => r.json());
    setSafetyHealth(res.health ?? null);
    setSafetyIncidents(res.incidents ?? []);
  };

  const loadUsers = async () => {
    const res = await fetch("/api/admin/users").then((r) => r.json());
    setUsers(res.users ?? []);
    setUsersSummary({
      total_registered: res.total_registered ?? 0,
      total_anonymous_prompts: res.total_anonymous_prompts ?? 0,
      total_prompts_all: res.total_prompts_all ?? 0,
    });
  };

  const openUserDetail = async (userId: string | null) => {
    setLoadingUserDetail(true);
    setSelectedUser(null);
    try {
      const path = userId ?? "anonymous";
      const res = await fetch(`/api/admin/users/${path}`).then((r) => r.json());
      setSelectedUser(res);
    } catch (err) {
      console.error("user detail load failed:", err);
    } finally {
      setLoadingUserDetail(false);
    }
  };

  const loadApiKeys = async () => {
    try {
      const res = await fetch("/api/admin/api-keys").then((r) => r.json());
      setApiKeys(res.keys ?? []);
      setApiKeysSummary(res.summary ?? null);
    } catch (err) {
      console.error("apikeys load failed:", err);
    }
  };

  const revokeApiKey = async (id: string) => {
    if (!confirm("Revoke this API key? Any third-party app using it will stop working immediately.")) return;
    try {
      const res = await fetch(`/api/admin/api-keys/${id}`, { method: "DELETE" });
      if (res.ok) {
        void loadApiKeys();
      } else {
        const j = await res.json().catch(() => ({}));
        alert(j.error ?? "Revoke failed");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Revoke failed");
    }
  };

  useEffect(() => { load(); loadIntel(); loadLearning(); loadSafety(); loadUsers(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (tab === "intel") loadIntel(); }, [intelCategory, intelAssetType]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (tab === "learning") loadLearning(); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (tab === "safety") loadSafety(); }, [tab, safetyKindFilter]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (tab === "users") loadUsers(); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (tab === "apikeys") loadApiKeys(); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen" style={{ background: "var(--reverb-bg-app)" }}>
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-[var(--reverb-border-soft)] bg-white/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-3.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link href="/" className="flex items-center gap-1.5 text-[12.5px] text-[var(--reverb-text-secondary)] hover:text-[var(--reverb-text-primary)] transition-colors shrink-0">
              <ArrowLeft size={15} />
              <span className="hidden sm:inline">Back to chat</span>
            </Link>
            <span className="h-4 w-px bg-[var(--reverb-border-soft)] hidden sm:block" />
            <Image src="/reverb-logo.png" alt="Reverb" width={100} height={32} className="h-6 sm:h-7 w-auto" />
            <span className="text-[9.5px] sm:text-[10px] font-bold tracking-[0.12em] text-[var(--reverb-accent)] uppercase px-1.5 sm:px-2 py-0.5 rounded-md shrink-0" style={{ background: "rgba(193,74,42,0.1)" }}>
              Admin
            </span>
          </div>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-[13px] font-medium text-[var(--reverb-text-secondary)] transition-all duration-200 hover:bg-white hover:shadow-[var(--reverb-shadow-sm)] hover:text-[var(--reverb-text-primary)] active:scale-95 shrink-0">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Headline */}
        <div className="mb-5 reverb-fade-in">
          <h1 className="text-[22px] sm:text-[28px] font-semibold tracking-tight text-[var(--reverb-text-primary)]">Admin Dashboard</h1>
          <p className="text-[12.5px] sm:text-[13.5px] text-[var(--reverb-text-secondary)] mt-1">All user activity + live marketing intel. Visible only to admins.</p>
        </div>

        {/* Tabs — horizontally scrollable on mobile so all 5 fit any screen.
            Labels shorten on small screens, scrollbar hidden via utility class. */}
        <div className="flex items-center gap-0.5 sm:gap-1 mb-6 border-b border-[var(--reverb-border-soft)] overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 reverb-no-scrollbar">
          {[
            { key: "prompts" as const, label: "User Prompts", short: "Prompts", icon: MessageSquare },
            { key: "users" as const, label: "Users", short: "Users", icon: Users },
            { key: "intel" as const, label: "Marketing Intel", short: "Intel", icon: Radar },
            { key: "learning" as const, label: "Self-Learning", short: "Learning", icon: Brain },
            { key: "safety" as const, label: "Safety", short: "Safety", icon: Shield },
            { key: "apikeys" as const, label: "API Keys", short: "API", icon: KeyRound },
          ].map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={cn(
                "flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 sm:py-2.5 -mb-px text-[12px] sm:text-[13px] font-semibold border-b-2 transition-all duration-200 shrink-0 whitespace-nowrap",
                tab === t.key
                  ? "text-[var(--reverb-accent)] border-[var(--reverb-accent)]"
                  : "text-[var(--reverb-text-secondary)] border-transparent hover:text-[var(--reverb-text-primary)]"
              )}>
              <t.icon size={13} strokeWidth={2.2} />
              <span className="sm:hidden">{t.short}</span>
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {tab === "prompts" ? (
        <>
        {/* KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-7">
          <StatCard label="Total prompts" value={stats?.totals.interactions ?? "—"} icon={MessageSquare} accent="from-violet-500 to-fuchsia-500" />
          <StatCard label="Feedbacks received" value={stats?.totals.feedbacks ?? "—"} icon={ThumbsUp} accent="from-emerald-500 to-teal-500" />
          <StatCard label="Registered users" value={stats?.totals.users ?? "—"} icon={Users} accent="from-amber-500 to-orange-500" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 mb-6 sm:mb-7">
          {/* Top intents */}
          <div className="rounded-2xl p-5" style={{ background: "var(--reverb-gradient-card)", border: "1px solid var(--reverb-border-soft)", boxShadow: "var(--reverb-shadow-md)" }}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--reverb-text-tertiary)] mb-3">Top intents</p>
            <div className="flex flex-col gap-2">
              {(stats?.by_intent ?? []).slice(0, 7).map((b) => (
                <div key={b.intent} className="flex items-center justify-between text-[13px]">
                  <span className="text-[var(--reverb-text-primary)] font-medium">{b.intent.replace("_", " ")}</span>
                  <span className="text-[var(--reverb-text-secondary)] font-mono">{b.count}</span>
                </div>
              ))}
              {(stats?.by_intent ?? []).length === 0 && <p className="text-[12px] text-[var(--reverb-text-tertiary)]">No data yet</p>}
            </div>
          </div>

          {/* Top users */}
          <div className="md:col-span-2 rounded-2xl p-5" style={{ background: "var(--reverb-gradient-card)", border: "1px solid var(--reverb-border-soft)", boxShadow: "var(--reverb-shadow-md)" }}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--reverb-text-tertiary)] mb-3">Most active users</p>
            <div className="flex flex-col gap-1.5">
              {(stats?.by_user ?? []).slice(0, 7).map((b) => (
                <button key={b.user_email} onClick={() => setEmailFilter(b.user_email)}
                  className="flex items-center justify-between gap-3 text-[13px] py-1.5 px-2 rounded-lg hover:bg-[#faf6ef] transition-colors text-left">
                  <span className="text-[var(--reverb-text-primary)] font-medium truncate">{b.user_email}</span>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[var(--reverb-text-secondary)] font-mono">{b.count}</span>
                    <span className="text-[11px] text-[var(--reverb-text-tertiary)]">
                      {new Date(b.last_activity).toLocaleDateString()}
                    </span>
                  </div>
                </button>
              ))}
              {(stats?.by_user ?? []).length === 0 && <p className="text-[12px] text-[var(--reverb-text-tertiary)]">No data yet</p>}
            </div>
          </div>
        </div>

        {/* Interactions table */}
        <div className="rounded-2xl overflow-hidden" style={{ background: "var(--reverb-gradient-card)", border: "1px solid var(--reverb-border-soft)", boxShadow: "var(--reverb-shadow-md)" }}>
          <div className="px-4 sm:px-5 py-3.5 border-b border-[var(--reverb-border-soft)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-[13.5px] font-semibold text-[var(--reverb-text-primary)]">
              All prompts <span className="text-[var(--reverb-text-tertiary)] font-normal">· {total}</span>
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 sm:flex-initial min-w-[140px]">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--reverb-text-tertiary)]" />
                <input value={emailFilter} onChange={(e) => setEmailFilter(e.target.value)} placeholder="Filter by email…" onKeyDown={(e) => e.key === "Enter" && load()}
                  className="h-8 w-full sm:w-44 pl-7 pr-2.5 rounded-md text-[12px] bg-white border border-[var(--reverb-border-soft)] focus:outline-none focus:border-[var(--reverb-accent)]" />
              </div>
              <select value={intentFilter} onChange={(e) => { setIntentFilter(e.target.value); }}
                className="h-8 px-2 rounded-md text-[12px] bg-white border border-[var(--reverb-border-soft)] focus:outline-none focus:border-[var(--reverb-accent)]">
                <option value="">All intents</option>
                <option value="ad_copy">Ad copy</option>
                <option value="email">Email</option>
                <option value="trend">Trend</option>
                <option value="strategy">Strategy</option>
                <option value="competitor">Competitor</option>
                <option value="brand_voice">Brand voice</option>
                <option value="seo">SEO</option>
                <option value="aeo_geo">AEO / GEO</option>
                <option value="abm">ABM</option>
                <option value="buyer_signals">Buyer signals</option>
                <option value="company_signals">Company signals</option>
                <option value="orm">ORM</option>
                <option value="general">General</option>
              </select>
              <button onClick={load} className="h-8 px-3 rounded-md text-[12px] reverb-btn-primary font-semibold">Apply</button>
            </div>
          </div>
          <div className="max-h-[600px] overflow-y-auto reverb-scroll">
            {items.length === 0 && !loading && (
              <p className="text-center text-[13px] text-[var(--reverb-text-tertiary)] py-12">No prompts match.</p>
            )}
            {items.map((item) => (
              <button key={item.id} onClick={() => setSelected(item)}
                className="w-full px-4 sm:px-5 py-3 sm:py-3.5 border-b border-[var(--reverb-border-soft)] last:border-0 hover:bg-[#faf6ef] transition-colors text-left flex items-center gap-3 sm:gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 sm:gap-2 mb-1 flex-wrap">
                    <span className="text-[11.5px] font-semibold text-[var(--reverb-text-primary)] truncate max-w-[160px]">{item.user_email ?? "anonymous"}</span>
                    {item.intent && (
                      <span className="text-[9.5px] sm:text-[10px] px-1.5 py-0.5 rounded-md bg-[#f5f1ea] text-[var(--reverb-text-secondary)] font-medium uppercase tracking-wide">
                        {item.intent.replace("_", " ")}
                      </span>
                    )}
                    {item.web_search_used && <Globe size={10} className="text-blue-500" />}
                    <span className="text-[10px] sm:text-[10.5px] text-[var(--reverb-text-tertiary)] sm:ml-auto">
                      {new Date(item.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-[12.5px] sm:text-[13px] text-[var(--reverb-text-primary)] line-clamp-1">{item.user_query}</p>
                </div>
                <ChevronRight size={14} className="text-[var(--reverb-text-tertiary)] shrink-0" />
              </button>
            ))}
          </div>
        </div>
        </>
        ) : tab === "users" ? (
          <UsersPanel
            users={users}
            summary={usersSummary}
            onOpen={openUserDetail}
            onRefresh={loadUsers}
          />
        ) : tab === "intel" ? (
          <IntelPanel
            intel={intel}
            lastRun={lastRun}
            lastConversion={lastConversion}
            breakdown={breakdown}
            totals={intelTotals}
            intelCategory={intelCategory}
            setIntelCategory={setIntelCategory}
            intelAssetType={intelAssetType}
            setIntelAssetType={setIntelAssetType}
            triggerScrape={triggerScrape}
            triggerConvert={triggerConvert}
            scraping={scraping}
            converting={converting}
          />
        ) : tab === "learning" ? (
          <LearningPanel
            health={learningHealth}
            examples={learningExamples}
            negatives={negativePatterns}
            onRefresh={loadLearning}
          />
        ) : tab === "safety" ? (
          <SafetyPanel
            health={safetyHealth}
            incidents={safetyIncidents}
            kindFilter={safetyKindFilter}
            setKindFilter={setSafetyKindFilter}
            onRefresh={loadSafety}
          />
        ) : (
          <ApiKeysPanel
            keys={apiKeys}
            summary={apiKeysSummary}
            onRefresh={loadApiKeys}
            onRevoke={revokeApiKey}
          />
        )}
      </main>

      {/* User detail drawer */}
      {(selectedUser || loadingUserDetail) && (
        <UserDetailDrawer
          detail={selectedUser}
          loading={loadingUserDetail}
          onClose={() => { setSelectedUser(null); setLoadingUserDetail(false); }}
          onOpenPrompt={(interaction) => {
            setSelected({
              id: interaction.id,
              user_query: interaction.user_query,
              intent: interaction.intent,
              response: interaction.response,
              model: interaction.model,
              user_email: selectedUser?.profile?.email ?? null,
              web_search_used: interaction.web_search_used,
              created_at: interaction.created_at,
            });
          }}
        />
      )}

      {/* Detail drawer */}
      {selected && (
        <div className="fixed inset-0 z-30 flex items-end sm:items-center justify-center px-0 sm:px-4 reverb-fade-in" onClick={() => setSelected(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative max-w-3xl w-full max-h-[85vh] sm:max-h-[80vh] rounded-t-2xl sm:rounded-2xl overflow-hidden reverb-scale-in"
            style={{ background: "var(--reverb-gradient-card)", boxShadow: "var(--reverb-shadow-xl)", border: "1px solid var(--reverb-border-soft)" }}
            onClick={(e) => e.stopPropagation()}>
            <div className="px-4 sm:px-5 py-3 sm:py-3.5 border-b border-[var(--reverb-border-soft)] flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 sm:gap-2 text-[11.5px] sm:text-[12.5px] min-w-0 flex-wrap">
                <span className="font-semibold text-[var(--reverb-text-primary)] truncate">{selected.user_email ?? "anonymous"}</span>
                <span className="text-[var(--reverb-text-tertiary)]">·</span>
                <span className="text-[var(--reverb-text-secondary)]">{selected.intent ?? "general"}</span>
                <span className="text-[var(--reverb-text-tertiary)] hidden sm:inline">·</span>
                <span className="text-[var(--reverb-text-tertiary)] hidden sm:inline">{selected.model}</span>
                <span className="text-[var(--reverb-text-tertiary)] hidden md:inline">·</span>
                <span className="text-[var(--reverb-text-tertiary)] hidden md:inline">{new Date(selected.created_at).toLocaleString()}</span>
              </div>
              <button onClick={() => setSelected(null)} className="text-[var(--reverb-text-secondary)] hover:text-[var(--reverb-text-primary)] text-sm font-medium shrink-0">Close</button>
            </div>
            <div className="px-4 sm:px-5 py-4 overflow-y-auto reverb-scroll" style={{ maxHeight: "calc(85vh - 60px)" }}>
              <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--reverb-text-tertiary)] mb-1.5">Prompt</p>
              <p className="text-[13.5px] sm:text-[14px] text-[var(--reverb-text-primary)] mb-5 whitespace-pre-wrap leading-relaxed">{selected.user_query}</p>
              <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--reverb-text-tertiary)] mb-1.5">Response</p>
              <p className="text-[13px] sm:text-[13.5px] text-[var(--reverb-text-secondary)] whitespace-pre-wrap leading-[1.7]">{selected.response}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, accent }: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ size: number; className?: string; strokeWidth?: number }>;
  accent: string;
}) {
  return (
    <div className="relative p-5 rounded-2xl overflow-hidden reverb-card">
      <div className={`absolute -top-12 -right-12 w-32 h-32 rounded-full bg-gradient-to-br ${accent} opacity-20 blur-2xl`} />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--reverb-text-tertiary)] mb-1.5">{label}</p>
          <p className="text-[30px] font-medium text-[var(--reverb-text-primary)] tracking-tight">{value}</p>
        </div>
        <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${accent} flex items-center justify-center`} style={{ boxShadow: "var(--reverb-shadow-xs)" }}>
          <Icon size={16} className="text-white" strokeWidth={2.2} />
        </div>
      </div>
    </div>
  );
}

const INTEL_CATEGORIES = [
  { value: "", label: "All categories" },
  { value: "seo", label: "SEO" },
  { value: "aeo_geo", label: "AEO / GEO" },
  { value: "abm", label: "ABM" },
  { value: "buyer_signals", label: "Buyer signals" },
  { value: "company_signals", label: "Company signals" },
  { value: "orm", label: "ORM" },
  { value: "ad_copy", label: "Ad copy" },
  { value: "email", label: "Email" },
  { value: "trend", label: "Trends" },
  { value: "demand_gen", label: "Demand gen" },
  { value: "analytics", label: "Analytics" },
  { value: "competitor", label: "Competitor" },
];

function LearningPanel({
  health, examples, negatives, onRefresh,
}: {
  health: LearningHealth | null;
  examples: LearningExample[];
  negatives: NegativePattern[];
  onRefresh: () => void;
}) {
  const positiveRate = health
    ? ((health.positive / Math.max(1, health.positive + health.negative)) * 100).toFixed(0)
    : "—";
  const retrievalRate = health
    ? ((health.examples_actually_used / Math.max(1, health.total_examples)) * 100).toFixed(0)
    : "—";

  return (
    <>
      {/* Header strip */}
      <div className="rounded-2xl p-4 sm:p-5 mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        style={{ background: "var(--reverb-gradient-card)", border: "1px solid var(--reverb-border-soft)", boxShadow: "var(--reverb-shadow-md)" }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "var(--reverb-gradient-accent)", boxShadow: "var(--reverb-shadow-accent)" }}>
            <Brain size={17} className="text-white" />
          </div>
          <div>
            <p className="text-[13.5px] font-semibold text-[var(--reverb-text-primary)]">Self-Learning Loop</p>
            <p className="text-[11.5px] text-[var(--reverb-text-secondary)] mt-0.5">
              Thumbs-up promotes responses to retrieval examples. Thumbs-down logs patterns to avoid.
              Retrieval ranks by query similarity + score + recency.
            </p>
          </div>
        </div>
        <button onClick={onRefresh}
          className="h-9 px-3 rounded-lg text-[12.5px] font-semibold text-[var(--reverb-text-secondary)] hover:bg-white hover:shadow-[var(--reverb-shadow-sm)] hover:text-[var(--reverb-text-primary)] flex items-center gap-2 shrink-0">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <MiniStat label="Interactions" value={health?.total_interactions ?? "—"} icon={Activity} accent="violet" />
        <MiniStat label="👍 Approval rate" value={`${positiveRate}%`} icon={ThumbsUp} accent="emerald" />
        <MiniStat label="Examples in use" value={`${retrievalRate}%`} icon={Zap} accent="amber" />
        <MiniStat label="Patterns to avoid" value={health?.negative_patterns_logged ?? "—"} icon={ThumbsDown} accent="rose" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Positive examples */}
        <div className="rounded-2xl overflow-hidden" style={{ background: "var(--reverb-gradient-card)", border: "1px solid var(--reverb-border-soft)", boxShadow: "var(--reverb-shadow-md)" }}>
          <div className="px-4 py-3 border-b border-[var(--reverb-border-soft)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ThumbsUp size={13} className="text-emerald-600" />
              <p className="text-[13.5px] font-semibold text-[var(--reverb-text-primary)]">High-rated examples · {examples.length}</p>
            </div>
            <span className="text-[10.5px] text-[var(--reverb-text-tertiary)]">Used in future similar queries</span>
          </div>
          <div className="max-h-[500px] overflow-y-auto reverb-scroll">
            {examples.length === 0 && (
              <p className="text-center text-[12.5px] text-[var(--reverb-text-tertiary)] py-10">
                No high-rated examples yet. Thumbs-up responses you like.
              </p>
            )}
            {examples.map((ex) => (
              <div key={ex.id} className="px-4 py-3 border-b border-[var(--reverb-border-soft)] last:border-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[9.5px] px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-semibold uppercase tracking-wide">
                    {ex.intent.replace("_", " ")}
                  </span>
                  <span className="text-[10.5px] font-mono text-[var(--reverb-text-tertiary)]">
                    score {ex.score} · used {ex.usage_count}×
                  </span>
                  <span className="text-[10.5px] text-[var(--reverb-text-tertiary)] ml-auto">
                    {new Date(ex.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </span>
                </div>
                <p className="text-[12.5px] text-[var(--reverb-text-primary)] line-clamp-2">{ex.query_summary}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Negative patterns */}
        <div className="rounded-2xl overflow-hidden" style={{ background: "var(--reverb-gradient-card)", border: "1px solid var(--reverb-border-soft)", boxShadow: "var(--reverb-shadow-md)" }}>
          <div className="px-4 py-3 border-b border-[var(--reverb-border-soft)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ThumbsDown size={13} className="text-rose-500" />
              <p className="text-[13.5px] font-semibold text-[var(--reverb-text-primary)]">Patterns to avoid · {negatives.length}</p>
            </div>
            <span className="text-[10.5px] text-[var(--reverb-text-tertiary)]">Future responses steer clear</span>
          </div>
          <div className="max-h-[500px] overflow-y-auto reverb-scroll">
            {negatives.length === 0 && (
              <p className="text-center text-[12.5px] text-[var(--reverb-text-tertiary)] py-10">
                No flagged patterns yet. Thumbs-down responses that miss the mark.
              </p>
            )}
            {negatives.map((n) => (
              <div key={n.id} className="px-4 py-3 border-b border-[var(--reverb-border-soft)] last:border-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[9.5px] px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-700 font-semibold uppercase tracking-wide">
                    {n.intent.replace("_", " ")}
                  </span>
                  <span className="text-[10.5px] text-[var(--reverb-text-tertiary)] ml-auto">
                    {new Date(n.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </span>
                </div>
                <p className="text-[12.5px] text-[var(--reverb-text-primary)] line-clamp-2">{n.query_text}</p>
                {n.reason && (
                  <p className="text-[11px] text-[var(--reverb-text-tertiary)] mt-1 italic">— {n.reason}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function MiniStat({ label, value, icon: Icon, accent }: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ size: number; className?: string; strokeWidth?: number }>;
  accent: "violet" | "emerald" | "amber" | "rose";
}) {
  const colors: Record<typeof accent, { bg: string; text: string }> = {
    violet:  { bg: "from-violet-500/15 to-fuchsia-500/15",  text: "text-violet-700" },
    emerald: { bg: "from-emerald-500/15 to-teal-500/15",    text: "text-emerald-700" },
    amber:   { bg: "from-amber-500/15 to-orange-500/15",    text: "text-amber-700" },
    rose:    { bg: "from-rose-500/15 to-red-500/15",        text: "text-rose-700" },
  };
  return (
    <div className="relative p-4 rounded-2xl overflow-hidden reverb-card">
      <div className={`absolute -top-8 -right-8 w-24 h-24 rounded-full bg-gradient-to-br ${colors[accent].bg} blur-2xl pointer-events-none`} />
      <div className="relative flex items-start justify-between gap-2">
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-[var(--reverb-text-tertiary)] mb-1">{label}</p>
          <p className="text-[22px] font-semibold text-[var(--reverb-text-primary)] tracking-tight">{value}</p>
        </div>
        <Icon size={14} className={colors[accent].text} strokeWidth={2.2} />
      </div>
    </div>
  );
}

const ASSET_TYPE_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  article:     { label: "Articles",     emoji: "📰", color: "bg-blue-50 text-blue-700" },
  whitepaper:  { label: "Whitepapers",  emoji: "📄", color: "bg-indigo-50 text-indigo-700" },
  ebook:       { label: "Ebooks",       emoji: "📘", color: "bg-violet-50 text-violet-700" },
  playbook:    { label: "Playbooks",    emoji: "📋", color: "bg-fuchsia-50 text-fuchsia-700" },
  case_study:  { label: "Case studies", emoji: "🏆", color: "bg-emerald-50 text-emerald-700" },
  social_post: { label: "Social posts", emoji: "💬", color: "bg-pink-50 text-pink-700" },
  ad_campaign: { label: "Ad campaigns", emoji: "🎯", color: "bg-orange-50 text-orange-700" },
  report:      { label: "Reports",      emoji: "📊", color: "bg-cyan-50 text-cyan-700" },
  newsletter:  { label: "Newsletters",  emoji: "📧", color: "bg-amber-50 text-amber-700" },
  podcast:     { label: "Podcasts",     emoji: "🎙️", color: "bg-purple-50 text-purple-700" },
  video:       { label: "Videos",       emoji: "🎬", color: "bg-red-50 text-red-700" },
  template:    { label: "Templates",    emoji: "🧩", color: "bg-teal-50 text-teal-700" },
  guide:       { label: "Guides",       emoji: "📗", color: "bg-lime-50 text-lime-700" },
};

const ASSET_TYPE_FILTERS = [
  { value: "", label: "All asset types" },
  ...Object.entries(ASSET_TYPE_LABELS).map(([value, v]) => ({ value, label: `${v.emoji} ${v.label}` })),
];

function IntelPanel({
  intel,
  lastRun,
  lastConversion,
  breakdown,
  totals,
  intelCategory,
  setIntelCategory,
  intelAssetType,
  setIntelAssetType,
  triggerScrape,
  triggerConvert,
  scraping,
  converting,
}: {
  intel: IntelItem[];
  lastRun: IntelRunInfo | null;
  lastConversion: ConversionRunInfo | null;
  breakdown: IntelBreakdown;
  totals: IntelTotals | null;
  intelCategory: string;
  setIntelCategory: (v: string) => void;
  intelAssetType: string;
  setIntelAssetType: (v: string) => void;
  triggerScrape: () => void;
  triggerConvert: () => void;
  scraping: boolean;
  converting: boolean;
}) {
  return (
    <>
      {/* Automation status strip */}
      <div className="rounded-2xl p-4 sm:p-5 mb-5"
        style={{ background: "var(--reverb-gradient-card)", border: "1px solid var(--reverb-border-soft)", boxShadow: "var(--reverb-shadow-md)" }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "var(--reverb-gradient-accent)", boxShadow: "var(--reverb-shadow-accent)" }}>
              <Radar size={17} className="text-white" />
            </div>
            <div>
              <p className="text-[13.5px] font-semibold text-[var(--reverb-text-primary)] flex items-center gap-2">
                Fully-automated marketing intel pipeline
                <span className="inline-flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
                </span>
              </p>
              <p className="text-[11.5px] text-[var(--reverb-text-secondary)] mt-0.5">
                Tavily scrapes 130+ marketing queries across <strong>13 asset types</strong> every 6 hours.
                Groq converts new intel → training pairs every 6 hours, feeding the Tuned model.
              </p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={triggerScrape} disabled={scraping}
              className="h-9 px-3.5 rounded-lg reverb-btn-primary text-[12.5px] font-semibold flex items-center justify-center gap-2">
              {scraping ? <><RefreshCw size={13} className="animate-spin" /> Scraping…</> : <><Radar size={13} /> Scrape now</>}
            </button>
            <button onClick={triggerConvert} disabled={converting}
              className="h-9 px-3.5 rounded-lg text-[12.5px] font-semibold flex items-center justify-center gap-2 bg-white border border-[var(--reverb-border-soft)] hover:bg-[#faf6ef] text-[var(--reverb-text-primary)]">
              {converting ? <><RefreshCw size={13} className="animate-spin" /> Converting…</> : <><Brain size={13} /> Convert now</>}
            </button>
          </div>
        </div>

        {/* Pipeline KPIs — text sizes shrink on mobile so 3-col layout
            stays readable at 320px. Subtitle wraps to new line via flex-col. */}
        {totals && (
          <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-4 pt-4 border-t border-[var(--reverb-border-soft)]">
            <div className="text-center">
              <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-[var(--reverb-text-tertiary)] leading-tight">Intel scraped</p>
              <p className="text-[16px] sm:text-[22px] font-semibold text-[var(--reverb-text-primary)] tracking-tight mt-0.5">{totals.intel_total.toLocaleString()}</p>
            </div>
            <div className="text-center">
              <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-[var(--reverb-text-tertiary)] leading-tight">Pending convert</p>
              <p className="text-[16px] sm:text-[22px] font-semibold text-amber-600 tracking-tight mt-0.5">{totals.intel_pending_conversion.toLocaleString()}</p>
            </div>
            <div className="text-center">
              <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-[var(--reverb-text-tertiary)] leading-tight">Training pairs</p>
              <p className="text-[16px] sm:text-[22px] font-semibold text-emerald-600 tracking-tight mt-0.5">{totals.training_pairs_total.toLocaleString()}</p>
              {(totals.training_pairs_original ?? 0) > 0 && (
                <p className="text-[9px] sm:text-[10px] text-[var(--reverb-text-tertiary)] mt-0.5 leading-tight">
                  <span className="text-emerald-700 font-semibold">{(totals.training_pairs_original ?? 0).toLocaleString()}</span> orig
                  {(totals.training_pairs_evolved ?? 0) > 0 && (
                    <> · <span className="text-violet-700 font-semibold">{(totals.training_pairs_evolved ?? 0).toLocaleString()}</span> evolved</>
                  )}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Asset type breakdown */}
      {Object.keys(breakdown).length > 0 && (
        <div className="rounded-2xl p-4 mb-5"
          style={{ background: "var(--reverb-gradient-card)", border: "1px solid var(--reverb-border-soft)", boxShadow: "var(--reverb-shadow-md)" }}>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--reverb-text-tertiary)] mb-3">Coverage by asset type</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
            {Object.entries(ASSET_TYPE_LABELS).map(([k, meta]) => {
              const stats = breakdown[k] ?? { total: 0, converted: 0, pending: 0 };
              const pct = stats.total > 0 ? Math.round((stats.converted / stats.total) * 100) : 0;
              const isActive = intelAssetType === k;
              return (
                <button key={k} onClick={() => setIntelAssetType(isActive ? "" : k)}
                  className={cn(
                    "text-left p-2.5 rounded-xl border transition-all duration-150",
                    isActive
                      ? "border-[var(--reverb-accent)] bg-[#fef9f3]"
                      : "border-[var(--reverb-border-soft)] bg-white hover:bg-[#faf6ef]"
                  )}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[13px]">{meta.emoji}</span>
                    <span className="text-[11.5px] font-semibold text-[var(--reverb-text-primary)] truncate">{meta.label}</span>
                  </div>
                  <p className="text-[16px] font-semibold text-[var(--reverb-text-primary)] leading-none">{stats.total}</p>
                  <div className="mt-1.5 flex items-center gap-1.5 text-[10px]">
                    <div className="flex-1 h-1 rounded-full bg-[#f0e7d8] overflow-hidden">
                      <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[var(--reverb-text-tertiary)] font-mono">{pct}%</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Run metadata + filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex flex-col gap-1 text-[11.5px] text-[var(--reverb-text-secondary)]">
          {lastRun && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <Clock size={11} />
              <span>Last scrape {new Date(lastRun.started_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
              <span className="text-[var(--reverb-text-tertiary)]">·</span>
              <span className="font-semibold text-emerald-600">+{lastRun.items_added}</span>
              <span className="text-[var(--reverb-text-tertiary)]">added</span>
              <span className="text-[var(--reverb-text-tertiary)]">·</span>
              <span>{lastRun.items_skipped} dedup&apos;d</span>
            </div>
          )}
          {lastConversion && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <Brain size={11} />
              <span>Last convert {new Date(lastConversion.started_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
              <span className="text-[var(--reverb-text-tertiary)]">·</span>
              <span className="font-semibold text-emerald-600">+{lastConversion.pairs_created} pairs</span>
              <span className="text-[var(--reverb-text-tertiary)]">·</span>
              <span>{lastConversion.intel_processed} processed</span>
            </div>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <select value={intelAssetType} onChange={(e) => setIntelAssetType(e.target.value)}
            className="h-8 px-3 rounded-md text-[12.5px] bg-white border border-[var(--reverb-border-soft)] focus:outline-none focus:border-[var(--reverb-accent)]">
            {ASSET_TYPE_FILTERS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <select value={intelCategory} onChange={(e) => setIntelCategory(e.target.value)}
            className="h-8 px-3 rounded-md text-[12.5px] bg-white border border-[var(--reverb-border-soft)] focus:outline-none focus:border-[var(--reverb-accent)]">
            {INTEL_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
      </div>

      {/* Intel cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {intel.length === 0 && (
          <div className="col-span-full text-center py-12 text-[13px] text-[var(--reverb-text-tertiary)] rounded-2xl"
            style={{ background: "var(--reverb-gradient-card)", border: "1px dashed var(--reverb-border-soft)" }}>
            No intel scraped yet. Click <strong>Scrape now</strong> above to prime the data.
          </div>
        )}
        {intel.map((i) => {
          const meta = ASSET_TYPE_LABELS[i.asset_type ?? "article"] ?? ASSET_TYPE_LABELS.article;
          return (
            <a key={i.id} href={i.url} target="_blank" rel="noopener noreferrer"
              className="group block p-4 rounded-2xl overflow-hidden reverb-card">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className={cn("text-[9.5px] px-1.5 py-0.5 rounded-md font-semibold uppercase tracking-wide inline-flex items-center gap-1", meta.color)}>
                  <span>{meta.emoji}</span> {meta.label}
                </span>
                <span className="text-[9.5px] px-1.5 py-0.5 rounded-md bg-[#f5f1ea] text-[var(--reverb-text-secondary)] font-semibold uppercase tracking-wide">
                  {i.category.replace("_", " ")}
                </span>
                {i.converted_to_training && (
                  <span className="text-[9.5px] px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-semibold uppercase tracking-wide">
                    ✓ Trained
                  </span>
                )}
                {i.source && (
                  <span className="text-[10.5px] text-[var(--reverb-text-tertiary)]">{i.source}</span>
                )}
                <span className="text-[10.5px] text-[var(--reverb-text-tertiary)] ml-auto">
                  {new Date(i.scraped_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
              </div>
              <p className="text-[14px] font-semibold text-[var(--reverb-text-primary)] mb-1.5 leading-snug line-clamp-2 group-hover:text-[var(--reverb-accent)] transition-colors">
                {i.title}
              </p>
              {i.summary && (
                <p className="text-[12px] text-[var(--reverb-text-secondary)] line-clamp-3 leading-relaxed">{i.summary}</p>
              )}
              <div className="flex items-center gap-1 mt-2.5 text-[11px] text-[var(--reverb-text-tertiary)] group-hover:text-[var(--reverb-accent)] transition-colors">
                <ExternalLink size={10} /> Open source
              </div>
            </a>
          );
        })}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// Safety panel — surfaces the four classes of guardrail events
// (input_unsafe, output_unsafe, prompt_injection, pii_redacted)
// captured by the Llama-Guard + injection-detection + PII-redaction
// layers. The KPI strip + filter dropdown + chronological feed give
// admins one place to see what was caught and why.
// ─────────────────────────────────────────────────────────────────

const SAFETY_KIND_LABELS: Record<string, { label: string; emoji: string; color: string; icon: typeof Shield }> = {
  input_unsafe:    { label: "Unsafe input",     emoji: "🛑", color: "bg-red-50 text-red-700",      icon: ShieldAlert },
  output_unsafe:   { label: "Unsafe output",    emoji: "⚠️", color: "bg-orange-50 text-orange-700", icon: ShieldAlert },
  prompt_injection:{ label: "Prompt injection", emoji: "🪤", color: "bg-fuchsia-50 text-fuchsia-700", icon: AlertTriangle },
  pii_redacted:    { label: "PII redacted",     emoji: "🔒", color: "bg-emerald-50 text-emerald-700", icon: EyeOff },
};

function SafetyPanel({
  health, incidents, kindFilter, setKindFilter, onRefresh,
}: {
  health: SafetyHealth | null;
  incidents: SafetyIncident[];
  kindFilter: string;
  setKindFilter: (v: string) => void;
  onRefresh: () => void;
}) {
  return (
    <>
      {/* Header strip */}
      <div className="rounded-2xl p-4 sm:p-5 mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        style={{ background: "var(--reverb-gradient-card)", border: "1px solid var(--reverb-border-soft)", boxShadow: "var(--reverb-shadow-md)" }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "var(--reverb-gradient-accent)", boxShadow: "var(--reverb-shadow-accent)" }}>
            <ShieldCheck size={17} className="text-white" />
          </div>
          <div>
            <p className="text-[13.5px] font-semibold text-[var(--reverb-text-primary)] flex items-center gap-2">
              Responsible-AI guardrails
              <span className="inline-flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-700">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
              </span>
            </p>
            <p className="text-[11.5px] text-[var(--reverb-text-secondary)] mt-0.5">
              Llama Guard 4 moderation on every chat in/out · prompt-injection detection (regex + LLM judge) · client-side PII redaction on brand uploads.
            </p>
          </div>
        </div>
        <button onClick={onRefresh}
          className="h-9 px-3 rounded-lg text-[12.5px] font-semibold text-[var(--reverb-text-secondary)] hover:bg-white hover:shadow-[var(--reverb-shadow-sm)] hover:text-[var(--reverb-text-primary)] flex items-center gap-2 shrink-0">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <MiniStat label="Last 24h" value={health?.last_24h ?? "—"} icon={Clock} accent="violet" />
        <MiniStat label="🛑 Unsafe in/out" value={(health?.input_unsafe ?? 0) + (health?.output_unsafe ?? 0) || "—"} icon={ShieldAlert} accent="rose" />
        <MiniStat label="🪤 Injections caught" value={health?.prompt_injection ?? "—"} icon={AlertTriangle} accent="amber" />
        <MiniStat label="🔒 PII redacted" value={health?.pii_redacted ?? "—"} icon={EyeOff} accent="emerald" />
      </div>

      {/* Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <p className="text-[12.5px] text-[var(--reverb-text-secondary)]">
          {incidents.length} {incidents.length === 1 ? "incident" : "incidents"} shown
          {health?.last_incident_at && (
            <> · most recent {new Date(health.last_incident_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</>
          )}
        </p>
        <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value)}
          className="h-8 px-3 rounded-md text-[12.5px] bg-white border border-[var(--reverb-border-soft)] focus:outline-none focus:border-[var(--reverb-accent)]">
          <option value="">All event types</option>
          {Object.entries(SAFETY_KIND_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v.emoji} {v.label}</option>
          ))}
        </select>
      </div>

      {/* Incident feed */}
      <div className="rounded-2xl overflow-hidden"
        style={{ background: "var(--reverb-gradient-card)", border: "1px solid var(--reverb-border-soft)", boxShadow: "var(--reverb-shadow-md)" }}>
        {incidents.length === 0 && (
          <div className="text-center py-12 px-4 text-[13px] text-[var(--reverb-text-tertiary)]">
            <ShieldCheck size={28} className="mx-auto mb-2 text-emerald-500" />
            No incidents recorded. The guardrails are watching every chat — when something gets caught, it shows up here.
          </div>
        )}
        {incidents.map((inc) => {
          const meta = SAFETY_KIND_LABELS[inc.kind] ?? { label: inc.kind, emoji: "•", color: "bg-slate-100 text-slate-700", icon: Shield };
          const Icon = meta.icon;
          return (
            <div key={inc.id} className="px-4 sm:px-5 py-3 sm:py-3.5 border-b border-[var(--reverb-border-soft)] last:border-0">
              <div className="flex items-start gap-3">
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", meta.color)}>
                  <Icon size={14} strokeWidth={2.2} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider", meta.color)}>
                      {meta.emoji} {meta.label}
                    </span>
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded-md font-semibold uppercase tracking-wider",
                      inc.severity === "high" ? "bg-red-100 text-red-700" :
                      inc.severity === "medium" ? "bg-amber-100 text-amber-700" :
                      "bg-slate-100 text-slate-600"
                    )}>{inc.severity}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold uppercase tracking-wider bg-slate-100 text-slate-600">
                      {inc.action_taken}
                    </span>
                    {(inc.categories ?? []).map((c) => (
                      <span key={c} className="text-[10px] px-1.5 py-0.5 rounded-md font-mono bg-[#f5f1ea] text-[var(--reverb-text-secondary)]">
                        {c}
                      </span>
                    ))}
                    <span className="text-[10.5px] text-[var(--reverb-text-tertiary)] ml-auto">
                      {new Date(inc.occurred_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  {inc.user_email && (
                    <p className="text-[11.5px] text-[var(--reverb-text-secondary)] mb-0.5 truncate">
                      {inc.user_email}{inc.model ? <span className="text-[var(--reverb-text-tertiary)]"> · {inc.model}</span> : null}
                    </p>
                  )}
                  {inc.excerpt && (
                    <p className="text-[12px] text-[var(--reverb-text-primary)] line-clamp-2 leading-relaxed bg-[#faf6ef] rounded px-2 py-1 font-mono mt-1">
                      {inc.excerpt}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// Users tab — full visibility into who is using Reverb, what they're
// doing, how often, and with what outcomes. Registered users at the
// top sorted by recency; anonymous aggregate at the bottom.
// ─────────────────────────────────────────────────────────────────

function fmtTimeAgo(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  const min = ms / 60000;
  if (min < 1) return "just now";
  if (min < 60) return `${Math.floor(min)}m ago`;
  if (min < 60 * 24) return `${Math.floor(min / 60)}h ago`;
  if (min < 60 * 24 * 30) return `${Math.floor(min / (60 * 24))}d ago`;
  return new Date(iso).toLocaleDateString();
}

function UsersPanel({
  users, summary, onOpen, onRefresh,
}: {
  users: UserRow[];
  summary: { total_registered: number; total_anonymous_prompts: number; total_prompts_all: number } | null;
  onOpen: (id: string | null) => void;
  onRefresh: () => void;
}) {
  return (
    <>
      <div className="rounded-2xl p-4 sm:p-5 mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        style={{ background: "var(--reverb-gradient-card)", border: "1px solid var(--reverb-border-soft)", boxShadow: "var(--reverb-shadow-md)" }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "var(--reverb-gradient-accent)", boxShadow: "var(--reverb-shadow-accent)" }}>
            <Users size={17} className="text-white" />
          </div>
          <div>
            <p className="text-[13.5px] font-semibold text-[var(--reverb-text-primary)]">Every user, every signal</p>
            <p className="text-[11.5px] text-[var(--reverb-text-secondary)] mt-0.5">
              {summary?.total_registered ?? 0} registered users · {summary?.total_anonymous_prompts ?? 0} anonymous prompts · {summary?.total_prompts_all ?? 0} total interactions. Click any row to drill in.
            </p>
          </div>
        </div>
        <button onClick={onRefresh}
          className="h-9 px-3 rounded-lg text-[12.5px] font-semibold text-[var(--reverb-text-secondary)] hover:bg-white hover:shadow-[var(--reverb-shadow-sm)] hover:text-[var(--reverb-text-primary)] flex items-center gap-2 shrink-0">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      <div className="rounded-2xl overflow-hidden"
        style={{ background: "var(--reverb-gradient-card)", border: "1px solid var(--reverb-border-soft)", boxShadow: "var(--reverb-shadow-md)" }}>
        <div className="hidden sm:grid grid-cols-[2fr_1.4fr_1fr_1fr_1.2fr_0.8fr_24px] gap-3 px-4 sm:px-5 py-2.5 border-b border-[var(--reverb-border-soft)] bg-[#faf6ef] text-[10.5px] font-semibold uppercase tracking-wider text-[var(--reverb-text-tertiary)]">
          <div>User</div>
          <div>Last active · signed up</div>
          <div className="text-right">Prompts (7d / all)</div>
          <div className="text-right">Feedback</div>
          <div>Top intent · model</div>
          <div className="text-right">Files · Safety</div>
          <div />
        </div>

        {users.length === 0 && (
          <p className="text-center text-[12.5px] text-[var(--reverb-text-tertiary)] py-10">No users yet.</p>
        )}

        {users.map((u) => {
          const intentLabel = (u.top_intent ?? "—").replace(/_/g, " ");
          const primaryModel = u.models_used[0] ?? "—";
          return (
            <button key={u.id ?? "anon"} onClick={() => onOpen(u.id)}
              className="w-full text-left flex flex-col sm:grid sm:grid-cols-[2fr_1.4fr_1fr_1fr_1.2fr_0.8fr_24px] gap-2.5 sm:gap-3 px-4 sm:px-5 py-3 sm:py-3.5 border-b border-[var(--reverb-border-soft)] last:border-0 hover:bg-[#faf6ef] transition-colors sm:items-center">
              {/* Row 1 on mobile (col 1 on desktop): avatar + email + chevron */}
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                  u.is_anonymous ? "bg-slate-100" : "bg-[#fbf3ee]")}>
                  {u.is_anonymous
                    ? <EyeOff size={13} className="text-slate-500" />
                    : <UserIcon size={13} className="text-[var(--reverb-accent)]" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-[var(--reverb-text-primary)] truncate flex items-center gap-1.5">
                    <span className="truncate">{u.is_anonymous ? "Anonymous sessions" : (u.email ?? "—")}</span>
                    {u.linkedin_profile_url && (
                      <a
                        href={u.linkedin_profile_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        title="View LinkedIn profile"
                        className="text-[#0A66C2] hover:text-[#004182] shrink-0"
                      >
                        <LinkedInGlyph size={12} />
                      </a>
                    )}
                  </p>
                  <p className="text-[10.5px] text-[var(--reverb-text-tertiary)] truncate">
                    {u.is_anonymous
                      ? "Unauthenticated users"
                      : (
                        <>
                          <span>{fmtTimeAgo(u.last_active)}</span>
                          {u.signed_up && (
                            <span className="sm:hidden">
                              {" · joined "}
                              {new Date(u.signed_up).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                            </span>
                          )}
                        </>
                      )}
                  </p>
                </div>
                <ChevronRight size={14} className="text-[var(--reverb-text-tertiary)] shrink-0 sm:hidden" />
              </div>

              {/* Row 2 on mobile: condensed key metrics in one flex row */}
              <div className="sm:hidden flex items-center gap-3 flex-wrap pl-10 text-[11px]">
                <span className="font-mono font-semibold text-[var(--reverb-text-primary)]">
                  {u.prompts_7d}<span className="text-[var(--reverb-text-tertiary)]">/{u.total_prompts}</span>
                  <span className="text-[var(--reverb-text-tertiary)] font-sans font-normal"> prompts</span>
                </span>
                {u.prompts_24h > 0 && (
                  <span className="text-emerald-700 font-semibold">+{u.prompts_24h} today</span>
                )}
                {u.feedback_given > 0 && (
                  <span className={cn("font-semibold",
                    u.positive_rate >= 0.7 ? "text-emerald-700" : u.positive_rate >= 0.4 ? "text-amber-700" : "text-rose-700"
                  )}>
                    {Math.round(u.positive_rate * 100)}% 👍
                  </span>
                )}
                {u.brand_docs > 0 && (
                  <span className="inline-flex items-center gap-0.5 text-[var(--reverb-text-secondary)]">
                    <FileText size={10} /> {u.brand_docs}
                  </span>
                )}
                {u.safety_incidents > 0 && (
                  <span className="text-rose-700 font-semibold inline-flex items-center gap-0.5">
                    <Shield size={10} /> {u.safety_incidents}
                  </span>
                )}
                {intentLabel !== "—" && (
                  <span className="text-[var(--reverb-text-tertiary)] truncate max-w-[140px]">{intentLabel}</span>
                )}
              </div>

              {/* Desktop-only cells from col 2 onward */}
              <div className="hidden sm:block text-[11.5px]">
                <p className="text-[var(--reverb-text-primary)] font-medium">{fmtTimeAgo(u.last_active)}</p>
                {u.signed_up && (
                  <p className="text-[10.5px] text-[var(--reverb-text-tertiary)]">
                    joined {new Date(u.signed_up).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </p>
                )}
              </div>

              <div className="hidden sm:block text-right">
                <p className="text-[13.5px] font-semibold text-[var(--reverb-text-primary)] font-mono">
                  {u.prompts_7d}<span className="text-[var(--reverb-text-tertiary)] text-[11px]"> / {u.total_prompts}</span>
                </p>
                {u.prompts_24h > 0 && (
                  <p className="text-[10px] text-emerald-700 font-semibold">+{u.prompts_24h} today</p>
                )}
              </div>

              <div className="hidden sm:block text-right">
                {u.feedback_given > 0 ? (
                  <>
                    <p className="text-[12px] font-semibold text-[var(--reverb-text-primary)]">{u.feedback_given} rated</p>
                    <p className={cn("text-[10.5px] font-semibold",
                      u.positive_rate >= 0.7 ? "text-emerald-700" : u.positive_rate >= 0.4 ? "text-amber-700" : "text-rose-700"
                    )}>
                      {Math.round(u.positive_rate * 100)}% 👍
                    </p>
                  </>
                ) : (
                  <p className="text-[11px] text-[var(--reverb-text-tertiary)]">—</p>
                )}
              </div>

              <div className="hidden sm:block min-w-0">
                <p className="text-[11px] font-medium text-[var(--reverb-text-primary)] truncate">{intentLabel}</p>
                <p className="text-[10.5px] text-[var(--reverb-text-tertiary)] truncate font-mono">{primaryModel}</p>
              </div>

              <div className="hidden sm:block text-right">
                <p className="text-[11px]">
                  {u.brand_docs > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-[var(--reverb-text-secondary)]">
                      <FileText size={10} /> {u.brand_docs}
                    </span>
                  )}
                </p>
                {u.safety_incidents > 0 && (
                  <p className="text-[10.5px] text-rose-700 font-semibold inline-flex items-center gap-0.5 mt-0.5">
                    <Shield size={10} /> {u.safety_incidents}
                  </p>
                )}
              </div>

              <ChevronRight size={14} className="text-[var(--reverb-text-tertiary)] hidden sm:block" />
            </button>
          );
        })}
      </div>
    </>
  );
}

function UserDetailDrawer({
  detail, loading, onClose, onOpenPrompt,
}: {
  detail: UserDetail | null;
  loading: boolean;
  onClose: () => void;
  onOpenPrompt: (i: UserDetail["interactions"][number]) => void;
}) {
  if (loading && !detail) {
    return (
      <div className="fixed inset-0 z-30 flex items-center justify-center px-0 sm:px-4 reverb-fade-in" onClick={onClose}>
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
        <div className="relative px-5 py-4 rounded-xl bg-white shadow-lg flex items-center gap-2.5">
          <RefreshCw size={14} className="animate-spin text-[var(--reverb-accent)]" />
          <span className="text-[13px] text-[var(--reverb-text-primary)]">Loading user activity…</span>
        </div>
      </div>
    );
  }
  if (!detail) return null;

  const isAnonymous = detail.profile?.is_anonymous;
  const email = detail.profile?.email ?? (isAnonymous ? "Anonymous sessions" : "—");
  const created = detail.profile?.created_at;
  const s = detail.summary;
  const topIntents = Object.entries(s.intents).sort(([, a], [, b]) => b - a).slice(0, 5);
  const modelsList = Object.entries(s.models).sort(([, a], [, b]) => b - a);

  return (
    <div className="fixed inset-0 z-30 flex items-end sm:items-center justify-center px-0 sm:px-4 reverb-fade-in" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative max-w-4xl w-full max-h-[90vh] sm:max-h-[88vh] rounded-t-2xl sm:rounded-2xl overflow-hidden reverb-scale-in flex flex-col"
        style={{ background: "var(--reverb-gradient-card)", boxShadow: "var(--reverb-shadow-xl)", border: "1px solid var(--reverb-border-soft)" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="px-4 sm:px-5 py-3.5 border-b border-[var(--reverb-border-soft)] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
              isAnonymous ? "bg-slate-100" : "bg-[#fbf3ee]")}>
              {isAnonymous
                ? <EyeOff size={16} className="text-slate-500" />
                : <Mail size={16} className="text-[var(--reverb-accent)]" />}
            </div>
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-[var(--reverb-text-primary)] truncate">{email}</p>
              <p className="text-[11px] text-[var(--reverb-text-tertiary)]">
                {created
                  ? `joined ${new Date(created).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}`
                  : "Aggregate of all unauthenticated traffic"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-[var(--reverb-text-secondary)] hover:text-[var(--reverb-text-primary)] text-sm font-medium shrink-0">Close</button>
        </div>

        {detail.identity?.linkedin && (
          <div className="px-4 sm:px-5 py-3 border-b border-[var(--reverb-border-soft)] flex flex-col sm:flex-row sm:items-center gap-3 shrink-0 bg-[#f5f9fc]">
            {detail.identity.linkedin.picture && (
              // LinkedIn-CDN URL; rendered via plain img so we don't have
              // to add media.licdn.com to next.config remotePatterns.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={detail.identity.linkedin.picture}
                alt={detail.identity.linkedin.name ?? "LinkedIn profile"}
                className="w-12 h-12 rounded-xl border border-[#cfe0ef] object-cover shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[#0A66C2]"><LinkedInGlyph size={13} /></span>
                <p className="text-[12px] font-semibold uppercase tracking-wider text-[#0A66C2]">
                  Signed up via LinkedIn
                </p>
              </div>
              <p className="text-[13px] text-[var(--reverb-text-primary)] mt-0.5 font-medium truncate">
                {detail.identity.linkedin.name ?? "—"}
              </p>
              <p className="text-[10.5px] text-[var(--reverb-text-tertiary)] font-mono truncate">
                LinkedIn ID: {detail.identity.linkedin.sub ?? "—"}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 shrink-0">
              <a
                href={detail.identity.linkedin.profile_url}
                target="_blank"
                rel="noopener noreferrer"
                className="h-9 px-3 rounded-lg flex items-center justify-center gap-1.5 text-[12px] font-semibold text-white bg-[#0A66C2] hover:bg-[#004182] transition-colors"
              >
                <LinkedInGlyph size={12} /> View on LinkedIn
              </a>
              <a
                href={detail.identity.linkedin.search_url}
                target="_blank"
                rel="noopener noreferrer"
                className="h-9 px-3 rounded-lg flex items-center justify-center gap-1.5 text-[12px] font-semibold text-[#0A66C2] bg-white border border-[#cfe0ef] hover:bg-[#eef5fb] transition-colors"
                title="Fallback: opens LinkedIn search pre-filled with this user's name"
              >
                <Search size={11} /> Search by name
              </a>
            </div>
          </div>
        )}

        <div className="px-4 sm:px-5 py-3 border-b border-[var(--reverb-border-soft)] grid grid-cols-2 sm:grid-cols-5 gap-3 shrink-0">
          <DrawerStat label="Prompts" value={s.total_prompts} />
          <DrawerStat label="Sessions" value={s.sessions || "—"} />
          <DrawerStat label="Web search" value={s.web_search_count} />
          <DrawerStat label="Brand docs" value={s.brand_docs_count} />
          <DrawerStat label="Safety flags" value={s.safety_incidents_count} accent={s.safety_incidents_count > 0 ? "rose" : "neutral"} />
        </div>

        {(topIntents.length > 0 || modelsList.length > 0) && (
          <div className="px-4 sm:px-5 py-3 border-b border-[var(--reverb-border-soft)] grid grid-cols-1 sm:grid-cols-2 gap-3 shrink-0">
            {topIntents.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--reverb-text-tertiary)] mb-1.5">Top intents</p>
                <div className="flex flex-wrap gap-1.5">
                  {topIntents.map(([k, v]) => (
                    <span key={k} className="text-[11px] px-2 py-0.5 rounded-md bg-[#fbf3ee] text-[var(--reverb-accent-rich)] font-medium">
                      {k.replace(/_/g, " ")} · {v}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {modelsList.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--reverb-text-tertiary)] mb-1.5">Models used</p>
                <div className="flex flex-wrap gap-1.5">
                  {modelsList.map(([k, v]) => (
                    <span key={k} className="text-[11px] px-2 py-0.5 rounded-md bg-[#f5f1ea] text-[var(--reverb-text-secondary)] font-mono">
                      {k} · {v}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto reverb-scroll">
          {detail.brand_docs.length > 0 && (
            <div className="px-4 sm:px-5 py-3 border-b border-[var(--reverb-border-soft)]">
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--reverb-text-tertiary)] mb-2">
                Brand Library · {detail.brand_docs.length} document{detail.brand_docs.length === 1 ? "" : "s"}
              </p>
              <div className="space-y-1.5">
                {detail.brand_docs.map((d) => (
                  <div key={d.id} className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-white border border-[var(--reverb-border-soft)]">
                    <FileText size={12} className="text-[var(--reverb-text-secondary)] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium text-[var(--reverb-text-primary)] truncate">{d.filename}</p>
                      <p className="text-[10px] text-[var(--reverb-text-tertiary)]">
                        {d.doc_type.replace(/_/g, " ")} · {(d.total_chars / 1000).toFixed(1)}K chars · {new Date(d.uploaded_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {detail.safety_incidents.length > 0 && (
            <div className="px-4 sm:px-5 py-3 border-b border-[var(--reverb-border-soft)] bg-rose-50/30">
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-rose-700 mb-2">
                Safety flags · {detail.safety_incidents.length}
              </p>
              <div className="space-y-1.5">
                {detail.safety_incidents.slice(0, 5).map((s) => (
                  <div key={s.id} className="flex items-start gap-2.5 px-3 py-2 rounded-lg bg-white border border-rose-100">
                    <Shield size={12} className="text-rose-600 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11.5px] font-semibold text-[var(--reverb-text-primary)]">
                        {s.kind.replace(/_/g, " ")} · {s.severity}
                      </p>
                      {s.excerpt && (
                        <p className="text-[11px] text-[var(--reverb-text-secondary)] mt-0.5 line-clamp-2 font-mono">{s.excerpt}</p>
                      )}
                      <p className="text-[10px] text-[var(--reverb-text-tertiary)] mt-0.5">
                        {new Date(s.occurred_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="px-4 sm:px-5 py-3">
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--reverb-text-tertiary)] mb-2">
              Recent prompts · {detail.interactions.length}
            </p>
            {detail.interactions.length === 0 && (
              <p className="text-center text-[12px] text-[var(--reverb-text-tertiary)] py-6">No prompts yet.</p>
            )}
            <div className="space-y-2">
              {detail.interactions.map((i) => (
                <button key={i.id} onClick={() => onOpenPrompt(i)}
                  className="w-full text-left px-3 py-2 rounded-lg bg-white border border-[var(--reverb-border-soft)] hover:bg-[#faf6ef] hover:shadow-[var(--reverb-shadow-xs)] transition-all">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {i.intent && (
                      <span className="text-[9.5px] px-1.5 py-0.5 rounded-md bg-[#f5f1ea] text-[var(--reverb-text-secondary)] font-semibold uppercase tracking-wide">
                        {i.intent.replace(/_/g, " ")}
                      </span>
                    )}
                    <span className="text-[9.5px] px-1.5 py-0.5 rounded-md bg-[#fbf3ee] text-[var(--reverb-accent-rich)] font-mono font-semibold">
                      {i.model}
                    </span>
                    {i.web_search_used && <Globe size={10} className="text-blue-500" />}
                    {i.user_rating === 1 && <ThumbsUp size={10} className="text-emerald-600" />}
                    {i.user_rating === -1 && <ThumbsDown size={10} className="text-rose-600" />}
                    <span className="text-[10px] text-[var(--reverb-text-tertiary)] ml-auto">
                      {new Date(i.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-[12.5px] text-[var(--reverb-text-primary)] line-clamp-2 leading-snug">{i.user_query}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DrawerStat({ label, value, accent }: { label: string; value: number | string; accent?: "rose" | "neutral" }) {
  const color = accent === "rose" ? "text-rose-700" : "text-[var(--reverb-text-primary)]";
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--reverb-text-tertiary)]">{label}</p>
      <p className={cn("text-[20px] font-semibold tracking-tight mt-0.5", color)}>{value}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// API Keys panel — cross-user view of every issued public-API key.
// Admin can spot suspicious activity (unusual last-used timing,
// suspicious names) and revoke without waiting on the owner to log in.
// Never displays the key_hash — even to admins.
// ─────────────────────────────────────────────────────────────────
function ApiKeysPanel({
  keys, summary, onRefresh, onRevoke,
}: {
  keys: AdminApiKey[];
  summary: AdminApiKeySummary | null;
  onRefresh: () => void;
  onRevoke: (id: string) => void;
}) {
  const [showRevoked, setShowRevoked] = useState(false);
  const visible = keys.filter((k) => (showRevoked ? true : !k.revoked_at));

  const fmtRel = (iso: string | null) => {
    if (!iso) return "never";
    const ms = Date.now() - new Date(iso).getTime();
    const min = Math.floor(ms / 60000);
    if (min < 1) return "just now";
    if (min < 60) return `${min}m ago`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 30) return `${d}d ago`;
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };
  const fmtAbs = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <>
      <div className="rounded-2xl p-4 sm:p-5 mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        style={{ background: "var(--reverb-gradient-card)", border: "1px solid var(--reverb-border-soft)", boxShadow: "var(--reverb-shadow-md)" }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "var(--reverb-gradient-accent)", boxShadow: "var(--reverb-shadow-accent)" }}>
            <KeyRound size={17} className="text-white" />
          </div>
          <div>
            <p className="text-[13.5px] font-semibold text-[var(--reverb-text-primary)]">Public API keys</p>
            <p className="text-[11.5px] text-[var(--reverb-text-secondary)] mt-0.5">
              Every third-party integration key issued from <code className="text-[11px] px-1 py-0.5 rounded bg-[#f5f1ea]">/settings/api-keys</code>. Revoke any key immediately if something looks off.
            </p>
          </div>
        </div>
        <button onClick={onRefresh}
          className="h-9 px-3 rounded-lg text-[12.5px] font-semibold text-[var(--reverb-text-secondary)] hover:bg-white hover:shadow-[var(--reverb-shadow-sm)] hover:text-[var(--reverb-text-primary)] flex items-center gap-2 shrink-0">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <MiniStat label="Total issued" value={summary.total} icon={KeyRound} accent="violet" />
          <MiniStat label="Active" value={summary.active} icon={ShieldCheck} accent="emerald" />
          <MiniStat label="Revoked" value={summary.revoked} icon={ShieldAlert} accent="rose" />
          <MiniStat label="Used last 7d" value={summary.used_last_7d} icon={Activity} accent="amber" />
        </div>
      )}

      <div className="rounded-2xl overflow-hidden"
        style={{ background: "var(--reverb-gradient-card)", border: "1px solid var(--reverb-border-soft)", boxShadow: "var(--reverb-shadow-md)" }}>
        <div className="px-4 sm:px-5 py-3 border-b border-[var(--reverb-border-soft)] flex items-center justify-between gap-3">
          <p className="text-[13.5px] font-semibold text-[var(--reverb-text-primary)]">
            {visible.length} {showRevoked ? "total" : "active"} key{visible.length === 1 ? "" : "s"}
          </p>
          <label className="flex items-center gap-2 text-[11.5px] font-medium text-[var(--reverb-text-secondary)] cursor-pointer">
            <input type="checkbox" checked={showRevoked} onChange={(e) => setShowRevoked(e.target.checked)}
              className="h-3.5 w-3.5 accent-[var(--reverb-accent)] cursor-pointer" />
            Include revoked
          </label>
        </div>

        <div className="hidden sm:grid grid-cols-[2fr_1.6fr_1.2fr_1fr_1fr_32px] gap-3 px-4 sm:px-5 py-2.5 border-b border-[var(--reverb-border-soft)] bg-[#faf6ef] text-[10.5px] font-semibold uppercase tracking-wider text-[var(--reverb-text-tertiary)]">
          <div>Owner · Name</div>
          <div>Key prefix</div>
          <div>Last used</div>
          <div>Created</div>
          <div>Status</div>
          <div />
        </div>

        {visible.length === 0 && (
          <p className="text-center text-[12.5px] text-[var(--reverb-text-tertiary)] py-10">
            No keys {showRevoked ? "issued yet" : "active right now"}.
          </p>
        )}

        {visible.map((k) => {
          const isRevoked = !!k.revoked_at;
          return (
            <div key={k.id}
              className={cn(
                "flex flex-col sm:grid sm:grid-cols-[2fr_1.6fr_1.2fr_1fr_1fr_32px] gap-2 sm:gap-3 px-4 sm:px-5 py-3 sm:py-3.5 border-b border-[var(--reverb-border-soft)] last:border-0 sm:items-center",
                isRevoked ? "opacity-60" : ""
              )}>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-[var(--reverb-text-primary)] truncate">{k.name}</p>
                <p className="text-[10.5px] text-[var(--reverb-text-tertiary)] truncate">{k.user_email ?? k.user_id.slice(0, 8) + "…"}</p>
              </div>
              <p className="text-[11.5px] font-mono text-[var(--reverb-text-secondary)] truncate">{k.key_prefix}…</p>
              <div className="text-[11.5px]">
                <p className="text-[var(--reverb-text-primary)] font-medium">{fmtRel(k.last_used_at)}</p>
                {k.last_used_at && (
                  <p className="text-[10px] text-[var(--reverb-text-tertiary)]">{fmtAbs(k.last_used_at)}</p>
                )}
              </div>
              <p className="text-[11.5px] text-[var(--reverb-text-secondary)]">{fmtAbs(k.created_at)}</p>
              <div>
                {isRevoked ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded-md">
                    <ShieldAlert size={9} /> revoked
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                    <ShieldCheck size={9} /> active
                  </span>
                )}
              </div>
              <button
                onClick={() => onRevoke(k.id)}
                disabled={isRevoked}
                title={isRevoked ? "Already revoked" : "Revoke this key"}
                className="p-1.5 rounded-md text-rose-500 hover:bg-rose-50 disabled:text-[var(--reverb-text-tertiary)] disabled:hover:bg-transparent disabled:cursor-not-allowed sm:justify-self-end"
              >
                <Trash2 size={13} />
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
