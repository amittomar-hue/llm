"use client";

// ─────────────────────────────────────────────────────────────────
// /how-it-works — sticky-scroll storytelling page.
//
// Layout: two-column on desktop (sticky animated diagram on the left,
// scrolling step copy on the right). On mobile: stacked. The diagram
// morphs as the reader progresses through the 6 steps — colors,
// active nodes, and animated flow arrows update via Framer Motion.
// ─────────────────────────────────────────────────────────────────

import { useRef, useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion, useScroll, useTransform, useInView } from "framer-motion";
import {
  ArrowRight, MessageSquare, BookOpen, Database, Globe, Cpu, Download,
  Sparkles,
} from "lucide-react";
import { SharedNav } from "@/components/landing/SharedNav";

const WebGLBackground = dynamic(
  () => import("@/components/landing/WebGLBackground").then((m) => m.WebGLBackground),
  { ssr: false, loading: () => null }
);

interface StepDef {
  id: string;
  n: string;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  body: string;
  bullets: string[];
}

const STEPS: StepDef[] = [
  {
    id: "prompt",
    n: "01",
    title: "You brief DMOOP",
    subtitle: "Type, paste a URL, drop a file, or dictate by voice",
    icon: MessageSquare,
    color: "#c14a2a",
    body: "The chat surface accepts every input shape you'd want in a marketing tool: raw text, URLs (which get scraped in real time), PDFs / Word / Excel / PowerPoint (parsed locally in your browser), voice input via the Web Speech API. Every attachment is treated as authoritative context, not just a hint.",
    bullets: [
      "Live site scraping — paste any URL, DMOOP fetches homepage + key pages",
      "File analysis — extracts text from PDFs, decks, spreadsheets locally",
      "Voice input — Web Speech API with auto-restart on pauses",
      "Format-aware prompts — say \"as a PowerPoint\" and the response reshapes",
    ],
  },
  {
    id: "brand",
    n: "02",
    title: "Your Brand Agent kicks in",
    subtitle: "Every answer starts with who you are",
    icon: BookOpen,
    color: "#8b5cf7",
    body: "You upload your brand documents once — voice guidelines, ICP, past campaigns, positioning docs. DMOOP indexes them into a per-user vector store. Every response first pulls the highest-relevance passages, then anchors the model in your voice via a structured system message. That's why the copy sounds like you, not like ChatGPT's default.",
    bullets: [
      "Named Brand Agent — call it whatever you want",
      "Semantic chunking — brand docs split into retrievable passages",
      "Voice profile extraction — tone, vocabulary, forbidden phrases distilled",
      "Priority injection — brand context beats training-pair recall",
    ],
  },
  {
    id: "crm",
    n: "03",
    title: "CRM context lookup",
    subtitle: "When you mention a person, DMOOP pulls their whole story",
    icon: Database,
    color: "#ff7a59",
    body: "If the prompt mentions an email address AND you have HubSpot or Zoho connected, DMOOP fetches that contact's live record in parallel with the model call: their role, company, deal stage, deal-stage history, last 10 touchpoints (emails, calls, meetings, notes), marketing email opens, source of acquisition. The generated message references specific past interactions instead of writing filler like \"following up on our recent conversation\".",
    bullets: [
      "OAuth 2.0 + PKCE for both HubSpot and Zoho",
      "AES-256-GCM encryption for OAuth tokens at rest",
      "Full journey enrichment — touchpoints, source, deal-stage path",
      "Zero-hallucination guardrails — no data → tells you, doesn't invent",
    ],
  },
  {
    id: "intel",
    n: "04",
    title: "Grounded in live marketing intel",
    subtitle: "130+ topics × 13 asset types, refreshed every 6 hours",
    icon: Globe,
    color: "#059669",
    body: "Beyond your brand and CRM, DMOOP maintains an ongoing scrape of the marketing web: articles, case studies, ebooks, playbooks, ad campaigns, social posts, conference reports. When you ask about tactics or trends, the model reaches into a fresh intel pool with real citations — not stale training data from months ago. Plus Tavily web search fires on demand for very-recent questions.",
    bullets: [
      "130+ marketing topics tracked",
      "13 asset types across each topic",
      "6-hour refresh cadence",
      "Citations resolve to actual sources",
    ],
  },
  {
    id: "model",
    n: "05",
    title: "The right model picks up the pen",
    subtitle: "Four tiers, each tuned for a different shape of work",
    icon: Cpu,
    color: "#6366f1",
    body: "DMOOP routes your prompt to one of four models based on intent: Apex for deep strategy and 6K-word plans, Core for standard marketing generation, Pulse for quick iterations, Tuned for brand-heavy pattern-matching against your training pairs. You can override in the composer. The router accounts for TPM headroom and gracefully degrades under rate-limit pressure so long-form runs finish.",
    bullets: [
      "Apex — Llama 3.3 70B for strategic depth",
      "Core — Llama 3.3 70B for daily work",
      "Pulse — Llama 3.1 8B for instant iteration",
      "Tuned — Llama-4-Scout 17B with brand + training pairs",
    ],
  },
  {
    id: "export",
    n: "06",
    title: "Export to any format, in one click",
    subtitle: "Ask in PDF, Word, Excel, PowerPoint — the download button appears",
    icon: Download,
    color: "#0891b2",
    body: "The response knows what shape you asked for. Say \"give me a Q3 plan as a PowerPoint\" and DMOOP structures the output as slides with title and bullet formatting, then materializes it as a real .pptx file in-browser. Every export runs client-side using pptxgenjs, jspdf, docx, xlsx-write — your content never leaves your session for the conversion.",
    bullets: [
      "PDF, Word, Excel, PowerPoint, CSV, JSON, Markdown, plain text",
      "Client-side generation — zero server round-trip on export",
      "Structure-preserving — headings, tables, bullets survive the export",
      "One-click regeneration — change one thing, re-export",
    ],
  },
];

