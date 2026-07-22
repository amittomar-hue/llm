"use client";

import { useEffect, useState, useRef, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion, useInView } from "framer-motion";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import {
  ArrowRight, Sparkles, Search, Globe, Target, MessageSquare,
  Layers, BarChart3, Activity, ShieldCheck, Zap, CheckCircle2,
  TrendingUp, Building2, Crosshair, Mail, Mic2, Wand2,
  BookOpen, FileText, Download, Paperclip, Mic, Hammer, Link as LinkIcon,
  Database, RefreshCw, Newspaper, BarChartHorizontal, FileBadge,
  GraduationCap, Clock, Plug,
} from "lucide-react";
import { listResources, type ResourceCategory } from "@/lib/resources";
import { InteractiveDemo } from "./InteractiveDemo";
import { SharedNav } from "./SharedNav";

// three.js/webgl imports are heavy — SSR-disable them so the initial
// HTML payload stays tiny and the shader only loads client-side.
const WebGLBackground = dynamic(
  () => import("./WebGLBackground").then((m) => m.WebGLBackground),
  { ssr: false, loading: () => null }
);

/** Wrapper that fades + rises its children when they scroll into view. */
function Reveal({ children, delay = 0, y = 20 }: { children: ReactNode; delay?: number; y?: number }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y }}
      transition={{ duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

const CAPABILITIES = [
  { icon: BookOpen, color: "text-[var(--dmoop-accent)]", bg: "bg-[#fbf3ee]", title: "Brand Agent", desc: "Name your own agent. Upload brand docs once. Every asset comes out on-voice." },
  { icon: LinkIcon, color: "text-blue-600", bg: "bg-blue-50", title: "Live Site Scraping", desc: "Paste any URL. DMOOP fetches the homepage + key pages and grounds answers in the real site." },
  { icon: Paperclip, color: "text-violet-600", bg: "bg-violet-50", title: "File Analysis", desc: "Drop in a PDF, Word, Excel, or PowerPoint — DMOOP parses it locally and answers from it." },
  { icon: Download, color: "text-emerald-600", bg: "bg-emerald-50", title: "Multi-Format Export", desc: "Ask in any format — PDF, Word, Excel, PowerPoint, CSV — and a download button appears." },
  { icon: Wand2, color: "text-fuchsia-600", bg: "bg-fuchsia-50", title: "Ad Copy & Creative", desc: "Google, Meta, LinkedIn, TikTok — variants tuned to your brand voice" },
  { icon: Mail, color: "text-teal-600", bg: "bg-teal-50", title: "Email Sequences", desc: "Launch sequences, nurture flows, cold outreach that converts" },
  { icon: Search, color: "text-sky-600", bg: "bg-sky-50", title: "SEO / AEO / GEO", desc: "Technical audits, AI-search citations, Generative Engine Optimization" },
  { icon: Layers, color: "text-indigo-600", bg: "bg-indigo-50", title: "ABM Playbooks", desc: "Tier-1 account strategies, multi-thread sequences, intent triggers" },
  { icon: Activity, color: "text-rose-600", bg: "bg-rose-50", title: "Buyer Signal Intelligence", desc: "Lead scoring, intent interpretation, propensity models" },
  { icon: Building2, color: "text-slate-700", bg: "bg-slate-100", title: "Company Signals", desc: "Hiring, funding, leadership moves, tech stack tracking" },
  { icon: Target, color: "text-amber-600", bg: "bg-amber-50", title: "GTM Strategy", desc: "Positioning, ICP, channel mix, 90-day launch plans" },
  { icon: Crosshair, color: "text-red-600", bg: "bg-red-50", title: "Competitor Intelligence", desc: "Teardowns, win/loss analysis, counter-positioning angles" },
  { icon: ShieldCheck, color: "text-teal-600", bg: "bg-teal-50", title: "Brand Reputation", desc: "Sentiment monitoring, crisis response, review strategy" },
  { icon: Mic2, color: "text-pink-600", bg: "bg-pink-50", title: "Voice Input", desc: "Hands-free briefs — Web Speech API, auto-restart on pauses" },
  { icon: BarChart3, color: "text-purple-600", bg: "bg-purple-50", title: "Marketing Analytics", desc: "Attribution, MMM/MTA, channel ROI math" },
  { icon: TrendingUp, color: "text-cyan-600", bg: "bg-cyan-50", title: "Trend Detection", desc: "130+ marketing topics across 13 asset types scraped every 6 hours" },
];

// Quick-action tools surfaced as button-style cards — mirrors the Tools menu in the chat.
const TOOL_DEMOS = [
  { icon: Search, title: "SEO audit",            sub: "Prioritized fix list with expected impact" },
  { icon: Wand2,  title: "Write ad copy",        sub: "3 variants per channel, brand-on" },
  { icon: Mail,   title: "Email sequence",       sub: "5-touch launch / nurture / cold flows" },
  { icon: Crosshair, title: "Competitor teardown", sub: "Counter-positioning angles ready to ship" },
  { icon: Activity, title: "Buyer signal analysis", sub: "Score leads + recommend next actions" },
  { icon: Mic2,    title: "Brand voice score",   sub: "Rate copy against your guidelines" },
  { icon: Target,  title: "GTM plan",            sub: "90-day launch plan for a new market" },
  { icon: Layers,  title: "ABM playbook",        sub: "Tier-1 motion across email + LinkedIn + paid" },
];

const HOW_IT_WORKS = [
  {
    n: "01",
    title: "Brief in any channel",
    desc: "Type, paste a URL, drop a PDF, or talk via voice. DMOOP scrapes the site, parses the file locally, or transcribes — all grounded as authoritative context for the answer.",
    icon: MessageSquare,
  },
  {
    n: "02",
    title: "Grounded in live marketing intel",
    desc: "Every answer pulls from 130+ topics × 13 asset types scraped every 6 hours — articles, ebooks, playbooks, case studies, ad campaigns, social posts, reports. Plus Tavily web search on demand.",
    icon: Globe,
  },
  {
    n: "03",
    title: "Your brand, locked in",
    desc: "Upload brand guidelines, ICP, past campaigns once. Name your Brand Agent. Every asset comes out in your voice — Tuned model retrieves your brand context as primary signal.",
    icon: BookOpen,
  },
  {
    n: "04",
    title: "Export to any format",
    desc: "Ask in PDF, Word, Excel, PowerPoint, CSV, JSON, Markdown — or say 'convert this to X' after any answer. Generated locally, nothing leaves your browser.",
    icon: Download,
  },
];

const MODELS = [
  {
    name: "Apex",
    badge: "Flagship",
    color: "from-violet-500 to-fuchsia-500",
    desc: "Deep strategy, executive briefs, complex multi-channel analysis",
  },
  {
    name: "Core",
    badge: "Recommended",
    color: "from-[#d8593a] to-[#b03e21]",
    desc: "Balanced workhorse for daily campaigns and trend analysis",
  },
  {
    name: "Pulse",
    badge: "Fast",
    color: "from-emerald-500 to-teal-500",
    desc: "Sub-second responses for quick ad copy and subject lines",
  },
  {
    name: "Tuned",
    badge: "Custom · RAG",
    color: "from-amber-500 to-orange-500",
    desc: "Continuously-learning model: 130+ marketing queries scraped every 6h → asset-type-aware Q&A pairs → retrieved as your primary knowledge",
  },
];

export default function LandingPage() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const sb = createSupabaseBrowserClient();
    sb.auth.getUser().then(({ data: { user } }) => setSignedIn(!!user));
  }, []);

  const primaryHref = signedIn ? "/chat" : "/signup";
  const primaryLabel = signedIn ? "Open DMOOP" : "Get started free";

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--dmoop-bg-app)" }}>
      <SharedNav />

      {/* ── Hero ────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Animated WebGL blob field — SSR-disabled, auto-pauses off-screen,
            respects prefers-reduced-motion. Sits at opacity 0.5 so text
            stays readable while the motion is felt. */}
        <div className="absolute inset-0 pointer-events-none opacity-55">
          <WebGLBackground />
        </div>
        {/* Extra ambient glows layered over the shader for depth */}
        <div
          className="absolute top-0 left-1/4 w-[700px] h-[500px] pointer-events-none opacity-40"
          style={{ background: "radial-gradient(ellipse at top, rgba(193,74,42,0.15) 0%, transparent 70%)" }}
        />
        <div
          className="absolute top-20 right-0 w-[500px] h-[500px] pointer-events-none opacity-25"
          style={{ background: "radial-gradient(ellipse at center, rgba(139,92,246,0.12) 0%, transparent 70%)" }}
        />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-10 sm:pt-24 pb-10 sm:pb-20 text-center">
          <div className="inline-flex items-center gap-2 px-3 sm:px-3.5 py-1 sm:py-1.5 rounded-full bg-white/80 backdrop-blur-sm border border-[var(--dmoop-border-soft)] shadow-[var(--dmoop-shadow-xs)] mb-5 sm:mb-6 dmoop-fade-in">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
            <span className="text-[10px] sm:text-[11px] font-semibold text-[var(--dmoop-text-secondary)] tracking-wide uppercase">
              <span className="hidden sm:inline">Live · Self-Learning · </span>Real-Time Intelligence
            </span>
          </div>

          <h1 className="text-[30px] sm:text-[54px] md:text-[64px] font-semibold tracking-tight text-[var(--dmoop-text-primary)] leading-[1.1] sm:leading-[1.05] mb-4 sm:mb-5 dmoop-fade-in">
            Marketing intelligence,
            <br />
            <span style={{
              background: "var(--dmoop-gradient-accent)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}>
              fine-tuned for your brand.
            </span>
          </h1>

          <p className="text-[14px] sm:text-[18px] text-[var(--dmoop-text-secondary)] max-w-2xl mx-auto leading-relaxed mb-6 sm:mb-8 dmoop-fade-in px-2 sm:px-0">
            DMOOP is the enterprise AI for the full marketing surface. Upload your brand docs, name your Brand Agent, paste a URL, drop a file, export to any format — every answer grounded in <strong className="font-semibold text-[var(--dmoop-text-primary)]">130+ marketing topics scraped every 6 hours</strong>.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-3 dmoop-fade-in">
            <Link
              href={primaryHref}
              className="w-full sm:w-auto h-11 sm:h-12 px-6 sm:px-7 rounded-xl dmoop-btn-primary text-[13.5px] sm:text-[14px] font-semibold flex items-center justify-center gap-2"
            >
              {primaryLabel} <ArrowRight size={15} />
            </Link>
            <Link
              href="#features"
              className="w-full sm:w-auto h-11 sm:h-12 px-6 sm:px-7 rounded-xl bg-white border border-[var(--dmoop-border-soft)] text-[13.5px] sm:text-[14px] font-semibold text-[var(--dmoop-text-primary)] hover:shadow-[var(--dmoop-shadow-md)] transition-all flex items-center justify-center gap-2"
            >
              See what it does
            </Link>
          </div>

          <div className="mt-7 sm:mt-10 flex flex-wrap items-center justify-center gap-x-3 sm:gap-x-6 gap-y-2 text-[11px] sm:text-[12px] text-[var(--dmoop-text-tertiary)] dmoop-fade-in">
            <span className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-emerald-600" /> No credit card</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-emerald-600" /> 130+ topics × 13 asset types</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-emerald-600" /> 4 models · Brand Agent</span>
            <span className="hidden sm:flex items-center gap-1.5"><CheckCircle2 size={12} className="text-emerald-600" /> Live site scraping · file analysis</span>
          </div>
        </div>

        {/* Interactive Demo — animated widget showing DMOOP producing
            a real CRM-grounded email (types out, cycles between scripts). */}
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 pb-12 sm:pb-24">
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <InteractiveDemo />
          </motion.div>
        </div>

        {/* Original static preview kept below the interactive demo but
            hidden by default — leaving the component tree here would
            break existing scroll anchors. Wrapped in `false && …` via
            a comment fence: the JSX below is preserved but visually
            suppressed via a display:none style until a future revamp. */}
        <div style={{ display: "none" }}>
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pb-12 sm:pb-24">
          <div
            className="rounded-xl sm:rounded-2xl overflow-hidden mx-auto"
            style={{
              background: "var(--dmoop-gradient-card)",
              border: "1px solid var(--dmoop-border-soft)",
              boxShadow: "var(--dmoop-shadow-xl)",
            }}
          >
            {/* Browser chrome */}
            <div className="px-3 sm:px-4 py-2 sm:py-2.5 border-b border-[var(--dmoop-border-soft)] flex items-center gap-1.5 bg-[#f9f5ee]">
              <span className="w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full bg-[#e8a293]" />
              <span className="w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full bg-[#e8c993]" />
              <span className="w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full bg-[#a0c898]" />
              <span className="ml-2 sm:ml-3 text-[10px] sm:text-[11px] font-medium text-[var(--dmoop-text-tertiary)] truncate">
                DMOOP <span className="hidden sm:inline">— dmoop.com/chat</span>
              </span>
            </div>

            <div className="p-4 sm:p-8 bg-gradient-to-br from-[#fdfcfa] to-[#f7f3eb]">
              {/* User prompt bubble */}
              <div className="flex justify-end mb-3 sm:mb-4">
                <div className="max-w-[80%] px-3.5 py-2 rounded-2xl text-[12px] sm:text-[13.5px] text-[var(--dmoop-text-primary)]"
                  style={{
                    background: "linear-gradient(135deg, #f3eee6 0%, #ebe5da 100%)",
                    border: "1px solid rgba(165, 138, 110, 0.15)",
                  }}>
                  Check acmehire.io — then create a GTM and give it to me as a Word doc.
                </div>
              </div>

              {/* Assistant response */}
              <div className="flex items-start gap-2.5 sm:gap-3 mb-4">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white border border-[var(--dmoop-border-soft)] p-1.5 shrink-0 flex items-center justify-center shadow-[var(--dmoop-shadow-sm)]">
                  <Image src="/dmoop-logo.png" alt="DMOOP" width={60} height={20} className="w-full h-auto object-contain" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11.5px] sm:text-[12px] font-semibold text-[var(--dmoop-text-primary)]">
                    DMOOP <span className="text-[var(--dmoop-accent)] ml-1">Tuned</span>
                    <span className="ml-2 text-[9.5px] font-medium px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">scraped 5 pages</span>
                  </p>
                  <p className="text-[12px] sm:text-[14px] text-[var(--dmoop-text-primary)] leading-relaxed mt-1.5">
                    <strong className="font-semibold">TL;DR.</strong> Acmehire.io is an AI hiring platform — automated screening, ranking, and candidate engagement. GTM should target Series B-D startups and mid-market recruiting agencies via signal-based outbound + content-led PLG.
                  </p>

                  <p className="text-[12.5px] sm:text-[13.5px] font-semibold text-[var(--dmoop-text-primary)] mt-3 mb-1.5">## ICP &amp; Positioning</p>
                  <ul className="text-[11.5px] sm:text-[13px] text-[var(--dmoop-text-primary)] space-y-1 ml-4 list-disc marker:text-[var(--dmoop-text-tertiary)]">
                    <li><strong>Primary ICP:</strong> 100-500-person SaaS hiring 5+ engineers/quarter <em className="not-italic text-[var(--dmoop-text-tertiary)]">[W1]</em></li>
                    <li><strong>Wedge:</strong> &quot;screening cycle &lt; 24h&quot; vs Gem (3-5d) and Greenhouse manual <em className="not-italic text-[var(--dmoop-text-tertiary)]">[W2]</em></li>
                    <li><strong>Pricing wedge:</strong> per-hire (not per-seat) — undercuts Lever/Greenhouse on burst hiring</li>
                  </ul>

                  <p className="text-[12.5px] sm:text-[13.5px] font-semibold text-[var(--dmoop-text-primary)] mt-3 mb-1.5">## 90-day Channel Mix</p>
                  <div className="overflow-x-auto -mx-1 sm:mx-0">
                    <table className="w-full text-[11px] sm:text-[12.5px] border border-[var(--dmoop-border-soft)] rounded-lg">
                      <thead className="bg-[#f9f5ee] text-[10px] sm:text-[11px] uppercase tracking-wide text-[var(--dmoop-text-secondary)]">
                        <tr>
                          <th className="px-2 py-1.5 text-left">Channel</th>
                          <th className="px-2 py-1.5 text-left">Tactic</th>
                          <th className="px-2 py-1.5 text-left">Target</th>
                        </tr>
                      </thead>
                      <tbody className="text-[var(--dmoop-text-primary)]">
                        <tr className="border-t border-[var(--dmoop-border-soft)]"><td className="px-2 py-1.5">LinkedIn</td><td className="px-2 py-1.5">Signal-based outbound</td><td className="px-2 py-1.5">60 SQLs / mo</td></tr>
                        <tr className="border-t border-[var(--dmoop-border-soft)]"><td className="px-2 py-1.5">Content</td><td className="px-2 py-1.5">Recruiter-focused SEO</td><td className="px-2 py-1.5">8K organic / mo</td></tr>
                        <tr className="border-t border-[var(--dmoop-border-soft)]"><td className="px-2 py-1.5">PLG</td><td className="px-2 py-1.5">Free Chrome ATS-scraper</td><td className="px-2 py-1.5">1.5K signups</td></tr>
                      </tbody>
                    </table>
                  </div>

                  <p className="text-[10.5px] sm:text-[11.5px] text-[var(--dmoop-text-tertiary)] pt-3 mt-3 border-t border-[var(--dmoop-border-soft)] truncate">
                    Sources [W1] acmehire.io/about · [W2] acmehire.io/product · [W3] acmehire.io/pricing
                  </p>

                  {/* Download button */}
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <button className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11.5px] sm:text-[12px] font-semibold dmoop-btn-primary cursor-default">
                      <Download size={12} /> Download as Word (.docx)
                    </button>
                    <span className="text-[10px] sm:text-[10.5px] text-[var(--dmoop-text-tertiary)]">Generated locally · nothing leaves your browser</span>
                  </div>
                </div>
              </div>

              {/* Faux input bar reflecting the real one */}
              <div className="mt-4 sm:mt-5 rounded-xl p-2.5 sm:p-3 bg-white border border-[var(--dmoop-border-soft)] flex items-center gap-1.5 sm:gap-2 text-[10.5px] sm:text-[11.5px] text-[var(--dmoop-text-tertiary)]">
                <Paperclip size={12} />
                <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-[#fbf3ee] text-[var(--dmoop-accent)] font-semibold">
                  <Globe size={11} /> Search · On
                </span>
                <span className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-md bg-[#f5f1ea] font-medium">
                  <BookOpen size={11} /> Brand Agent
                </span>
                <span className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-md bg-[#f5f1ea] font-medium">
                  <Hammer size={11} /> Tools
                </span>
                <span className="flex-1 truncate">How can DMOOP help you today?</span>
                <span className="hidden sm:inline px-2 py-1 rounded-md bg-[#f5f1ea] font-semibold text-[var(--dmoop-accent)]">
                  Tuned
                </span>
                <Mic size={12} />
              </div>
            </div>
          </div>
        </div>
        </div>{/* /display:none preview */}
      </section>

      {/* ── Integrations quick pitch ─────────────────────── */}
      <section className="relative py-10 sm:py-14 border-t border-[var(--dmoop-border-soft)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <Reveal>
            <div className="rounded-3xl p-6 sm:p-10 border border-[var(--dmoop-border-soft)]" style={{ background: "linear-gradient(135deg, #fdfbf7 0%, #f7f1e5 100%)" }}>
              <div className="grid md:grid-cols-[1fr_auto] gap-6 items-center">
                <div>
                  <div className="inline-flex items-center gap-1.5 text-[10.5px] font-bold tracking-[0.14em] text-[var(--dmoop-accent)] uppercase mb-2">
                    <Plug size={11} /> CRM Integrations
                  </div>
                  <h2 className="text-[22px] sm:text-[28px] font-semibold tracking-tight text-[var(--dmoop-text-primary)] leading-tight mb-2">
                    Connect HubSpot or Zoho and every message writes itself into the recipient&apos;s context.
                  </h2>
                  <p className="text-[13.5px] sm:text-[14.5px] text-[var(--dmoop-text-secondary)] leading-relaxed">
                    DMOOP looks up the contact live: lifecycle stage, deal, last touchpoint, source. Emails reference them by first name and pick up where the last call left off — not generic copy pasted from a template.
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-[22px] shadow-lg" style={{ background: "#ff7a59" }}>H</div>
                    <span className="text-[11px] font-semibold text-[var(--dmoop-text-secondary)]">HubSpot</span>
                  </div>
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-[22px] shadow-lg" style={{ background: "#e42527" }}>Z</div>
                    <span className="text-[11px] font-semibold text-[var(--dmoop-text-secondary)]">Zoho</span>
                  </div>
                  <Link href="/integrations" className="ml-2 h-11 px-5 rounded-xl dmoop-btn-primary text-[13px] font-semibold flex items-center gap-1.5">
                    Explore <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────── */}
      <section id="features" className="relative py-12 sm:py-24 border-t border-[var(--dmoop-border-soft)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-8 sm:mb-12">
            <p className="text-[10.5px] sm:text-[11px] font-bold tracking-[0.14em] text-[var(--dmoop-accent)] uppercase mb-2.5 sm:mb-3">
              Capabilities
            </p>
            <h2 className="text-[24px] sm:text-[40px] font-semibold tracking-tight text-[var(--dmoop-text-primary)] mb-2.5 sm:mb-3 leading-tight px-2">
              The full marketing surface, in one chat.
            </h2>
            <p className="text-[15px] text-[var(--dmoop-text-secondary)] max-w-2xl mx-auto">
              DMOOP isn&apos;t a single-task tool. It handles every marketing function with the same depth, grounded in real-time data.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {CAPABILITIES.map((c, i) => (
              <div
                key={c.title}
                style={{ animationDelay: `${i * 40}ms` }}
                className="group p-5 rounded-2xl bg-[var(--dmoop-gradient-card)] border border-[var(--dmoop-border-soft)] dmoop-card dmoop-stagger-in"
              >
                <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center mb-3 transition-transform duration-200 group-hover:scale-110`}
                  style={{ boxShadow: "var(--dmoop-shadow-xs)" }}>
                  <c.icon size={17} className={c.color} strokeWidth={2.2} />
                </div>
                <h3 className="text-[14px] font-semibold tracking-tight text-[var(--dmoop-text-primary)] mb-1">
                  {c.title}
                </h3>
                <p className="text-[12.5px] text-[var(--dmoop-text-secondary)] leading-relaxed">
                  {c.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Brand Agent showcase ─────────────────────────── */}
      <section id="brand-agent" className="relative py-12 sm:py-24 border-t border-[var(--dmoop-border-soft)] bg-gradient-to-b from-transparent to-[#fbf6ec]/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-8 sm:mb-12">
            <p className="text-[10.5px] sm:text-[11px] font-bold tracking-[0.14em] text-[var(--dmoop-accent)] uppercase mb-2.5 sm:mb-3">
              Brand Agent
            </p>
            <h2 className="text-[24px] sm:text-[40px] font-semibold tracking-tight text-[var(--dmoop-text-primary)] mb-2.5 sm:mb-3 leading-tight px-2">
              Name your agent. Upload your brand. Every asset on-voice.
            </h2>
            <p className="text-[13px] sm:text-[15px] text-[var(--dmoop-text-secondary)] max-w-2xl mx-auto px-2">
              Drop in your brand guidelines, product datasheets, messaging frameworks, ICP, and past campaigns once. DMOOP indexes them and uses them as the source of truth on every asset you generate.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Brand Library card */}
            <div className="rounded-2xl p-5 sm:p-6 dmoop-card"
              style={{ background: "var(--dmoop-gradient-card)", border: "1px solid var(--dmoop-border-soft)" }}>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[#fbf3ee] flex items-center justify-center"
                  style={{ boxShadow: "var(--dmoop-shadow-xs)" }}>
                  <BookOpen size={17} className="text-[var(--dmoop-accent)]" strokeWidth={2.2} />
                </div>
                <div>
                  <p className="text-[14px] sm:text-[15px] font-semibold tracking-tight text-[var(--dmoop-text-primary)]">Brand Library</p>
                  <p className="text-[11.5px] text-[var(--dmoop-text-secondary)]">Per-user, RAG-indexed, similarity-ranked</p>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                {[
                  { icon: FileText, name: "Brand_Voice_Guide_v3.pdf",  type: "Brand guidelines",      chunks: 12 },
                  { icon: FileText, name: "ICP_Personas_2026.docx",    type: "ICP / personas",        chunks: 8  },
                  { icon: FileText, name: "Messaging_Framework.docx",  type: "Messaging framework",   chunks: 6  },
                  { icon: FileText, name: "Q1_Pillar_Campaign.pptx",   type: "Past campaign",         chunks: 14 },
                ].map((doc) => (
                  <div key={doc.name} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white border border-[var(--dmoop-border-soft)]">
                    <doc.icon size={13} className="text-[var(--dmoop-text-secondary)] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium text-[var(--dmoop-text-primary)] truncate">{doc.name}</p>
                      <p className="text-[10px] text-[var(--dmoop-text-tertiary)]">{doc.type} · {doc.chunks} chunks</p>
                    </div>
                    <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 text-[11px] text-[var(--dmoop-text-tertiary)] pt-3 border-t border-[var(--dmoop-border-soft)]">
                <Database size={12} className="text-[var(--dmoop-accent)]" />
                <span>40 chunks · 24,800 chars indexed · pg_trgm similarity</span>
              </div>
            </div>

            {/* Custom-named agent card */}
            <div className="rounded-2xl p-5 sm:p-6 dmoop-card"
              style={{ background: "var(--dmoop-gradient-card)", border: "1px solid var(--dmoop-border-soft)" }}>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: "var(--dmoop-gradient-accent)", boxShadow: "var(--dmoop-shadow-accent)" }}>
                  <Sparkles size={17} className="text-white" strokeWidth={2.2} />
                </div>
                <div>
                  <p className="text-[14px] sm:text-[15px] font-semibold tracking-tight text-[var(--dmoop-text-primary)]">Your custom agent</p>
                  <p className="text-[11.5px] text-[var(--dmoop-text-secondary)]">Give it a name. It speaks for your team.</p>
                </div>
              </div>

              <div className="mb-3.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--dmoop-text-tertiary)]">Agent name</label>
                <div className="mt-1 px-3 py-2 rounded-lg bg-white border border-[var(--dmoop-border-soft)] flex items-center gap-2">
                  <span className="text-[14px] font-semibold text-[var(--dmoop-text-primary)]">Maya</span>
                  <span className="text-[11.5px] text-[var(--dmoop-text-tertiary)]">— Brand Agent for Acme Co</span>
                </div>
              </div>

              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--dmoop-text-tertiary)] mb-2">9 asset templates ready</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  "Landing page", "LinkedIn post", "Cold email",
                  "Ad copy variants", "Whitepaper outline", "Blog post",
                  "Sales deck", "Case study", "Newsletter",
                ].map((t) => (
                  <span key={t} className="text-[11px] px-2.5 py-1 rounded-md bg-[#fbf3ee] text-[var(--dmoop-accent-rich)] font-medium border border-[#f1e3d6]">
                    {t}
                  </span>
                ))}
              </div>

              <div className="mt-4 p-3 rounded-lg bg-[#faf6ef] border border-[var(--dmoop-border-soft)]">
                <p className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--dmoop-text-tertiary)] mb-1">How Maya answers</p>
                <p className="text-[12px] text-[var(--dmoop-text-primary)] leading-relaxed">
                  Pulls from your brand guidelines + ICP + past campaigns, then matches the voice every time. No generic AI prose — just your brand, on tap.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Tools demo ───────────────────────────────────── */}
      <section id="tools" className="relative py-12 sm:py-24 border-t border-[var(--dmoop-border-soft)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-8 sm:mb-12">
            <p className="text-[10.5px] sm:text-[11px] font-bold tracking-[0.14em] text-[var(--dmoop-accent)] uppercase mb-2.5 sm:mb-3">
              Tools
            </p>
            <h2 className="text-[24px] sm:text-[40px] font-semibold tracking-tight text-[var(--dmoop-text-primary)] mb-2.5 sm:mb-3 leading-tight px-2">
              One-tap quick actions for every marketing task.
            </h2>
            <p className="text-[13px] sm:text-[15px] text-[var(--dmoop-text-secondary)] max-w-2xl mx-auto px-2">
              Click any tool to pre-fill DMOOP with a structured brief. Customize the slot inputs (product, audience, market) and send.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5">
            {TOOL_DEMOS.map((t, i) => (
              <div
                key={t.title}
                style={{ animationDelay: `${i * 40}ms` }}
                className="group p-4 rounded-2xl bg-white border border-[var(--dmoop-border-soft)] dmoop-card dmoop-stagger-in"
              >
                <div className="flex items-center gap-2.5 mb-1.5">
                  <div className="w-8 h-8 rounded-lg bg-[#fbf3ee] flex items-center justify-center group-hover:scale-110 transition-transform">
                    <t.icon size={14} className="text-[var(--dmoop-accent)]" strokeWidth={2.2} />
                  </div>
                  <p className="text-[13px] font-semibold tracking-tight text-[var(--dmoop-text-primary)]">{t.title}</p>
                </div>
                <p className="text-[11.5px] text-[var(--dmoop-text-secondary)] leading-relaxed">{t.sub}</p>
              </div>
            ))}
          </div>

          {/* Inline mini-demo strip */}
          <div className="mt-7 sm:mt-9 rounded-2xl p-4 sm:p-5"
            style={{ background: "var(--dmoop-gradient-card)", border: "1px solid var(--dmoop-border-soft)" }}>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: "var(--dmoop-gradient-accent)", boxShadow: "var(--dmoop-shadow-accent)" }}>
                  <RefreshCw size={15} className="text-white" />
                </div>
                <p className="text-[12.5px] sm:text-[13.5px] font-semibold text-[var(--dmoop-text-primary)]">Convert any answer</p>
              </div>
              <p className="text-[12px] sm:text-[13px] text-[var(--dmoop-text-secondary)] flex-1 leading-relaxed">
                Type <span className="px-1.5 py-0.5 rounded bg-[#faf6ef] font-mono text-[11px]">&quot;convert this to PDF&quot;</span> after any answer — DMOOP packages it instantly without re-calling the model. Works for PDF, Word, Excel, PowerPoint, CSV, JSON, Markdown.
              </p>
              <div className="flex flex-wrap gap-1.5 shrink-0">
                {["PDF", "DOCX", "XLSX", "PPTX", "CSV"].map((f) => (
                  <span key={f} className="text-[10.5px] px-2 py-0.5 rounded-md bg-white border border-[var(--dmoop-border-soft)] font-semibold text-[var(--dmoop-text-secondary)]">
                    {f}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────── */}
      <section id="how" className="relative py-12 sm:py-24 border-t border-[var(--dmoop-border-soft)] bg-gradient-to-b from-transparent to-[#fbf6ec]/40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-8 sm:mb-12">
            <p className="text-[10.5px] sm:text-[11px] font-bold tracking-[0.14em] text-[var(--dmoop-accent)] uppercase mb-2.5 sm:mb-3">
              How it works
            </p>
            <h2 className="text-[24px] sm:text-[40px] font-semibold tracking-tight text-[var(--dmoop-text-primary)] mb-2.5 sm:mb-3 leading-tight px-2">
              Three steps from question to insight.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {HOW_IT_WORKS.map((s, i) => (
              <div
                key={s.n}
                style={{ animationDelay: `${i * 80}ms` }}
                className="relative p-6 rounded-2xl bg-[var(--dmoop-gradient-card)] border border-[var(--dmoop-border-soft)] dmoop-card dmoop-stagger-in"
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[28px] font-bold tracking-tight"
                    style={{
                      background: "var(--dmoop-gradient-accent)",
                      WebkitBackgroundClip: "text",
                      backgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}>
                    {s.n}
                  </span>
                  <div className="w-10 h-10 rounded-xl bg-[#fbf3ee] flex items-center justify-center" style={{ boxShadow: "var(--dmoop-shadow-xs)" }}>
                    <s.icon size={16} className="text-[var(--dmoop-accent)]" strokeWidth={2.2} />
                  </div>
                </div>
                <h3 className="text-[16px] font-semibold tracking-tight text-[var(--dmoop-text-primary)] mb-2">
                  {s.title}
                </h3>
                <p className="text-[13px] text-[var(--dmoop-text-secondary)] leading-relaxed">
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Models ──────────────────────────────────────── */}
      <section id="models" className="relative py-12 sm:py-24 border-t border-[var(--dmoop-border-soft)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-8 sm:mb-12">
            <p className="text-[10.5px] sm:text-[11px] font-bold tracking-[0.14em] text-[var(--dmoop-accent)] uppercase mb-2.5 sm:mb-3">
              Models
            </p>
            <h2 className="text-[24px] sm:text-[40px] font-semibold tracking-tight text-[var(--dmoop-text-primary)] mb-2.5 sm:mb-3 leading-tight px-2">
              Four models. One DMOOP.
            </h2>
            <p className="text-[13px] sm:text-[15px] text-[var(--dmoop-text-secondary)] max-w-xl mx-auto px-2">
              Pick the right brain for the task. Switch anytime mid-conversation.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {MODELS.map((m, i) => (
              <div
                key={m.name}
                style={{ animationDelay: `${i * 60}ms` }}
                className="relative p-5 rounded-2xl bg-[var(--dmoop-gradient-card)] border border-[var(--dmoop-border-soft)] overflow-hidden dmoop-card dmoop-stagger-in"
              >
                <div className={`absolute -top-10 -right-10 w-32 h-32 rounded-full bg-gradient-to-br ${m.color} opacity-25 blur-2xl`} />
                <div className="relative">
                  <div className={`w-9 h-9 rounded-xl bg-white border border-[var(--dmoop-border-soft)] p-1.5 flex items-center justify-center mb-3`} style={{ boxShadow: "var(--dmoop-shadow-xs)" }}>
                    <Image src="/dmoop-logo.png" alt="DMOOP" width={50} height={16} className="w-full h-auto object-contain" />
                  </div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <h3 className="text-[15px] font-bold tracking-tight text-[var(--dmoop-text-primary)]">{m.name}</h3>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-md font-bold tracking-wide uppercase"
                      style={{ background: "rgba(193,74,42,0.1)", color: "var(--dmoop-accent)" }}>
                      {m.badge}
                    </span>
                  </div>
                  <p className="text-[12px] text-[var(--dmoop-text-secondary)] leading-relaxed">{m.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Resources (blogs · case studies · whitepapers · guides) ── */}
      <section id="resources" className="relative py-12 sm:py-24 border-t border-[var(--dmoop-border-soft)] bg-gradient-to-b from-transparent to-[#fbf6ec]/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-8 sm:mb-12">
            <p className="text-[10.5px] sm:text-[11px] font-bold tracking-[0.14em] text-[var(--dmoop-accent)] uppercase mb-2.5 sm:mb-3">
              Resources
            </p>
            <h2 className="text-[24px] sm:text-[40px] font-semibold tracking-tight text-[var(--dmoop-text-primary)] mb-2.5 sm:mb-3 leading-tight px-2">
              Marketing intelligence, in writing.
            </h2>
            <p className="text-[13px] sm:text-[15px] text-[var(--dmoop-text-secondary)] max-w-2xl mx-auto px-2">
              Blogs, case studies, whitepapers and field guides from the DMOOP team — built for marketers shipping campaigns, not benchmark posts.
            </p>
          </div>

          {/* Category filter chips (visual — link to full /resources index) */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-6 sm:mb-8">
            {(["All", "Blog", "Case Study", "Whitepaper", "Guide"] as const).map((c) => (
              <Link
                key={c}
                href="/resources"
                className={`text-[11.5px] font-semibold px-3 py-1.5 rounded-full border transition-all ${
                  c === "All"
                    ? "bg-[var(--dmoop-accent)] text-white border-[var(--dmoop-accent)]"
                    : "bg-white text-[var(--dmoop-text-secondary)] border-[var(--dmoop-border-soft)] hover:border-[var(--dmoop-accent)] hover:text-[var(--dmoop-accent)]"
                }`}
              >
                {c}
              </Link>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {listResources().map((r) => (
              <ResourceCard
                key={r.slug}
                slug={r.slug}
                category={r.category}
                title={r.title}
                summary={r.summary}
                readMinutes={r.readMinutes}
                publishedAt={r.publishedAt}
                author={r.author}
              />
            ))}
          </div>

          {/* Footer strip */}
          <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 text-[11.5px] text-[var(--dmoop-text-tertiary)]">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={11} className="text-emerald-600" />
              New articles every two weeks — published by the DMOOP team
            </span>
            <span className="hidden sm:block h-3 w-px bg-[var(--dmoop-border-soft)]" />
            <Link href="/resources" className="flex items-center gap-1.5 font-semibold text-[var(--dmoop-accent)] hover:underline">
              Browse all resources <ArrowRight size={11} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────── */}
      <section className="relative py-12 sm:py-24 border-t border-[var(--dmoop-border-soft)]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <div className="relative p-6 sm:p-12 rounded-2xl sm:rounded-3xl overflow-hidden"
            style={{
              background: "var(--dmoop-gradient-card)",
              border: "1px solid var(--dmoop-border-soft)",
              boxShadow: "var(--dmoop-shadow-xl)",
            }}>
            <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-gradient-to-br from-[#d8593a]/30 to-[#b03e21]/30 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full bg-gradient-to-br from-violet-500/20 to-pink-500/20 blur-3xl pointer-events-none" />

            <div className="relative">
              <Zap size={28} className="mx-auto text-[var(--dmoop-accent)] mb-3 sm:mb-4 sm:size-8" strokeWidth={2.2} />
              <h2 className="text-[22px] sm:text-[36px] font-semibold tracking-tight text-[var(--dmoop-text-primary)] mb-2.5 sm:mb-3 leading-tight">
                Try DMOOP free.
              </h2>
              <p className="text-[13px] sm:text-[15px] text-[var(--dmoop-text-secondary)] mb-5 sm:mb-6 max-w-md mx-auto px-2">
                No credit card. Sign up, upload your brand docs, name your Brand Agent, and ship your first on-voice asset in under 5 minutes.
              </p>
              <Link
                href={primaryHref}
                className="h-11 sm:h-12 px-6 sm:px-7 rounded-xl dmoop-btn-primary text-[13.5px] sm:text-[14px] font-semibold inline-flex items-center gap-2"
              >
                {primaryLabel} <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────── */}
      <footer className="relative py-8 border-t border-[var(--dmoop-border-soft)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Image src="/dmoop-logo.png" alt="DMOOP" width={100} height={28} className="h-6 w-auto" />
            <span className="text-[11px] text-[var(--dmoop-text-tertiary)]">© {new Date().getFullYear()} DMOOP</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12px] text-[var(--dmoop-text-secondary)]">
            <Link href="/signin" className="hover:text-[var(--dmoop-text-primary)] transition-colors">Sign in</Link>
            <Link href="/signup" className="hover:text-[var(--dmoop-text-primary)] transition-colors">Get started</Link>
            <Link href="/docs/api" className="hover:text-[var(--dmoop-text-primary)] transition-colors">API</Link>
            <Link href="/privacy" className="hover:text-[var(--dmoop-text-primary)] transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-[var(--dmoop-text-primary)] transition-colors">Terms</Link>
            <span className="hidden md:inline text-[var(--dmoop-text-tertiary)]">Enterprise marketing intelligence</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Resource card — surfaces a real article (blog / case study /
// whitepaper / guide). Links to /resources/[slug] which renders
// full content with the Markdown component.
// ─────────────────────────────────────────────────────────────────
const CATEGORY_STYLE: Record<
  ResourceCategory,
  { icon: React.ComponentType<{ size: number; className?: string; strokeWidth?: number }>; accent: string; iconBg: string; iconColor: string; chipBg: string; chipText: string }
> = {
  Blog: {
    icon: Newspaper,
    accent: "from-sky-500 to-blue-500",
    iconBg: "bg-sky-50",
    iconColor: "text-sky-600",
    chipBg: "bg-sky-50",
    chipText: "text-sky-700",
  },
  "Case Study": {
    icon: BarChartHorizontal,
    accent: "from-emerald-500 to-teal-500",
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    chipBg: "bg-emerald-50",
    chipText: "text-emerald-700",
  },
  Whitepaper: {
    icon: FileBadge,
    accent: "from-violet-500 to-fuchsia-500",
    iconBg: "bg-violet-50",
    iconColor: "text-violet-600",
    chipBg: "bg-violet-50",
    chipText: "text-violet-700",
  },
  Guide: {
    icon: GraduationCap,
    accent: "from-[#d8593a] to-[#b03e21]",
    iconBg: "bg-[#fbf3ee]",
    iconColor: "text-[var(--dmoop-accent)]",
    chipBg: "bg-[#fbf3ee]",
    chipText: "text-[var(--dmoop-accent-rich)]",
  },
};

function ResourceCard({
  slug,
  category,
  title,
  summary,
  readMinutes,
  publishedAt,
  author,
}: {
  slug: string;
  category: ResourceCategory;
  title: string;
  summary: string;
  readMinutes: number;
  publishedAt: string;
  author: string;
}) {
  const style = CATEGORY_STYLE[category];
  const Icon = style.icon;
  const published = new Date(publishedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Link
      href={`/resources/${slug}`}
      className="group relative p-5 rounded-2xl bg-[var(--dmoop-gradient-card)] border border-[var(--dmoop-border-soft)] overflow-hidden dmoop-card dmoop-stagger-in flex flex-col"
    >
      {/* Hover glow */}
      <div className={`absolute -top-16 -right-16 w-40 h-40 rounded-full bg-gradient-to-br ${style.accent} opacity-0 group-hover:opacity-20 blur-2xl transition-opacity duration-500 pointer-events-none`} />

      <div className="relative flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl ${style.iconBg} flex items-center justify-center transition-transform duration-300 group-hover:scale-110`}
          style={{ boxShadow: "var(--dmoop-shadow-xs)" }}>
          <Icon size={17} className={style.iconColor} strokeWidth={2.2} />
        </div>
        <span className={`text-[9.5px] font-bold tracking-wider uppercase ${style.chipText} ${style.chipBg} px-2 py-0.5 rounded-md`}>
          {category}
        </span>
      </div>

      <h3 className="relative text-[15px] font-semibold tracking-tight text-[var(--dmoop-text-primary)] mb-1.5 leading-snug line-clamp-2">
        {title}
      </h3>
      <p className="relative text-[12.5px] text-[var(--dmoop-text-secondary)] leading-relaxed mb-4 flex-1 line-clamp-4">
        {summary}
      </p>

      <div className="relative flex items-center justify-between text-[11px] text-[var(--dmoop-text-tertiary)] pt-3 border-t border-[var(--dmoop-border-soft)]">
        <span className="flex items-center gap-1.5">
          <Clock size={10} /> {readMinutes} min read
        </span>
        <span className="truncate ml-2">{published}</span>
      </div>

      <div className="relative mt-3 flex items-center justify-between">
        <span className="text-[10.5px] font-medium text-[var(--dmoop-text-tertiary)] truncate">
          By {author}
        </span>
        <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--dmoop-accent)] group-hover:gap-2 transition-all">
          Read <ArrowRight size={12} className="transition-transform duration-200 group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}
