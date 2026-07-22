"use client";

// ─────────────────────────────────────────────────────────────────
// Interactive demo widget for the landing page.
//
// Shows a visitor exactly what DMOOP produces when it's got real CRM
// context to work with. The widget cycles through a hand-authored
// script: a prompt from the user, a "thinking" indicator, a CRM
// context reveal (source, contact, deal stage), then a typewriter
// stream of the generated email. Loops on a timer so the widget
// is always in motion when visible.
//
// No real network calls — this is a marketing surface, not a chat.
// The strings are hand-authored to represent DMOOP's actual output
// quality on a well-connected CRM (Rashi Bhatnagar @ RSPL Group,
// Opportunity stage, referencing a real touchpoint).
// ─────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Zap, Database, Mail, ChevronRight } from "lucide-react";

interface DemoScript {
  prompt: string;
  crmSource: string;
  crmContact: {
    name: string;
    role: string;
    company: string;
    stage: string;
    lastTouch: string;
  };
  response: string;
}

const SCRIPTS: DemoScript[] = [
  {
    prompt: "Write a follow-up email to rashi.bhatnagar@rsplgroup.com that references our last touchpoint and moves her toward the proposal stage.",
    crmSource: "HubSpot",
    crmContact: {
      name: "Rashi Bhatnagar",
      role: "Senior GM, HR",
      company: "RSPL Group",
      stage: "Opportunity",
      lastTouch: "Discovery call, 4 days ago",
    },
    response: `Subject: Following up on our RSPL pilot conversation

Hi Rashi,

Great chatting on Tuesday about the Q3 talent pilot. You mentioned the two things you needed nailed before greenlighting: (1) source-of-hire attribution back to your ATS, and (2) a clear cost model per requisition.

I've put together a short proposal that covers both — including the attribution schema we'd stand up in week 1 and the per-req economics based on your current volume of ~40 openings/quarter.

Ready to walk through it Thursday or Friday this week? 30 minutes.

Best,
Amit`,
  },
  {
    prompt: "Draft a re-engagement message for sonny.manzo@devo.com — he's been quiet for 6 weeks.",
    crmSource: "HubSpot",
    crmContact: {
      name: "Sonny Manzo",
      role: "VP, Talent Acquisition",
      company: "Devo",
      stage: "Subscriber",
      lastTouch: "Newsletter open, 6 weeks ago",
    },
    response: `Subject: Quick one, Sonny — is Q3 hiring still the big rock?

Hey Sonny,

Radio silence usually means one of three things: priorities shifted, budget's frozen, or you're heads-down and I'm just noise.

If it's the third, no need to reply. If it's the first two, I've got a use-case pack from three other TA leads at Devo's stage (Series C, US-heavy) who used us as a variable-cost lever instead of a headcount decision. Happy to send it over — takes 10 minutes to skim.

Worth a 15-min catch-up in Aug?

Amit`,
  },
  {
    prompt: "Write a cold intro to drew.duncan@biogenidec.com — bring in our Bimbo Bakeries case as social proof.",
    crmSource: "Zoho CRM",
    crmContact: {
      name: "Drew Duncan",
      role: "Director, HR & Global HR Business Leader",
      company: "Biogen",
      stage: "Subscriber",
      lastTouch: "Added 4 months ago",
    },
    response: `Subject: How Bimbo cut TA cycle time by 38% — one for Biogen?

Hi Drew,

Bimbo Bakeries had the same shape of problem Biogen probably has right now: 22 US sites, wildly uneven local hiring markets, and one central TA team drowning in requisition backlog.

We ran a 90-day pilot with their North America TA lead — cycle time down 38%, source-of-hire visibility for the first time, and $210K in agency spend clawed back.

Worth 20 minutes to compare notes on whether the same shape applies at Biogen? I can share the pilot deck ahead of the call.

Amit`,
  },
];