// The animated flow diagram — an SVG showing the 6 stages as connected
// nodes. The active node pulses; edges brighten from left to right.
function FlowDiagram({ activeIndex }: { activeIndex: number }) {
  return (
    <div className="relative w-full aspect-square max-w-md mx-auto">
      <svg viewBox="0 0 400 400" className="w-full h-full">
        <defs>
          <radialGradient id="glow" cx="50%" cy="50%">
            <stop offset="0%" stopColor="rgba(193,74,42,0.35)" />
            <stop offset="100%" stopColor="rgba(193,74,42,0)" />
          </radialGradient>
          <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>

        {/* Central pulse ring */}
        <motion.circle
          cx="200" cy="200" r="140"
          fill="url(#glow)"
          animate={{ scale: [1, 1.05, 1], opacity: [0.55, 0.8, 0.55] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: "200px 200px" }}
        />

        {/* Connecting arcs between nodes */}
        {STEPS.map((_, i) => {
          const angle = (i / STEPS.length) * Math.PI * 2 - Math.PI / 2;
          const nextAngle = ((i + 1) / STEPS.length) * Math.PI * 2 - Math.PI / 2;
          const r = 130;
          const x1 = 200 + Math.cos(angle) * r;
          const y1 = 200 + Math.sin(angle) * r;
          const x2 = 200 + Math.cos(nextAngle) * r;
          const y2 = 200 + Math.sin(nextAngle) * r;
          const isActive = i <= activeIndex;
          return (
            <motion.path
              key={`arc-${i}`}
              d={`M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`}
              fill="none"
              stroke={isActive ? STEPS[i].color : "rgba(0,0,0,0.08)"}
              strokeWidth={isActive ? 2.5 : 1.5}
              strokeLinecap="round"
              initial={false}
              animate={{ opacity: isActive ? 1 : 0.5 }}
              transition={{ duration: 0.5 }}
            />
          );
        })}

        {/* Node circles */}
        {STEPS.map((step, i) => {
          const angle = (i / STEPS.length) * Math.PI * 2 - Math.PI / 2;
          const r = 130;
          const cx = 200 + Math.cos(angle) * r;
          const cy = 200 + Math.sin(angle) * r;
          const isActive = i === activeIndex;
          const isPast = i < activeIndex;
          return (
            <g key={step.id}>
              <motion.circle
                cx={cx}
                cy={cy}
                r={isActive ? 26 : 20}
                fill={isActive || isPast ? step.color : "#fff"}
                stroke={step.color}
                strokeWidth={2.5}
                initial={false}
                animate={{
                  scale: isActive ? [1, 1.15, 1] : 1,
                  opacity: isActive || isPast ? 1 : 0.6,
                }}
                transition={{
                  scale: { duration: 1.4, repeat: isActive ? Infinity : 0, ease: "easeInOut" },
                  opacity: { duration: 0.4 },
                }}
                style={{ transformOrigin: `${cx}px ${cy}px` }}
              />
              <text
                x={cx}
                y={cy}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="12"
                fontWeight="700"
                fill={isActive || isPast ? "#fff" : step.color}
                pointerEvents="none"
              >
                {step.n}
              </text>
            </g>
          );
        })}

        {/* Center label — reflects the active step */}
        <foreignObject x="120" y="150" width="160" height="100">
          <motion.div
            key={STEPS[activeIndex]?.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="w-full h-full flex flex-col items-center justify-center text-center"
          >
            <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--dmoop-text-tertiary)] mb-1">
              Step {STEPS[activeIndex]?.n}
            </div>
            <div className="text-[13px] font-semibold text-[var(--dmoop-text-primary)] leading-tight">
              {STEPS[activeIndex]?.title}
            </div>
          </motion.div>
        </foreignObject>
      </svg>
    </div>
  );
}

