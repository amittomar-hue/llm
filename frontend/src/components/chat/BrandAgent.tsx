"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useChatStore } from "@/lib/chat-store";
import { useAgentStore, type BrandAgent as BrandAgentType } from "@/lib/agent-store";
import {
  BookOpen, ChevronDown, Upload, AlertCircle,
  Megaphone, Mail, Share2, Newspaper, LayoutTemplate,
  Mic2, FileText, Building2, Star, Wand2,
  Check, Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface BrandDoc {
  id: string;
  filename: string;
  doc_type: string;
}

interface BrandAsset {
  icon: React.ComponentType<{ size: number; className?: string; strokeWidth?: number }>;
  color: string;
  bg: string;
  label: string;
  desc: string;
  buildPrompt: () => string;
}

const ASSETS: BrandAsset[] = [
  {
    icon: Megaphone, color: "text-violet-700", bg: "bg-violet-50",
    label: "Brand-tuned ad copy",
    desc: "3 variants for Google Ads, Meta, or LinkedIn",
    buildPrompt: () =>
`Using my uploaded brand documents as the authoritative source for tone, products, ICP, and positioning, write 3 ad copy variants.

Channel: [Google Ads / Meta / LinkedIn — pick one]
Offer / product: [WHICH PRODUCT]
Target audience: [WHO]
Campaign objective: [LEAD GEN / TRAFFIC / SIGNUPS]

For each variant give: headline, body, CTA, predicted CTR, brand voice score (0-100) with rationale citing specific phrases from my brand docs.`,
  },
  {
    icon: Mail, color: "text-emerald-700", bg: "bg-emerald-50",
    label: "Brand voice email",
    desc: "Welcome / nurture / sales email written in your voice",
    buildPrompt: () =>
`Write an email in our exact brand voice (use the brand docs I uploaded as the source of truth — match phrasing, tone, signature style).

Email type: [WELCOME / NURTURE / SALES / RE-ENGAGEMENT]
Audience: [WHO]
Goal: [SPECIFIC GOAL]
Length: [SHORT 100 words / MEDIUM 250 / LONG 400]

Output: subject line, preview text, body, CTA. Highlight any phrases borrowed directly from our brand docs.`,
  },
  {
    icon: Share2, color: "text-blue-700", bg: "bg-blue-50",
    label: "Brand social post",
    desc: "LinkedIn, X, Instagram — on-brand and platform-native",
    buildPrompt: () =>
`Write a social post grounded in my brand documents — match the tone, phrasing, and product framing exactly.

Platform: [LinkedIn / X / Instagram / Threads]
Topic: [WHAT]
Format: [TEXT POST / CAROUSEL / VIDEO SCRIPT]
Goal: [AWARENESS / ENGAGEMENT / DEMO REQUESTS]

Include: hook, body, CTA, suggested hashtags, optimal post time. Note which brand-voice phrases I should keep verbatim.`,
  },
  {
    icon: LayoutTemplate, color: "text-amber-700", bg: "bg-amber-50",
    label: "Landing page copy",
    desc: "Hero + sub + benefits + CTA — all on-brand",
    buildPrompt: () =>
`Generate complete landing page copy grounded in my uploaded brand documents — use my actual product names, value props, ICP language.

Page purpose: [WHAT]
Primary CTA: [WHAT ACTION]

Sections: hero headline, sub-headline, 3 benefit blocks (with proof), social proof line, FAQ (3 questions), final CTA. Match the tone exactly from my brand docs. Note any brand terms I should avoid based on my style guide.`,
  },
  {
    icon: Newspaper, color: "text-slate-700", bg: "bg-slate-100",
    label: "Press release / announcement",
    desc: "Newsroom-ready release using your company facts",
    buildPrompt: () =>
`Write a press release using the company facts, leadership quotes style, and positioning from my brand documents.

Announcement: [WHAT — funding / product launch / hire / partnership]
Date: [WHEN]
Key spokesperson: [WHO]

Structure: dateline, headline, sub-headline, lede paragraph, body (3-4 paragraphs), spokesperson quote, boilerplate (use my About section verbatim), press contact placeholder. AP style.`,
  },
  {
    icon: Mic2, color: "text-pink-700", bg: "bg-pink-50",
    label: "Brand voice scorer",
    desc: "Paste any copy, get an on-brand score 0-100",
    buildPrompt: () =>
`Score this copy against my brand voice using my uploaded brand documents as the rubric.

Copy to score:
"""
[PASTE COPY HERE]
"""

Output: overall score (0-100), which brand attributes it matches (cite specific lines from my brand docs), which it violates, flagged prohibited terms, and a rewrite that scores 95+.`,
  },
  {
    icon: FileText, color: "text-cyan-700", bg: "bg-cyan-50",
    label: "Sales one-pager",
    desc: "Internal enablement doc with brand-tuned talk tracks",
    buildPrompt: () =>
`Build a sales one-pager for the rep team. Use product facts, ICP, and competitive positioning from my brand documents.

Product/offer: [WHICH]
Target persona: [WHO]
Top objections to handle: [LIST or 'derive from brand docs']

Sections: one-line pitch, problem we solve, our solution, ICP fit signals, 3 talk tracks for the persona, top 5 objections with answers, competitive differentiators, qualifying questions, pricing summary.`,
  },
  {
    icon: Building2, color: "text-indigo-700", bg: "bg-indigo-50",
    label: "Boilerplate / About us",
    desc: "Refreshed company description for press, RFPs, footers",
    buildPrompt: () =>
`Refresh our standard boilerplate / company description using my uploaded brand documents.

Use case: [PRESS RELEASE / RFP RESPONSE / EMAIL FOOTER / WEBSITE FOOTER]
Length: [SHORT 30 words / STANDARD 60 words / LONG 100 words]
Required to mention: [FOUNDING YEAR / KEY CUSTOMERS / FUNDING / AWARDS — pick]

Match the exact tone and phrasing style from my brand docs. Show 2 variants for A/B.`,
  },
  {
    icon: Star, color: "text-rose-700", bg: "bg-rose-50",
    label: "Customer story / case study",
    desc: "Structured case study using your positioning",
    buildPrompt: () =>
`Outline a customer case study using my brand voice and positioning from the uploaded brand docs.

Customer: [NAME / INDUSTRY]
Result achieved: [METRIC]
Use case: [WHAT THEY DID WITH OUR PRODUCT]

Structure: hero metric, customer background, challenge, why they chose us (in our positioning language), implementation, results (3 metrics minimum), customer quote in their voice, call-to-action. ~600 words.`,
  },
];

export default function BrandAgent({ onInsert }: { onInsert: (prompt: string) => void }) {
  const [open, setOpen] = useState(false);
  const [docs, setDocs] = useState<BrandDoc[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const setWebSearchMode = useChatStore((s) => s.setWebSearchMode);
  const conv = useChatStore((s) => s.activeConversation());
  const setConversationAgent = useChatStore((s) => s.setConversationAgent);

  const agents = useAgentStore((s) => s.agents);
  const selectedAgentId = useAgentStore((s) => s.selectedAgentId);
  const setSelected = useAgentStore((s) => s.setSelected);
  const upsertAgent = useAgentStore((s) => s.upsert);
  const refreshAgents = useAgentStore((s) => s.refresh);

  // Effective agent: selected (fresh pick) → conversation binding →
  // default-flagged. Priority matches InputBar's send-time resolution so
  // this dropdown, the input chip, and the actual request all agree on
  // which agent is "active." Previously conv.agentId came first, which
  // could race with a fresh pick and show stale state.
  const effectiveAgentId =
    selectedAgentId ?? conv?.agentId ?? agents.find((a) => a.is_default)?.id ?? null;
  const effective = agents.find((a) => a.id === effectiveAgentId);
  const agentName = effective?.name ?? "Brand Agent";

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  // Refresh the agent list whenever the dropdown opens so freshly
  // created agents from /agents show up without a hard refresh.
  useEffect(() => {
    if (open) void refreshAgents();
  }, [open, refreshAgents]);

  useEffect(() => {
    if (!open || docs) return;
    // Scope the count to the ACTIVE agent — otherwise the badge shows total
    // docs across every agent the user owns, which is what caused "wrong
    // doc count on brand agent." pickAgent() calls setDocs(null) which
    // re-triggers this effect with the new effectiveAgentId.
    const url = effectiveAgentId
      ? `/api/brand/documents?agent_id=${encodeURIComponent(effectiveAgentId)}`
      : "/api/brand/documents";
    fetch(url)
      .then((r) => r.json())
      .then((d) => setDocs(d.documents ?? []))
      .catch(() => setDocs([]));
  }, [open, docs, effectiveAgentId]);

  const hasDocs = (docs?.length ?? 0) > 0;

  const pick = (asset: BrandAsset) => {
    onInsert(asset.buildPrompt());
    setWebSearchMode("off"); // brand assets are about your docs, not the web
    setOpen(false);
  };

  const pickAgent = (a: BrandAgentType) => {
    setSelected(a.id);
    if (conv) setConversationAgent(conv.id, a.id);
    // Bust the doc cache so the count badge reflects the new agent's
    // library on the next render of this dropdown. /api/brand/documents
    // returns the user's full library today, but if it ever becomes
    // agent-scoped this guarantees we re-fetch.
    setDocs(null);
    // Keep the dropdown open so the user can switch then pick an asset
    // in one fluid motion — closing here would force a second click.
  };

  const createAgent = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    try {
      const res = await fetch("/api/brand/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const json = await res.json();
        const agent: BrandAgentType = { ...json.agent, doc_count: 0 };
        upsertAgent(agent);
        setSelected(agent.id);
        if (conv) setConversationAgent(conv.id, agent.id);
        setNewName("");
        setCreating(false);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg text-[13px] transition-all duration-150 active:scale-95 max-w-[180px] shrink-0 whitespace-nowrap",
          open
            ? "bg-[#f5f1ea] text-[var(--reverb-text-primary)]"
            : hasDocs
            ? "text-[var(--reverb-accent)] hover:bg-[#fbf3ee]"
            : "text-[var(--reverb-text-secondary)] hover:bg-[#f5f1ea] hover:text-[var(--reverb-text-primary)]"
        )}
        title={`${agentName} — generate assets in your brand voice`}
      >
        <BookOpen size={13} strokeWidth={2} />
        <span className="font-medium hidden sm:inline truncate">{agentName}</span>
        {hasDocs && (
          <span className="hidden sm:inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-md bg-[var(--reverb-accent)] text-white text-[9.5px] font-bold shrink-0">
            {docs?.length}
          </span>
        )}
        <ChevronDown size={11} className={cn("opacity-50 transition-transform duration-200 shrink-0", open && "rotate-180")} />
      </button>

      {open && (
        <>
          {/* Mobile backdrop */}
          <div className="sm:hidden fixed inset-0 bg-black/30 z-40 reverb-fade-in" onClick={() => setOpen(false)} />
        <div
          className={cn(
            "rounded-2xl overflow-hidden z-50 reverb-scale-in",
            "fixed left-3 right-3 bottom-[110px] max-h-[70vh] overflow-y-auto reverb-scroll",
            "sm:absolute sm:inset-auto sm:bottom-full sm:left-0 sm:mb-2 sm:w-[340px] sm:max-h-none sm:overflow-visible"
          )}
          style={{
            background: "var(--reverb-gradient-card)",
            border: "1px solid var(--reverb-border-soft)",
            boxShadow: "var(--reverb-shadow-xl)",
          }}
        >
          {/* Header */}
          <div className="px-4 pt-3.5 pb-3 border-b border-[var(--reverb-border-soft)]">
            <div className="flex items-center gap-2 mb-1">
              {effective ? (
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: effective.color }}
                />
              ) : (
                <Wand2 size={12} className="text-[var(--reverb-accent)] shrink-0" />
              )}
              <p className="text-[11.5px] font-bold tracking-tight text-[var(--reverb-text-primary)] truncate">
                {agentName}
              </p>
              {hasDocs && (
                <span className="ml-auto text-[10.5px] font-semibold text-emerald-700 px-1.5 py-0.5 rounded-md bg-emerald-50 shrink-0">
                  {docs!.length} doc{docs!.length === 1 ? "" : "s"}
                </span>
              )}
            </div>
            <p className="text-[11.5px] text-[var(--reverb-text-secondary)] leading-relaxed">
              Generate assets grounded in your uploaded brand documents.
            </p>
          </div>

          {/* Agent picker — switch between brand agents without leaving
              this dropdown. Single-agent users still see "+ New brand"
              so they can spin up a second one in two clicks. */}
          {(agents.length > 0 || creating) && (
            <div className="border-b border-[var(--reverb-border-soft)] py-1.5 bg-[#fbf8f4]">
              <div className="flex items-center justify-between px-4 pt-1 pb-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--reverb-text-tertiary)]">
                  Brand agents {agents.length > 0 && `· ${agents.length}`}
                </p>
                <Link
                  href="/agents"
                  onClick={() => setOpen(false)}
                  className="text-[10px] font-semibold text-[var(--reverb-accent)] hover:underline"
                >
                  Manage
                </Link>
              </div>

              <div className="max-h-[160px] overflow-y-auto reverb-scroll">
                {agents.map((a) => {
                  const active = effectiveAgentId === a.id;
                  return (
                    <button
                      key={a.id}
                      onClick={() => pickAgent(a)}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3.5 py-1.5 text-left transition-colors",
                        active ? "bg-[#fbf3ee]" : "hover:bg-[#faf6ef]"
                      )}
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: a.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-[var(--reverb-text-primary)] truncate">
                          {a.name}
                          {a.is_default && (
                            <span className="ml-1.5 text-[9px] font-bold uppercase tracking-wider text-[var(--reverb-accent)]">
                              default
                            </span>
                          )}
                        </p>
                      </div>
                      <span className="text-[10px] text-[var(--reverb-text-tertiary)] shrink-0">
                        {a.doc_count} doc{a.doc_count === 1 ? "" : "s"}
                      </span>
                      {active && <Check size={11} className="text-[var(--reverb-accent)] shrink-0" />}
                    </button>
                  );
                })}
              </div>

              {/* Inline create — same pattern as AgentSwitcher so users
                  who learn it in one place find it the same in the other. */}
              {creating ? (
                <div className="px-3.5 py-1.5 flex items-center gap-2">
                  <input
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value.slice(0, 60))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void createAgent();
                      if (e.key === "Escape") { setCreating(false); setNewName(""); }
                    }}
                    placeholder="e.g. Acme Co"
                    className="flex-1 text-[12px] font-medium bg-white border border-[var(--reverb-accent)] rounded-md px-2 py-1 focus:outline-none"
                  />
                  <button
                    onClick={() => void createAgent()}
                    disabled={busy || !newName.trim()}
                    className="px-2.5 py-1 rounded-md text-[11.5px] font-semibold reverb-btn-primary disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setCreating(true)}
                  className="w-full flex items-center gap-2 px-3.5 py-1.5 text-[12px] font-medium text-[var(--reverb-accent)] hover:bg-[#faf6ef] transition-colors"
                >
                  <Plus size={11} strokeWidth={2.5} /> New brand
                </button>
              )}
            </div>
          )}

          {/* Empty state */}
          {docs !== null && !hasDocs && (
            <div className="p-4">
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200">
                <AlertCircle size={14} className="shrink-0 mt-0.5 text-amber-600" />
                <div>
                  <p className="text-[12.5px] font-semibold text-amber-900">No brand documents yet</p>
                  <p className="text-[11.5px] text-amber-800 mt-0.5">
                    Brand Agent works best with your brand guidelines, style guide, or product info uploaded.
                  </p>
                  <Link
                    href="/brand"
                    onClick={() => setOpen(false)}
                    className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--reverb-accent)] hover:text-[var(--reverb-accent-rich)]"
                  >
                    <Upload size={11} /> Upload your first document
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Loading */}
          {docs === null && (
            <div className="px-4 py-6 text-center text-[12px] text-[var(--reverb-text-tertiary)]">
              Loading your brand library…
            </div>
          )}

          {/* Asset list */}
          {hasDocs && (
            <div className="max-h-[400px] overflow-y-auto reverb-scroll py-1.5">
              {ASSETS.map((a, i) => (
                <button
                  key={a.label}
                  onClick={() => pick(a)}
                  style={{ animationDelay: `${i * 30}ms` }}
                  className="w-full px-3.5 py-2.5 hover:bg-[#faf6ef] transition-colors flex items-start gap-2.5 text-left reverb-stagger-in"
                >
                  <div className={cn("w-8 h-8 shrink-0 rounded-lg flex items-center justify-center", a.bg)}
                    style={{ boxShadow: "var(--reverb-shadow-xs)" }}>
                    <a.icon size={14} className={a.color} strokeWidth={2.2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-semibold text-[var(--reverb-text-primary)] tracking-tight leading-snug">
                      {a.label}
                    </p>
                    <p className="text-[11px] text-[var(--reverb-text-secondary)] leading-relaxed mt-0.5">{a.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Footer */}
          {hasDocs && (
            <div className="px-4 py-2.5 border-t border-[var(--reverb-border-soft)] bg-[#fbf8f4]">
              <Link
                href="/brand"
                onClick={() => setOpen(false)}
                className="flex items-center justify-between gap-2 text-[11.5px] font-medium text-[var(--reverb-text-secondary)] hover:text-[var(--reverb-accent)] transition-colors"
              >
                <span>Manage brand library</span>
                <Upload size={11} />
              </Link>
            </div>
          )}
        </div>
        </>
      )}
    </div>
  );
}
