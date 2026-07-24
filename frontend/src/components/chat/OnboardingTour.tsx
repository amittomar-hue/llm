"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import {
  Sparkles, Globe, Paperclip, Hammer, ThumbsUp, ThumbsDown, Radar,
  Shield, ArrowRight, ArrowLeft, X, CheckCircle2, BookOpen, FileText,
  Mic, Mic2, Link as LinkIcon, Download, Smartphone, Cloud, ShieldCheck,
  Search, Wand2, Mail, Crosshair, Target, Layers, Activity, Database,
} from "lucide-react";
import { cn } from "@/lib/utils";

// v2 bumped because the tour content is wholly new — every existing
// signed-in user who dismissed v1 sees v2 once and can dismiss again.
const STORAGE_KEY = "reverb_onboarded_v2";

interface Step {
  icon: React.ComponentType<{ size: number; className?: string; strokeWidth?: number }>;
  title: string;
  subtitle: string;
  body: React.ReactNode;
  accent: string;
}

// ─────────────────────────────────────────────────────────────────
// Visual mockup tiles — small product UI hints rendered inside each
// step body. Kept inline (not extracted as components) so each step's
// body is self-contained and easy to edit.
// ─────────────────────────────────────────────────────────────────

const STEPS: Step[] = [
  // 01 — Welcome
  {
    icon: Sparkles,
    title: "Welcome to Reverb",
    subtitle: "Enterprise marketing intelligence, fine-tuned for your brand",
    accent: "from-violet-500 to-fuchsia-500",
    body: (
      <>
        <p>
          Reverb handles the full surface of modern marketing — SEO, ABM, ad copy,
          email, GTM strategy, ORM, buyer signals, competitive intelligence, and more.
        </p>
        <p>
          Quick tour of every feature. <strong>Skip anytime</strong> — it&apos;ll always
          be available from <span className="text-[var(--reverb-accent)] font-semibold">More menu → Show tour again</span>.
        </p>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {["Brand Agent", "4 models", "Live web", "File analysis", "Voice", "Export anywhere"].map((t) => (
            <span key={t} className="text-[10.5px] font-semibold px-2 py-1 rounded-md bg-[#fbf3ee] text-[var(--reverb-accent-rich)] border border-[#f1e3d6]">
              {t}
            </span>
          ))}
        </div>
      </>
    ),
  },

  // 02 — Brand Agent + Library
  {
    icon: BookOpen,
    title: "Name your Brand Agent",
    subtitle: "Upload your brand once. Every asset comes out on-voice.",
    accent: "from-[#d8593a] to-[#b03e21]",
    body: (
      <>
        <p>
          Drop in your brand guidelines, ICP, messaging frameworks, and past campaigns.
          Reverb parses each file locally (PII auto-redacted), then RAG-indexes the
          content into your <strong>Brand Library</strong>.
        </p>
        <div className="mt-1 p-3 rounded-xl bg-white border border-[var(--reverb-border-soft)] space-y-1.5">
          <div className="flex items-center gap-2 text-[11.5px]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--reverb-text-tertiary)]">Agent name</span>
            <span className="font-semibold text-[var(--reverb-text-primary)]">Maya</span>
            <span className="text-[var(--reverb-text-tertiary)]">— for Acme Co</span>
          </div>
          {[
            { name: "Brand_Voice_Guide.pdf", chunks: 12 },
            { name: "ICP_Personas_2026.docx", chunks: 8 },
            { name: "Q1_Campaign.pptx", chunks: 14 },
          ].map((d) => (
            <div key={d.name} className="flex items-center gap-2 text-[11px]">
              <FileText size={11} className="text-[var(--reverb-text-tertiary)] shrink-0" />
              <span className="font-medium text-[var(--reverb-text-primary)] truncate flex-1">{d.name}</span>
              <span className="text-[10px] text-[var(--reverb-text-tertiary)]">{d.chunks} chunks</span>
              <CheckCircle2 size={11} className="text-emerald-600 shrink-0" />
            </div>
          ))}
        </div>
        <p className="text-[12px] text-[var(--reverb-text-secondary)]">
          The Tuned model retrieves your brand context as primary signal on every answer.
        </p>
      </>
    ),
  },

  // 03 — Four input modes
  {
    icon: Sparkles,
    title: "Brief in any channel",
    subtitle: "Type, paste a URL, drop a file, or speak — all grounded as context.",
    accent: "from-blue-500 to-cyan-500",
    body: (
      <>
        <div className="grid grid-cols-2 gap-2">
          {[
            { icon: Sparkles, label: "Text", desc: "Just type your brief", bg: "bg-blue-50", fg: "text-blue-600" },
            { icon: LinkIcon, label: "URL", desc: "Paste — Reverb scrapes the site", bg: "bg-emerald-50", fg: "text-emerald-600" },
            { icon: Paperclip, label: "File", desc: "PDF, Word, Excel, PPT, CSV", bg: "bg-violet-50", fg: "text-violet-600" },
            { icon: Mic, label: "Voice", desc: "Web Speech API, hands-free", bg: "bg-pink-50", fg: "text-pink-600" },
          ].map((m) => (
            <div key={m.label} className="p-2.5 rounded-xl bg-white border border-[var(--reverb-border-soft)]">
              <div className="flex items-center gap-1.5 mb-1">
                <span className={cn("w-6 h-6 rounded-lg flex items-center justify-center", m.bg)}>
                  <m.icon size={12} className={m.fg} strokeWidth={2.4} />
                </span>
                <span className="text-[12px] font-semibold text-[var(--reverb-text-primary)]">{m.label}</span>
              </div>
              <p className="text-[10.5px] text-[var(--reverb-text-secondary)] leading-snug">{m.desc}</p>
            </div>
          ))}
        </div>
        <p className="text-[12px] text-[var(--reverb-text-secondary)]">
          Files are parsed in your browser — raw PII never leaves your device.
        </p>
      </>
    ),
  },

  // 04 — Four models
  {
    icon: Sparkles,
    title: "Four models, one purpose",
    subtitle: "Pick the right brain. Switch mid-conversation.",
    accent: "from-violet-500 to-fuchsia-500",
    body: (
      <div className="grid grid-cols-2 gap-2">
        {[
          { name: "Apex", badge: "Flagship", desc: "Deep strategy, executive briefs", color: "from-violet-500 to-fuchsia-500", text: "text-violet-700" },
          { name: "Core", badge: "Default", desc: "Balanced daily workhorse", color: "from-[#d8593a] to-[#b03e21]", text: "text-[var(--reverb-accent-rich)]" },
          { name: "Pulse", badge: "Fast", desc: "Sub-second ad copy & subject lines", color: "from-emerald-500 to-teal-500", text: "text-emerald-700" },
          { name: "Tuned", badge: "RAG", desc: "Your brand + 130-topic corpus", color: "from-amber-500 to-orange-500", text: "text-amber-700" },
        ].map((m) => (
          <div key={m.name} className="relative p-2.5 rounded-xl bg-white border border-[var(--reverb-border-soft)] overflow-hidden">
            <div className={cn("absolute -top-5 -right-5 w-16 h-16 rounded-full bg-gradient-to-br opacity-20 blur-xl pointer-events-none", m.color)} />
            <div className="relative">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className={cn("text-[12.5px] font-bold tracking-tight", m.text)}>{m.name}</span>
                <span className="text-[8.5px] font-bold uppercase tracking-wider px-1 py-0.5 rounded bg-[#fbf3ee] text-[var(--reverb-accent-rich)]">
                  {m.badge}
                </span>
              </div>
              <p className="text-[10.5px] text-[var(--reverb-text-secondary)] leading-snug">{m.desc}</p>
            </div>
          </div>
        ))}
      </div>
    ),
  },

  // 05 — Tools menu
  {
    icon: Hammer,
    title: "Tools — one-tap quick actions",
    subtitle: "Pre-filled briefs for the eight most common marketing tasks",
    accent: "from-emerald-500 to-teal-500",
    body: (
      <>
        <p>
          Click <strong className="text-[var(--reverb-text-primary)]">Tools</strong> in
          the input bar and pick a preset. Reverb fills the prompt with a structured
          brief — you tweak the slot inputs (product, audience, market) and send.
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { icon: Search, label: "SEO audit" },
            { icon: Wand2, label: "Ad copy" },
            { icon: Mail, label: "Email sequence" },
            { icon: Crosshair, label: "Competitor teardown" },
            { icon: Activity, label: "Buyer signals" },
            { icon: Mic2, label: "Brand voice score" },
            { icon: Target, label: "GTM plan" },
            { icon: Layers, label: "ABM playbook" },
          ].map((t) => (
            <div key={t.label} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white border border-[var(--reverb-border-soft)]">
              <span className="w-5 h-5 rounded-md bg-[#fbf3ee] flex items-center justify-center shrink-0">
                <t.icon size={10} className="text-[var(--reverb-accent)]" strokeWidth={2.4} />
              </span>
              <span className="text-[11px] font-semibold text-[var(--reverb-text-primary)] truncate">{t.label}</span>
            </div>
          ))}
        </div>
      </>
    ),
  },

  // 06 — Live web search modes
  {
    icon: Globe,
    title: "Live web research, on demand",
    subtitle: "Cycle Auto / On / Off in the input bar — pull fresh sources when it matters",
    accent: "from-sky-500 to-blue-500",
    body: (
      <>
        <div className="space-y-1.5">
          {[
            { label: "Auto", desc: "Reverb decides based on the question (default)", color: "text-[var(--reverb-text-secondary)]" },
            { label: "On", desc: "Force live search — every answer cites real-time sources", color: "text-emerald-700" },
            { label: "Off", desc: "Pure corpus-only — no web fetch, fastest", color: "text-[var(--reverb-text-tertiary)]" },
          ].map((m) => (
            <div key={m.label} className="flex items-start gap-2 p-2.5 rounded-lg bg-white border border-[var(--reverb-border-soft)]">
              <span className={cn("text-[11px] font-bold uppercase tracking-wider shrink-0 w-10", m.color)}>{m.label}</span>
              <span className="text-[11.5px] text-[var(--reverb-text-primary)] leading-snug">{m.desc}</span>
            </div>
          ))}
        </div>
        <p className="text-[12px] text-[var(--reverb-text-secondary)]">
          When search runs, sources are cited inline as [1], [2] with a Sources block
          at the end of the answer.
        </p>
      </>
    ),
  },

  // 07 — Multi-format export
  {
    icon: Download,
    title: "Ask for any format",
    subtitle: "PDF, Word, Excel, PowerPoint, CSV, JSON, Markdown — generated locally",
    accent: "from-fuchsia-500 to-pink-500",
    body: (
      <>
        <p>
          Add <em>&quot;as a PDF&quot;</em> or <em>&quot;as a Word doc&quot;</em> to your
          prompt — or type <span className="px-1.5 py-0.5 rounded bg-[#faf6ef] font-mono text-[11px]">convert this to X</span> after any answer.
          A download button appears below the message.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {["PDF", "DOCX", "XLSX", "PPTX", "CSV", "JSON", "MD", "TXT", "HTML"].map((f) => (
            <span key={f} className="text-[10.5px] font-bold px-2 py-1 rounded-md bg-white border border-[var(--reverb-border-soft)] text-[var(--reverb-text-secondary)]">
              {f}
            </span>
          ))}
        </div>
        <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-2">
          <ShieldCheck size={13} className="text-emerald-700 shrink-0" />
          <p className="text-[11.5px] text-emerald-900 leading-snug">
            Conversion happens in your browser. The model isn&apos;t re-called and the file never touches our servers.
          </p>
        </div>
      </>
    ),
  },

  // 08 — Live marketing intel
  {
    icon: Radar,
    title: "Grounded in fresh marketing intel",
    subtitle: "130+ topics × 13 asset types scraped daily — the Tuned model's primary knowledge",
    accent: "from-amber-500 to-orange-500",
    body: (
      <>
        <p>
          Reverb&apos;s scraping pipeline pulls fresh marketing articles every day across
          ABM, SEO, ad strategy, buyer signals, GTM, ORM, and more. Each article becomes
          asset-type-aware <strong>training pairs</strong> the Tuned model retrieves on
          your queries.
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { label: "Topics", value: "130+" },
            { label: "Asset types", value: "13" },
            { label: "Intents", value: "13" },
            { label: "Articles", value: "1,400+" },
            { label: "Q&A pairs", value: "850+" },
            { label: "Refresh", value: "Daily" },
          ].map((s) => (
            <div key={s.label} className="p-2 rounded-lg bg-white border border-[var(--reverb-border-soft)] text-center">
              <p className="text-[14px] font-bold text-[var(--reverb-accent)] leading-tight">{s.value}</p>
              <p className="text-[9.5px] uppercase tracking-wider text-[var(--reverb-text-tertiary)] font-semibold">{s.label}</p>
            </div>
          ))}
        </div>
      </>
    ),
  },

  // 09 — Self-learning
  {
    icon: ThumbsUp,
    title: "It learns from your feedback",
    subtitle: "Every thumbs-up sharpens the next answer",
    accent: "from-pink-500 to-rose-500",
    body: (
      <>
        <p>
          When Reverb gives a response you like, hover it and click the thumbs button.
          That answer becomes a learning example, automatically retrieved on similar
          future queries.
        </p>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 cursor-default">
            <ThumbsUp size={12} className="text-emerald-600" strokeWidth={2.4} />
            <span className="text-[11px] font-semibold text-emerald-800">Keep it sharp</span>
          </button>
          <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-50 border border-rose-200 cursor-default">
            <ThumbsDown size={12} className="text-rose-600" strokeWidth={2.4} />
            <span className="text-[11px] font-semibold text-rose-800">Off-target</span>
          </button>
        </div>
        <p className="text-[12px] text-[var(--reverb-text-secondary)]">
          Over time, Reverb gets sharper on your brand voice, your preferred frameworks,
          and the kind of answers your team actually ships.
        </p>
      </>
    ),
  },

  // 10 — Cross-device sync
  {
    icon: Cloud,
    title: "Same chats, every device",
    subtitle: "Sign in on desktop, mobile, or a new browser — your history is there",
    accent: "from-cyan-500 to-blue-500",
    body: (
      <>
        <p>
          Conversations sync to your account in the cloud within ~600ms of any change.
          Start a brief at your desk, finish it from your phone in the cab.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2.5 rounded-xl bg-white border border-[var(--reverb-border-soft)]">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Sparkles size={11} className="text-[var(--reverb-accent)]" />
              <span className="text-[11px] font-semibold text-[var(--reverb-text-primary)]">Desktop</span>
            </div>
            <div className="space-y-1">
              <div className="h-1.5 rounded bg-[#fbf3ee] w-full" />
              <div className="h-1.5 rounded bg-[#fbf3ee] w-3/4" />
              <div className="h-1.5 rounded bg-[#fbf3ee] w-5/6" />
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-white border border-[var(--reverb-border-soft)]">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Smartphone size={11} className="text-[var(--reverb-accent)]" />
              <span className="text-[11px] font-semibold text-[var(--reverb-text-primary)]">Mobile</span>
            </div>
            <div className="space-y-1">
              <div className="h-1.5 rounded bg-[#fbf3ee] w-full" />
              <div className="h-1.5 rounded bg-[#fbf3ee] w-3/4" />
              <div className="h-1.5 rounded bg-[#fbf3ee] w-5/6" />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-[var(--reverb-text-tertiary)]">
          <Database size={11} />
          <span>Stored in Supabase · RLS-scoped to your account · never shared</span>
        </div>
      </>
    ),
  },

  // 11 — Responsible AI
  {
    icon: ShieldCheck,
    title: "Built with guardrails",
    subtitle: "Four safety layers that keep Reverb enterprise-pitchable",
    accent: "from-teal-500 to-emerald-500",
    body: (
      <>
        <ul className="space-y-1.5">
          {[
            { label: "Input moderation", desc: "Llama Guard 4 on every user message (MLCommons hazard taxonomy)" },
            { label: "Prompt injection", desc: "10-pattern regex + LLM judge — catches override / jailbreak attempts" },
            { label: "Output moderation", desc: "Llama Guard runs on every assistant response (warn, not block)" },
            { label: "PII redaction", desc: "Brand uploads scrubbed in-browser — raw PII never reaches our servers" },
          ].map((l) => (
            <li key={l.label} className="flex items-start gap-2 p-2 rounded-lg bg-white border border-[var(--reverb-border-soft)]">
              <Shield size={13} className="text-emerald-600 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-[11.5px] font-semibold text-[var(--reverb-text-primary)]">{l.label}</p>
                <p className="text-[10.5px] text-[var(--reverb-text-secondary)] leading-snug">{l.desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </>
    ),
  },

  // 12 — Get started
  {
    icon: CheckCircle2,
    title: "You're set.",
    subtitle: "One last thing — your first prompt determines a lot",
    accent: "from-emerald-500 to-teal-500",
    body: (
      <>
        <p>
          Start with something specific. <em>&quot;Draft a tier-1 ABM email for a fintech CFO&quot;</em> beats <em>&quot;write an email.&quot;</em> The more brand context Reverb has, the sharper the answer.
        </p>
        <div className="space-y-1.5">
          {[
            "Set up your Brand Library — even one PDF helps",
            "Pick a model that fits the task (Tuned for brand-on, Apex for strategy)",
            "Use Tools for one-tap presets when you're starting from scratch",
            "Thumbs-up the answers that land — Reverb will retrieve them next time",
          ].map((t, i) => (
            <div key={i} className="flex items-start gap-2 text-[12px] text-[var(--reverb-text-primary)]">
              <CheckCircle2 size={12} className="text-emerald-600 shrink-0 mt-0.5" />
              <span className="leading-snug">{t}</span>
            </div>
          ))}
        </div>
      </>
    ),
  },
];

export default function OnboardingTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = localStorage.getItem(STORAGE_KEY);
    if (!seen) {
      const t = setTimeout(() => setOpen(true), 700);
      return () => clearTimeout(t);
    }
  }, []);

  const close = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  };

  if (!open) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-3 sm:px-4 py-3 sm:py-6 reverb-fade-in">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={close} />

      <div
        className="relative w-full max-w-lg max-h-[92vh] rounded-2xl flex flex-col overflow-hidden reverb-scale-in"
        style={{
          background: "var(--reverb-gradient-card)",
          boxShadow: "var(--reverb-shadow-xl)",
          border: "1px solid var(--reverb-border-soft)",
        }}
      >
        {/* Ambient glow tied to step */}
        <div className={`absolute -top-20 -right-20 w-60 h-60 rounded-full bg-gradient-to-br ${current.accent} opacity-20 blur-3xl pointer-events-none`} />

        {/* Skip button */}
        <button
          onClick={close}
          className="absolute top-3.5 right-3.5 z-10 p-1.5 rounded-lg text-[var(--reverb-text-secondary)] hover:bg-white hover:shadow-[var(--reverb-shadow-sm)] transition-all"
          aria-label="Skip"
        >
          <X size={15} />
        </button>

        <div className="relative p-5 sm:p-7 pb-5 overflow-y-auto reverb-scroll flex-1 min-h-0">
          {/* Logo + step counter */}
          <div className="flex items-center justify-between mb-5">
            <Image src="/reverb-logo.png" alt="Reverb" width={90} height={28} className="h-6 w-auto" />
            <span className="text-[11px] font-semibold text-[var(--reverb-text-tertiary)] tracking-wide">
              Step {step + 1} of {STEPS.length}
            </span>
          </div>

          {/* Icon + title */}
          <div className="flex items-start gap-3 mb-3 sm:mb-4">
            <div
              className={`relative shrink-0 w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br ${current.accent} flex items-center justify-center overflow-hidden`}
              style={{ boxShadow: "var(--reverb-shadow-md)" }}
            >
              {step === 0 ? (
                <span className="absolute inset-1.5 rounded-xl bg-white flex items-center justify-center p-1">
                  <Image src="/reverb-logo.png" alt="Reverb" width={72} height={20} className="w-full h-auto object-contain" />
                </span>
              ) : (
                <current.icon size={20} className="text-white" strokeWidth={2.2} />
              )}
            </div>
            <div className="pt-0.5 min-w-0 flex-1">
              <h2 className="text-[17px] sm:text-[19px] font-semibold tracking-tight text-[var(--reverb-text-primary)] leading-tight">
                {current.title}
              </h2>
              <p className="text-[12px] sm:text-[12.5px] text-[var(--reverb-text-secondary)] mt-0.5 leading-snug">
                {current.subtitle}
              </p>
            </div>
          </div>

          {/* Body */}
          <div className="text-[13px] text-[var(--reverb-text-primary)] leading-[1.65] flex flex-col gap-3">
            {current.body}
          </div>
        </div>

        {/* Footer */}
        <div className="relative px-5 sm:px-7 py-3.5 sm:py-4 border-t border-[var(--reverb-border-soft)] bg-[#fbf8f4] flex items-center justify-between gap-3 shrink-0">
          {/* Progress dots — capped width so 12 steps fit comfortably */}
          <div className="flex items-center gap-1 overflow-hidden max-w-[55%]">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                aria-label={`Step ${i + 1}`}
                className={cn(
                  "transition-all duration-200 rounded-full shrink-0",
                  i === step
                    ? "w-5 h-1.5 bg-[var(--reverb-accent)]"
                    : i < step
                    ? "w-1.5 h-1.5 bg-[var(--reverb-accent)]/40"
                    : "w-1.5 h-1.5 bg-[var(--reverb-border-soft)]"
                )}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12.5px] font-medium text-[var(--reverb-text-secondary)] hover:bg-white hover:shadow-[var(--reverb-shadow-sm)] transition-all"
              >
                <ArrowLeft size={12} /> Back
              </button>
            )}
            {isLast ? (
              <button
                onClick={close}
                className="h-9 px-4 rounded-lg reverb-btn-primary text-[12.5px] font-semibold flex items-center gap-1.5"
              >
                <CheckCircle2 size={13} /> Get started
              </button>
            ) : (
              <button
                onClick={() => setStep((s) => s + 1)}
                className="h-9 px-4 rounded-lg reverb-btn-primary text-[12.5px] font-semibold flex items-center gap-1.5"
              >
                Next <ArrowRight size={12} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ResetOnboarding({ onReset }: { onReset?: () => void }) {
  return (
    <button
      onClick={() => {
        localStorage.removeItem(STORAGE_KEY);
        onReset?.();
        window.location.reload();
      }}
      className="flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] text-[var(--reverb-text-secondary)] hover:bg-white hover:shadow-[var(--reverb-shadow-sm)] transition-all w-full text-left"
    >
      <Shield size={13} className="text-[var(--reverb-text-tertiary)]" />
      <span className="font-medium">Show tour again</span>
    </button>
  );
}