export function InteractiveDemo() {
  const [scriptIdx, setScriptIdx] = useState(0);
  const [phase, setPhase] = useState<"prompt" | "thinking" | "context" | "typing" | "done">("prompt");
  const [typedResponse, setTypedResponse] = useState("");
  const typerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const script = SCRIPTS[scriptIdx];

  // Advance the phase machine.
  useEffect(() => {
    // Clear any lingering typewriter interval before phase transitions.
    if (typerRef.current) {
      clearInterval(typerRef.current);
      typerRef.current = null;
    }
    setTypedResponse("");

    if (phase === "prompt") {
      const t = setTimeout(() => setPhase("thinking"), 2200);
      return () => clearTimeout(t);
    }
    if (phase === "thinking") {
      const t = setTimeout(() => setPhase("context"), 1500);
      return () => clearTimeout(t);
    }
    if (phase === "context") {
      const t = setTimeout(() => setPhase("typing"), 2200);
      return () => clearTimeout(t);
    }
    if (phase === "typing") {
      // Typewriter. Aim ~55 chars/sec for a rich but readable stream.
      let i = 0;
      typerRef.current = setInterval(() => {
        i += 3;
        if (i >= script.response.length) {
          setTypedResponse(script.response);
          if (typerRef.current) clearInterval(typerRef.current);
          typerRef.current = null;
          setPhase("done");
        } else {
          setTypedResponse(script.response.slice(0, i));
        }
      }, 40);
      return () => {
        if (typerRef.current) clearInterval(typerRef.current);
        typerRef.current = null;
      };
    }
    if (phase === "done") {
      const t = setTimeout(() => {
        setScriptIdx((idx) => (idx + 1) % SCRIPTS.length);
        setPhase("prompt");
      }, 5500);
      return () => clearTimeout(t);
    }
  }, [phase, script.response]);

  const sourceColor = script.crmSource === "HubSpot" ? "#ff7a59" : "#e42527";

  return (
    <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-black/5" style={{ background: "linear-gradient(180deg, #fefcf9 0%, #f9f4ec 100%)" }}>
      {/* Chrome */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-black/5 bg-white/60 backdrop-blur">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
        </div>
        <div className="flex-1 text-center text-[11px] font-medium text-[var(--dmoop-text-tertiary)]">
          dmoop.com/chat
        </div>
        <div className="text-[10px] font-semibold tracking-wider uppercase text-[var(--dmoop-accent)] flex items-center gap-1">
          <Sparkles size={10} /> Tuned
        </div>
      </div>

      {/* Body */}
      <div className="p-5 sm:p-7 min-h-[520px] flex flex-col gap-4">
        {/* User prompt bubble */}
        <motion.div
          key={`prompt-${scriptIdx}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="self-end max-w-[85%] px-4 py-3 rounded-2xl rounded-tr-md text-[13.5px] leading-relaxed text-[var(--dmoop-text-primary)]"
          style={{ background: "#f0e9df" }}
        >
          {script.prompt}
        </motion.div>

        {/* Thinking indicator */}
        <AnimatePresence>
          {phase === "thinking" && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="self-start flex items-center gap-2.5 px-4 py-3 rounded-2xl rounded-tl-md text-[12.5px] text-[var(--dmoop-text-secondary)] bg-white/70 shadow-sm border border-black/[0.03]"
            >
              <div className="flex gap-1">
                <motion.span animate={{ y: [0, -4, 0] }} transition={{ duration: 0.9, repeat: Infinity }} className="w-1.5 h-1.5 rounded-full bg-[var(--dmoop-accent)]" />
                <motion.span animate={{ y: [0, -4, 0] }} transition={{ duration: 0.9, repeat: Infinity, delay: 0.15 }} className="w-1.5 h-1.5 rounded-full bg-[var(--dmoop-accent)]" />
                <motion.span animate={{ y: [0, -4, 0] }} transition={{ duration: 0.9, repeat: Infinity, delay: 0.3 }} className="w-1.5 h-1.5 rounded-full bg-[var(--dmoop-accent)]" />
              </div>
              <span>Detecting CRM contact…</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* CRM context reveal */}
        <AnimatePresence>
          {(phase === "context" || phase === "typing" || phase === "done") && (
            <motion.div
              initial={{ opacity: 0, x: -12, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="self-start max-w-[90%] rounded-2xl border border-black/5 shadow-sm bg-white/90 backdrop-blur overflow-hidden"
            >
              <div className="flex items-center gap-2 px-3.5 py-2 border-b border-black/[0.04]" style={{ background: `${sourceColor}0f` }}>
                <Database size={12} style={{ color: sourceColor }} />
                <span className="text-[10.5px] font-bold uppercase tracking-wider" style={{ color: sourceColor }}>
                  CRM Context
                </span>
                <span className="text-[10.5px] font-semibold text-[var(--dmoop-text-tertiary)]">
                  · {script.crmSource}
                </span>
              </div>
              <div className="px-3.5 py-3 space-y-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-[13px] font-semibold text-[var(--dmoop-text-primary)]">{script.crmContact.name}</span>
                  <span className="text-[11.5px] text-[var(--dmoop-text-tertiary)]">·  {script.crmContact.role}</span>
                </div>
                <div className="text-[11.5px] text-[var(--dmoop-text-secondary)]">
                  <span className="font-medium">{script.crmContact.company}</span>
                  {"  ·  Stage: "}
                  <span className="font-medium">{script.crmContact.stage}</span>
                </div>
                <div className="text-[11px] text-[var(--dmoop-text-tertiary)] flex items-center gap-1">
                  <Zap size={10} />
                  Last touch: {script.crmContact.lastTouch}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Streamed response */}
        <AnimatePresence>
          {(phase === "typing" || phase === "done") && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="self-start max-w-[92%] rounded-2xl rounded-tl-md bg-white shadow-md border border-black/5 overflow-hidden"
            >
              <div className="flex items-center gap-2 px-3.5 py-2 border-b border-black/[0.04]">
                <Mail size={12} className="text-[var(--dmoop-accent)]" />
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--dmoop-accent)]">
                  Generated
                </span>
              </div>
              <pre className="px-4 py-3 text-[12.5px] leading-relaxed text-[var(--dmoop-text-primary)] whitespace-pre-wrap font-sans">
                {typedResponse}
                {phase === "typing" && <span className="inline-block w-[1px] h-[13px] -mb-[1px] bg-[var(--dmoop-accent)] animate-pulse ml-[1px]" />}
              </pre>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1" />

        {/* Slide indicator */}
        <div className="flex items-center justify-center gap-1.5 pt-3">
          {SCRIPTS.map((_, i) => (
            <button
              key={i}
              onClick={() => { setScriptIdx(i); setPhase("prompt"); }}
              className="relative h-1 rounded-full transition-all overflow-hidden"
              style={{ width: i === scriptIdx ? 24 : 8, background: i === scriptIdx ? "var(--dmoop-accent)" : "#d9cfc2" }}
              aria-label={`Show demo ${i + 1}`}
            />
          ))}
          <div className="ml-3 text-[10.5px] font-medium text-[var(--dmoop-text-tertiary)] flex items-center gap-1">
            <span>Live demo</span>
            <ChevronRight size={10} />
            <span className="font-semibold text-[var(--dmoop-accent)]">{scriptIdx + 1} of {SCRIPTS.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
