"use client";

import { useEffect, useState } from "react";
import { useChatStore } from "@/lib/chat-store";
import { streamChat } from "@/lib/stream-chat";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import {
  TrendingUp, Wand2, Mail, Target, Mic2, Crosshair,
  Search, ShieldCheck, Bot, Radar, Building2, Activity,
  Layers, BarChart3, Compass, Sparkles, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Pretty-case "amit_tomar" / "amit tomar" / "AMIT" → "Amit"
// Pulls the first token only — "Amit Tomar" → "Amit".
function firstNameFromMetaOrEmail(fullName?: string | null, email?: string | null): string {
  const source = (fullName ?? email?.split("@")[0] ?? "").trim();
  if (!source) return "there";
  const first = source.split(/[\s._-]+/)[0] ?? source;
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

// Local-time-aware salutation. Uses the browser's clock, not the server's,
// so a user in IST at 7 PM sees "Good evening" even though Vercel's edge
// region might be in UTC at 1:30 PM.
function localGreeting(): string {
  const h = new Date().getHours();
  if (h < 5)  return "Working late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 22) return "Good evening";
  return "Burning the midnight oil";
}

interface Suggestion {
  category: string;
  icon: React.ComponentType<{ size: number; className?: string; strokeWidth?: number }>;
  accent: string;
  iconBg: string;
  iconColor: string;
  title: string;
  prompt: string;
}

const SUGGESTIONS: Suggestion[] = [
  // ── Content & Creative ───────────────────────────────
  { category: "Content", icon: Wand2, accent: "from-violet-500 to-fuchsia-500", iconBg: "bg-violet-50", iconColor: "text-violet-600",
    title: "Generate ad copy", prompt: "Write 3 Google Ads variants for a B2B SaaS marketing platform targeting growth marketers." },
  { category: "Content", icon: Mail, accent: "from-emerald-500 to-teal-500", iconBg: "bg-emerald-50", iconColor: "text-emerald-600",
    title: "Write an email sequence", prompt: "Draft a 5-email product launch sequence for a marketing automation tool." },
  { category: "Content", icon: Mic2, accent: "from-pink-500 to-rose-500", iconBg: "bg-pink-50", iconColor: "text-pink-600",
    title: "Score against brand voice", prompt: "Score this copy against my brand voice: 'The world-class, guaranteed cheapest solution your team will love.'" },

  // ── Strategy & Planning ───────────────────────────────
  { category: "Strategy", icon: Target, accent: "from-amber-500 to-orange-500", iconBg: "bg-amber-50", iconColor: "text-amber-600",
    title: "Build a GTM strategy", prompt: "Help me build a 90-day go-to-market strategy for launching into the mid-market segment." },
  { category: "Strategy", icon: TrendingUp, accent: "from-blue-500 to-cyan-500", iconBg: "bg-blue-50", iconColor: "text-blue-600",
    title: "Surface trending topics", prompt: "What are the top marketing trends I should know about this week?" },
  { category: "Strategy", icon: Layers, accent: "from-indigo-500 to-purple-500", iconBg: "bg-indigo-50", iconColor: "text-indigo-600",
    title: "ABM playbook", prompt: "Design an ABM playbook for the top 50 enterprise accounts in fintech — include account research, multi-thread outreach, and signal-based triggers." },

  // ── SEO / AEO / GEO ───────────────────────────────────
  { category: "Search", icon: Search, accent: "from-green-500 to-emerald-500", iconBg: "bg-green-50", iconColor: "text-green-600",
    title: "SEO audit + fix list", prompt: "Audit my landing page for SEO and give me a prioritized list of 10 specific fixes with expected impact." },
  { category: "Search", icon: Bot, accent: "from-cyan-500 to-blue-500", iconBg: "bg-cyan-50", iconColor: "text-cyan-600",
    title: "AEO — win AI Overviews", prompt: "Restructure my pricing page to win Google AI Overviews and Perplexity citations for high-intent buyer queries." },
  { category: "Search", icon: Sparkles, accent: "from-fuchsia-500 to-pink-500", iconBg: "bg-fuchsia-50", iconColor: "text-fuchsia-600",
    title: "GEO — get cited by ChatGPT", prompt: "What pages should I create and which authority signals do I need to be cited by ChatGPT, Claude, and Perplexity for 'B2B marketing automation'?" },

  // ── Intelligence & Signals ────────────────────────────
  { category: "Signals", icon: Activity, accent: "from-rose-500 to-red-500", iconBg: "bg-rose-50", iconColor: "text-rose-600",
    title: "Buyer signal analysis", prompt: "Here are 10 leads with their LinkedIn engagement + website visit signals. Rank them by buying intent and tell me what to send each one." },
  { category: "Signals", icon: Building2, accent: "from-slate-500 to-zinc-500", iconBg: "bg-slate-50", iconColor: "text-slate-600",
    title: "Company signal tracking", prompt: "Surface buying signals (hiring trends, funding, leadership moves, tech stack changes) for these 10 ICP companies and tell me the optimal entry point for each." },
  { category: "Signals", icon: Crosshair, accent: "from-red-500 to-orange-500", iconBg: "bg-red-50", iconColor: "text-red-600",
    title: "Competitor teardown", prompt: "Analyze a competitor's recent campaign and suggest 3 counter-positioning strategies grounded in their messaging gaps." },

  // ── Reputation & Analytics ────────────────────────────
  { category: "Reputation", icon: ShieldCheck, accent: "from-teal-500 to-cyan-500", iconBg: "bg-teal-50", iconColor: "text-teal-600",
    title: "ORM — track brand mentions", prompt: "Monitor sentiment around my brand across review sites and social this week. Flag negative trends and draft response strategies." },
  { category: "Reputation", icon: Radar, accent: "from-yellow-500 to-amber-500", iconBg: "bg-yellow-50", iconColor: "text-yellow-600",
    title: "Demand intelligence", prompt: "Map demand signals across my category over the last 30 days — search trends, social conversations, ad spend patterns. Where should I invest next quarter?" },
  { category: "Reputation", icon: BarChart3, accent: "from-purple-500 to-violet-500", iconBg: "bg-purple-50", iconColor: "text-purple-600",
    title: "Channel mix optimizer", prompt: "Given a $50K/month budget, recommend an optimal channel mix for a Series B SaaS targeting mid-market HR leaders. Justify each allocation with CAC math." },
  { category: "Reputation", icon: Compass, accent: "from-orange-500 to-amber-500", iconBg: "bg-orange-50", iconColor: "text-orange-600",
    title: "Customer journey map", prompt: "Build a complete customer journey map for an enterprise B2B SaaS, identifying the 3 biggest leak points and content needed to close them." },
];

const CATEGORIES = ["All", "Content", "Strategy", "Search", "Signals", "Reputation"];

export default function WelcomeScreen() {
  const { newConversation, addMessage, updateMessage, selectedModel } = useChatStore();
  const [activeCategory, setActiveCategory] = useState("All");
  const [firstName, setFirstName] = useState<string>("there");
  const [greeting, setGreeting] = useState<string>(localGreeting());

  // Pull the logged-in user's name from Supabase auth.user_metadata
  // (set during signup) or fall back to the email prefix.
  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled || !user) return;
      const name = firstNameFromMetaOrEmail(
        (user.user_metadata?.full_name as string | undefined) ?? null,
        user.email
      );
      setFirstName(name);
    });
    // Keep the greeting accurate if the user leaves the tab open across an
    // hour boundary (e.g. 4:55 PM → 5:01 PM should flip to "Good evening").
    const t = setInterval(() => setGreeting(localGreeting()), 60_000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  const visible = activeCategory === "All"
    ? SUGGESTIONS
    : SUGGESTIONS.filter((s) => s.category === activeCategory);

  const startWith = async (prompt: string) => {
    const id = newConversation();
    addMessage(id, { role: "user", content: prompt });
    const asstId = addMessage(id, { role: "assistant", content: "", model: selectedModel, isStreaming: true });
    try {
      const { text, interactionId } = await streamChat({
        messages: [{ id: "u", role: "user", content: prompt, createdAt: new Date() }],
        model: selectedModel,
        onToken: (acc) => updateMessage(id, asstId, { content: acc }),
      });
      updateMessage(id, asstId, { content: text, isStreaming: false, interactionId: interactionId ?? undefined });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      updateMessage(id, asstId, { content: `⚠️ ${msg}`, isStreaming: false });
    }
  };

  return (
    <div className="flex-1 overflow-y-auto reverb-scroll min-h-0">
      <div className="min-h-full flex flex-col items-center px-4 sm:px-6 py-6 sm:py-8">
        <div className="w-full max-w-4xl reverb-fade-in">
          <div className="text-center mb-5 sm:mb-6">
            <div className="inline-flex items-center gap-2 px-3 sm:px-3.5 py-1 sm:py-1.5 rounded-full bg-white/80 backdrop-blur-sm border border-[var(--reverb-border-soft)] shadow-[var(--reverb-shadow-xs)] mb-3 sm:mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
              <span className="text-[10.5px] sm:text-[11px] font-semibold text-[var(--reverb-text-secondary)] tracking-wide uppercase">
                Live · Self-Learning
              </span>
            </div>
            <h1 className="text-[28px] sm:text-[36px] md:text-[40px] font-medium tracking-tight text-[var(--reverb-text-primary)] mb-2 sm:mb-2.5 leading-tight">
              {greeting}, <span style={{
                background: "var(--reverb-gradient-accent)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
                fontWeight: 700,
              }}>{firstName}</span>
            </h1>
            <p className="text-[13px] sm:text-[14.5px] text-[var(--reverb-text-secondary)] font-normal px-2">
              From SEO to ABM to buyer intent — what would you like to work on?
            </p>
          </div>

          {/* Category tabs */}
          <div className="flex items-center justify-start sm:justify-center gap-1.5 mb-4 sm:mb-5 flex-nowrap sm:flex-wrap overflow-x-auto reverb-scroll -mx-4 sm:mx-0 px-4 sm:px-0 pb-1">
            {CATEGORIES.map((cat) => (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                className={cn(
                  "shrink-0 px-3 py-1.5 rounded-full text-[12px] font-semibold tracking-tight transition-all duration-200 active:scale-95",
                  activeCategory === cat
                    ? "text-white shadow-[var(--reverb-shadow-sm)]"
                    : "text-[var(--reverb-text-secondary)] bg-white/60 border border-[var(--reverb-border-soft)] hover:bg-white"
                )}
                style={activeCategory === cat ? { background: "var(--reverb-gradient-accent)" } : {}}>
                {cat}
              </button>
            ))}
          </div>

          {/* Suggestion grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
            {visible.map((s, i) => (
              <button key={s.title} onClick={() => startWith(s.prompt)}
                style={{ animationDelay: `${50 + i * 40}ms` }}
                className="group relative text-left p-4 rounded-2xl bg-[var(--reverb-gradient-card)] border border-[var(--reverb-border-soft)] overflow-hidden reverb-card reverb-stagger-in">
                <div className={`absolute -top-12 -right-12 w-32 h-32 rounded-full bg-gradient-to-br ${s.accent} opacity-0 group-hover:opacity-20 blur-2xl transition-opacity duration-500`} />
                <div className="relative">
                  <div className="flex items-start justify-between mb-2.5">
                    <div className={`w-9 h-9 rounded-xl ${s.iconBg} flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}
                      style={{ boxShadow: "var(--reverb-shadow-xs)" }}>
                      <s.icon size={16} className={s.iconColor} strokeWidth={2.2} />
                    </div>
                    <span className="text-[9.5px] font-semibold tracking-wider uppercase text-[var(--reverb-text-tertiary)] px-1.5 py-0.5 rounded-md bg-[#f5f1ea]">
                      {s.category}
                    </span>
                  </div>
                  <p className="text-[13.5px] font-semibold text-[var(--reverb-text-primary)] mb-1 tracking-tight">{s.title}</p>
                  <p className="text-[12px] text-[var(--reverb-text-secondary)] line-clamp-2 leading-relaxed">{s.prompt}</p>
                </div>
              </button>
            ))}
          </div>

          {/* "And much more" footer */}
          <div className="mt-7 mb-2 flex items-center justify-center gap-2 text-[12px] text-[var(--reverb-text-tertiary)]">
            <span className="h-px w-12 bg-[var(--reverb-border-soft)]" />
            <span className="font-medium">And much more — just ask</span>
            <ChevronRight size={12} className="opacity-60" />
            <span className="h-px w-12 bg-[var(--reverb-border-soft)]" />
          </div>
        </div>
      </div>
    </div>
  );
}
