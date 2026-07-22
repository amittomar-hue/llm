"use client";

// ─────────────────────────────────────────────────────────────────
// /integrations — marketing page for the CRM integrations story.
//
// Distinct from /settings/integrations (which is the authenticated
// management surface). This one is public, SEO-indexed, and pitches
// the value of connecting HubSpot / Zoho to DMOOP.
//
// Layout:
//   • Hero with WebGL background, animated headline
//   • Side-by-side provider deep-dive (HubSpot + Zoho)
//   • "Under the hood" — what data DMOOP pulls per contact
//   • Security posture
//   • CTA
// ─────────────────────────────────────────────────────────────────

import { useRef, type ReactNode } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion, useInView } from "framer-motion";
import {
  ArrowRight, Plug, ShieldCheck, KeyRound, RefreshCw,
  Zap, Building2, Contact, GitBranch, Mail, MessageSquare, TrendingUp,
  Lock, Database, Sparkles, Check, ChevronRight,
} from "lucide-react";
import { SharedNav } from "@/components/landing/SharedNav";

const WebGLBackground = dynamic(
  () => import("@/components/landing/WebGLBackground").then((m) => m.WebGLBackground),
  { ssr: false, loading: () => null }
);

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

const CONNECTORS = [
  {
    name: "HubSpot",
    color: "#ff7a59",
    logo: "H",
    status: "Available",
    tagline: "Grounded emails, deal-aware follow-ups, journey-anchored messaging.",
    pulls: [
      "Contact identity (name, role, lifecycle stage, lead status)",
      "Associated company (name, domain, industry, employee count)",
      "Latest deal (name, stage, amount, close date) + full stage-transition history",
      "Original source + drill-down (organic search / paid / referral / campaign)",
      "Marketing email engagement (last opened, last clicked, last email name)",
      "Recent touchpoints (last 5 emails + 3 calls + 3 meetings + notes with subjects, dates, direction)",
    ],
    useCases: [
      { icon: Mail, label: "Nurture emails that reference the actual last call" },
      { icon: MessageSquare, label: "Deal-stage-aware follow-ups (Opportunity → Proposal)" },
      { icon: TrendingUp, label: "Winback sequences tuned to lifecycle stage" },
    ],
  },
  {
    name: "Zoho CRM",
    color: "#e42527",
    logo: "Z",
    status: "Available",
    tagline: "Full contact + account + deal context grounded in your Zoho data.",
    pulls: [
      "Contact identity (First/Last/Full name, Title, Lead Status, Lead Source)",
      "Account (name, website, industry, employee count)",
      "Latest deal (name, stage, amount, close date)",
      "Recent notes on the contact (last 10)",
      "Region auto-detection (US/EU/IN/AU/JP/CN — routes to the right Zoho data center)",
      "Last activity time + contact-created timestamp",
    ],
    useCases: [
      { icon: Mail, label: "Cold intros that use Lead Source for personalization" },
      { icon: MessageSquare, label: "Follow-ups that pick up from the last note" },
      { icon: TrendingUp, label: "Account-based sequences using Zoho Accounts" },
    ],
  },
  {
    name: "Salesforce",
    color: "#00a1e0",
    logo: "S",
    status: "Coming Soon",
    tagline: "Coming soon.",
    pulls: [],
    useCases: [],
  },
  {
    name: "Pipedrive",
    color: "#1a1a1a",
    logo: "P",
    status: "Coming Soon",
    tagline: "Coming soon.",
    pulls: [],
    useCases: [],
  },
];

const SECURITY_POSTURE = [
  { icon: Lock, title: "AES-256-GCM encryption", desc: "OAuth tokens are encrypted at rest with a per-deployment master key. Database dump alone doesn't expose them." },
  { icon: KeyRound, title: "PKCE + HMAC state", desc: "OAuth flows use PKCE (SHA-256 challenge) + HMAC-signed state tokens to block interception + replay." },
  { icon: RefreshCw, title: "Preemptive token refresh", desc: "Access tokens refresh 60 seconds before expiry with locking so parallel requests don't race." },
  { icon: ShieldCheck, title: "Read-only scopes", desc: "DMOOP requests read-only scopes only. We can't create, update, or delete anything in your CRM." },
];