function StepPanel({ step, onEnter }: { step: StepDef; onEnter: () => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { margin: "-40% 0px -40% 0px" });
  useEffect(() => {
    if (inView) onEnter();
  }, [inView, onEnter]);
  const Icon = step.icon;
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="min-h-[70vh] flex flex-col justify-center py-16"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-md" style={{ background: step.color }}>
          <Icon size={20} className="text-white" />
        </div>
        <div className="text-[10.5px] font-bold uppercase tracking-widest text-[var(--dmoop-text-tertiary)]">
          Step {step.n}
        </div>
      </div>
      <h2 className="text-[26px] sm:text-[34px] font-semibold tracking-tight text-[var(--dmoop-text-primary)] leading-tight mb-2">
        {step.title}
      </h2>
      <p className="text-[15px] sm:text-[16px] font-medium mb-4" style={{ color: step.color }}>
        {step.subtitle}
      </p>
      <p className="text-[14px] sm:text-[15px] text-[var(--dmoop-text-secondary)] leading-relaxed mb-5">
        {step.body}
      </p>
      <ul className="space-y-2">
        {step.bullets.map((b, i) => (
          <motion.li
            key={i}
            initial={{ opacity: 0, x: -8 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: i * 0.06 }}
            className="flex items-start gap-2 text-[13.5px] text-[var(--dmoop-text-primary)]"
          >
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: step.color }} />
            <span>{b}</span>
          </motion.li>
        ))}
      </ul>
    </motion.div>
  );
}

export default function HowItWorksClient() {
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({ target: containerRef });
  const heroOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0.3]);

  return (
    <div className="min-h-screen relative" style={{ background: "var(--dmoop-bg-app)" }}>
      <SharedNav />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 opacity-50 pointer-events-none">
          <WebGLBackground />
        </div>
        <motion.div style={{ opacity: heroOpacity }} className="relative max-w-4xl mx-auto px-4 sm:px-6 pt-14 sm:pt-20 pb-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/80 backdrop-blur border border-[var(--dmoop-border-soft)] mb-5"
          >
            <Sparkles size={11} className="text-[var(--dmoop-accent)]" />
            <span className="text-[10.5px] font-semibold tracking-wider uppercase text-[var(--dmoop-text-secondary)]">
              How DMOOP works
            </span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-[36px] sm:text-[56px] font-semibold tracking-tight text-[var(--dmoop-text-primary)] leading-[1.05] mb-4"
          >
            Six steps from your prompt<br />
            <span style={{
              background: "var(--dmoop-gradient-accent)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}>
              to a downloadable deliverable.
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-[14.5px] sm:text-[17px] text-[var(--dmoop-text-secondary)] max-w-2xl mx-auto leading-relaxed"
          >
            Every DMOOP response is the output of a pipeline: brief intake, brand grounding, live CRM lookup, marketing intel retrieval, model generation, exportable format. Scroll to walk through it.
          </motion.p>
        </motion.div>
      </section>

      {/* Sticky diagram + scrolling content */}
      <section ref={containerRef} className="relative max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid md:grid-cols-2 gap-6 md:gap-16">
          {/* Left: sticky diagram (only sticky on desktop) */}
          <div className="hidden md:block">
            <div className="sticky top-24">
              <FlowDiagram activeIndex={activeIndex} />
            </div>
          </div>
          {/* Right: scrolling step panels */}
          <div>
            {STEPS.map((step, i) => (
              <StepPanel key={step.id} step={step} onEnter={() => setActiveIndex(i)} />
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="relative py-16 sm:py-24 border-t border-[var(--dmoop-border-soft)]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-[28px] sm:text-[38px] font-semibold tracking-tight text-[var(--dmoop-text-primary)] mb-4"
          >
            Ready to see it on your own brand?
          </motion.h2>
          <p className="text-[14.5px] sm:text-[16px] text-[var(--dmoop-text-secondary)] mb-6">
            Start free. Upload your brand doc. Connect your CRM. Write your first grounded email in under 5 minutes.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <Link href="/signup" className="h-12 px-7 rounded-xl dmoop-btn-primary text-[14px] font-semibold flex items-center justify-center gap-2">
              Get started free <ArrowRight size={15} />
            </Link>
            <Link href="/integrations" className="h-12 px-7 rounded-xl bg-white border border-[var(--dmoop-border-soft)] text-[14px] font-semibold text-[var(--dmoop-text-primary)] flex items-center justify-center gap-2 hover:shadow-md transition-shadow">
              Explore integrations
            </Link>
          </div>
        </div>
      </section>

      {/* Simple footer */}
      <footer className="border-t border-[var(--dmoop-border-soft)] py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[12px] text-[var(--dmoop-text-tertiary)]">
          <span>© {new Date().getFullYear()} DMOOP</span>
          <div className="flex items-center gap-4">
            <Link href="/how-it-works" className="hover:text-[var(--dmoop-text-primary)]">How it works</Link>
            <Link href="/integrations" className="hover:text-[var(--dmoop-text-primary)]">Integrations</Link>
            <Link href="/docs/api" className="hover:text-[var(--dmoop-text-primary)]">API</Link>
            <Link href="/privacy" className="hover:text-[var(--dmoop-text-primary)]">Privacy</Link>
            <Link href="/terms" className="hover:text-[var(--dmoop-text-primary)]">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