function ConnectorCard({ connector }: { connector: typeof CONNECTORS[number] }) {
  const isEnabled = connector.status === "Available";
  return (
    <Reveal>
      <div className="rounded-3xl overflow-hidden shadow-lg border border-black/5 h-full flex flex-col" style={{ background: "linear-gradient(180deg, #fefcf9 0%, #f9f4ec 100%)" }}>
        <div className="p-6 sm:p-7 border-b border-black/5 flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-[22px] shadow-md shrink-0" style={{ background: connector.color }}>
            {connector.logo}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-[20px] font-semibold text-[var(--dmoop-text-primary)]">{connector.name}</h3>
              <span className={"text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded " + (isEnabled ? "text-emerald-800 bg-emerald-100" : "text-[var(--dmoop-text-tertiary)] bg-[#f2ede4]")}>
                {connector.status}
              </span>
            </div>
            <p className="text-[13.5px] text-[var(--dmoop-text-secondary)] leading-relaxed">
              {connector.tagline}
            </p>
          </div>
        </div>

        {isEnabled && (
          <div className="p-6 sm:p-7 flex-1 flex flex-col gap-6">
            <div>
              <p className="text-[10.5px] font-bold uppercase tracking-widest text-[var(--dmoop-text-tertiary)] mb-3">
                What DMOOP pulls
              </p>
              <ul className="space-y-2">
                {connector.pulls.map((p, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -6 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.35, delay: i * 0.04 }}
                    className="flex items-start gap-2 text-[13px] text-[var(--dmoop-text-primary)]"
                  >
                    <Check size={12} strokeWidth={3} className="mt-1 shrink-0" style={{ color: connector.color }} />
                    <span>{p}</span>
                  </motion.li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-[10.5px] font-bold uppercase tracking-widest text-[var(--dmoop-text-tertiary)] mb-3">
                Use cases
              </p>
              <div className="space-y-2">
                {connector.useCases.map((uc, i) => {
                  const Icon = uc.icon;
                  return (
                    <div key={i} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-white/60 border border-black/[0.03]">
                      <Icon size={13} style={{ color: connector.color }} />
                      <span className="text-[12.5px] font-medium text-[var(--dmoop-text-primary)]">{uc.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <Link
              href="/signup"
              className="mt-auto h-11 px-5 rounded-xl dmoop-btn-primary text-[13px] font-semibold flex items-center justify-center gap-1.5"
            >
              Connect {connector.name} <ArrowRight size={13} />
            </Link>
          </div>
        )}

        {!isEnabled && (
          <div className="p-8 flex-1 flex flex-col items-center justify-center text-center">
            <div className="text-[13px] text-[var(--dmoop-text-tertiary)]">
              We&apos;re building this next. Want to be notified when it ships?
            </div>
            <Link href="/signup" className="mt-3 text-[12.5px] font-semibold text-[var(--dmoop-accent)] flex items-center gap-1">
              Join the waitlist <ChevronRight size={11} />
            </Link>
          </div>
        )}
      </div>
    </Reveal>
  );
}

export default function IntegrationsClient() {
  return (
    <div className="min-h-screen relative" style={{ background: "var(--dmoop-bg-app)" }}>
      <SharedNav />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 opacity-45 pointer-events-none">
          <WebGLBackground />
        </div>
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-10 sm:pb-16 text-center">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/80 backdrop-blur border border-[var(--dmoop-border-soft)] mb-5"
          >
            <Plug size={11} className="text-[var(--dmoop-accent)]" />
            <span className="text-[10.5px] font-semibold tracking-wider uppercase text-[var(--dmoop-text-secondary)]">
              Integrations
            </span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-[36px] sm:text-[56px] font-semibold tracking-tight text-[var(--dmoop-text-primary)] leading-[1.05] mb-4"
          >
            Your CRM is the source of truth.<br />
            <span style={{
              background: "var(--dmoop-gradient-accent)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}>
              DMOOP writes from it.
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-[14.5px] sm:text-[17px] text-[var(--dmoop-text-secondary)] max-w-2xl mx-auto leading-relaxed"
          >
            Connect HubSpot or Zoho and every generated message references the recipient by name, their company by name, and picks up from the actual last touchpoint. No more templated cold copy pretending to be personal.
          </motion.p>
        </div>
      </section>

      {/* Connectors grid */}
      <section className="relative py-8 sm:py-14">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid md:grid-cols-2 gap-5">
            {CONNECTORS.map((c) => (
              <ConnectorCard key={c.name} connector={c} />
            ))}
          </div>
        </div>
      </section>

      {/* Under the hood — what data gets pulled per contact */}
      <section className="relative py-16 sm:py-24 border-t border-[var(--dmoop-border-soft)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <Reveal>
            <div className="text-center mb-10">
              <p className="text-[10.5px] font-bold tracking-[0.14em] text-[var(--dmoop-accent)] uppercase mb-2.5">
                Under the hood
              </p>
              <h2 className="text-[28px] sm:text-[38px] font-semibold tracking-tight text-[var(--dmoop-text-primary)] leading-tight">
                What DMOOP sees when you paste an email into chat
              </h2>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="rounded-3xl border border-black/5 shadow-lg overflow-hidden" style={{ background: "linear-gradient(180deg, #fefcf9 0%, #f9f4ec 100%)" }}>
              <div className="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-black/5">
                {[
                  { icon: Contact, title: "Identity", items: ["Name", "Role", "Lifecycle stage", "Lead status", "Source"] },
                  { icon: Building2, title: "Account", items: ["Company", "Industry", "Size", "Domain", "Location"] },
                  { icon: GitBranch, title: "Deal + Journey", items: ["Latest deal", "Stage history", "Last 10 touchpoints", "Email opens/clicks", "Notes"] },
                ].map((col, i) => {
                  const Icon = col.icon;
                  return (
                    <motion.div
                      key={col.title}
                      initial={{ opacity: 0, y: 12 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5, delay: i * 0.1 }}
                      className="p-6 sm:p-7"
                    >
                      <div className="w-11 h-11 rounded-xl bg-white shadow-sm flex items-center justify-center mb-4">
                        <Icon size={18} className="text-[var(--dmoop-accent)]" />
                      </div>
                      <p className="text-[15px] font-semibold text-[var(--dmoop-text-primary)] mb-3">{col.title}</p>
                      <ul className="space-y-1.5">
                        {col.items.map((it) => (
                          <li key={it} className="flex items-center gap-2 text-[12.5px] text-[var(--dmoop-text-secondary)]">
                            <Zap size={10} className="text-[var(--dmoop-accent)] shrink-0" />
                            <span>{it}</span>
                          </li>
                        ))}
                      </ul>
                    </motion.div>
                  );
                })}
              </div>
              <div className="p-6 sm:p-7 bg-white/40 border-t border-black/5">
                <p className="text-[12.5px] text-[var(--dmoop-text-secondary)] leading-relaxed text-center max-w-3xl mx-auto">
                  <Sparkles size={11} className="inline text-[var(--dmoop-accent)] mr-1" />
                  All fetched in parallel, taking ~700-1400ms total. Injected as structured system messages before the model generates. If a field is missing, the model is instructed not to reference it — no fabricated details.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Security posture */}
      <section className="relative py-16 sm:py-20 border-t border-[var(--dmoop-border-soft)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <Reveal>
            <div className="text-center mb-10">
              <p className="text-[10.5px] font-bold tracking-[0.14em] text-emerald-700 uppercase mb-2.5 flex items-center justify-center gap-1.5">
                <ShieldCheck size={12} /> Security
              </p>
              <h2 className="text-[26px] sm:text-[34px] font-semibold tracking-tight text-[var(--dmoop-text-primary)] leading-tight">
                Enterprise-grade posture, day one
              </h2>
            </div>
          </Reveal>
          <div className="grid sm:grid-cols-2 gap-4">
            {SECURITY_POSTURE.map((s, i) => {
              const Icon = s.icon;
              return (
                <motion.div
                  key={s.title}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.08 }}
                  className="p-5 rounded-2xl bg-white border border-black/5 shadow-sm flex items-start gap-3"
                >
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                    <Icon size={16} className="text-emerald-700" />
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-[var(--dmoop-text-primary)] mb-1">{s.title}</p>
                    <p className="text-[12.5px] text-[var(--dmoop-text-secondary)] leading-relaxed">{s.desc}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-16 sm:py-24 border-t border-[var(--dmoop-border-soft)]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <Reveal>
            <h2 className="text-[28px] sm:text-[38px] font-semibold tracking-tight text-[var(--dmoop-text-primary)] mb-4">
              Two minutes to connect. Every message after is grounded.
            </h2>
            <p className="text-[14.5px] sm:text-[16px] text-[var(--dmoop-text-secondary)] mb-6">
              Click Connect, approve the OAuth prompt, done. No API keys to paste, no field mapping, no per-contact sync.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <Link href="/signup" className="h-12 px-7 rounded-xl dmoop-btn-primary text-[14px] font-semibold flex items-center justify-center gap-2">
                Get started free <ArrowRight size={15} />
              </Link>
              <Link href="/how-it-works" className="h-12 px-7 rounded-xl bg-white border border-[var(--dmoop-border-soft)] text-[14px] font-semibold text-[var(--dmoop-text-primary)] flex items-center justify-center gap-2 hover:shadow-md transition-shadow">
                See how it works
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Footer */}
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

      {/* Attach the Database import — used indirectly via icons */}
      <span className="hidden"><Database size={1} /></span>
    </div>
  );
}
