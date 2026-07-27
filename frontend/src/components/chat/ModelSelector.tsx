"use client";

import { useState, useRef, useEffect } from "react";
import { useChatStore } from "@/lib/chat-store";
import { MODELS, getModel } from "@/lib/models";
import { Check, ChevronDown, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ModelSelector() {
  const { selectedModel, setModel } = useChatStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = getModel(selectedModel);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-[13px] transition-all duration-200 shrink-0",
          open
            ? "bg-[#f5f1ea] text-[var(--reverb-text-primary)]"
            : "text-[var(--reverb-text-secondary)] hover:bg-[#f5f1ea] hover:text-[var(--reverb-text-primary)]"
        )}
        title={current.name}
      >
        <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-white border border-[var(--reverb-border-soft)] shrink-0">
          <span className="font-bold text-[var(--reverb-accent)] text-[10px] leading-none">R</span>
        </span>
        <span className="font-semibold tracking-tight hidden min-[420px]:inline">{current.name}</span>
        <ChevronDown
          size={12}
          className={cn(
            "opacity-50 transition-transform duration-200 shrink-0",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <>
          {/* Mobile backdrop */}
          <div className="sm:hidden fixed inset-0 bg-black/30 z-40 reverb-fade-in" onClick={() => setOpen(false)} />
        <div
          className={cn(
            "rounded-2xl overflow-hidden z-50 reverb-scale-in",
            // Mobile: bottom sheet, positioned fixed above input bar
            "fixed left-3 right-3 bottom-[110px] max-h-[70vh] overflow-y-auto reverb-scroll",
            // Desktop: popover above the trigger, right-aligned
            "sm:absolute sm:inset-auto sm:bottom-full sm:right-0 sm:mb-2 sm:w-[380px] sm:max-h-none sm:overflow-visible"
          )}
          style={{
            background: "var(--reverb-gradient-card)",
            border: "1px solid var(--reverb-border-soft)",
            boxShadow: "var(--reverb-shadow-xl)",
          }}
        >
          <div className="px-4 pt-3.5 pb-2 border-b border-[var(--reverb-border-soft)]">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-[var(--reverb-text-tertiary)] uppercase tracking-wider">
                Choose a model
              </p>
              <Zap size={11} className="text-[var(--reverb-text-tertiary)]" />
            </div>
          </div>
          <div className="py-1.5">
            {MODELS.map((m, i) => {
              const active = selectedModel === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    setModel(m.id);
                    setOpen(false);
                  }}
                  style={{ animationDelay: `${i * 40}ms` }}
                  className={cn(
                    "group relative w-full px-4 py-3 transition-all duration-150 flex items-start gap-3 text-left reverb-stagger-in",
                    active ? "bg-[#f9f5ee]" : "hover:bg-[#faf6ef]"
                  )}
                >
                  {active && (
                    <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-[var(--reverb-accent)]" />
                  )}
                  <div
                    className={cn(
                      "w-8 h-8 shrink-0 rounded-lg bg-gradient-to-br flex items-center justify-center transition-transform duration-200 group-hover:scale-110 bg-white",
                      m.glow
                    )}
                    style={{ boxShadow: "var(--reverb-shadow-xs)", border: "1px solid var(--reverb-border-soft)" }}
                  >
                    <span className="font-bold text-[var(--reverb-accent)] text-[15px] leading-none">R</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[13.5px] font-semibold text-[var(--reverb-text-primary)] tracking-tight">
                        {m.label}
                      </span>
                      {m.badge && (
                        <span
                          className="text-[9px] px-1.5 py-0.5 rounded-md font-bold tracking-wide uppercase"
                          style={{
                            background: "rgba(193, 74, 42, 0.1)",
                            color: "var(--reverb-accent)",
                          }}
                        >
                          {m.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-[var(--reverb-text-secondary)] leading-relaxed mb-1.5">
                      {m.description}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-[var(--reverb-text-tertiary)]" />
                      <span className="text-[10.5px] text-[var(--reverb-text-tertiary)] font-medium tracking-wide">
                        {m.speed}
                      </span>
                    </div>
                  </div>
                  {active && (
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                      style={{
                        background: "var(--reverb-gradient-accent)",
                        boxShadow: "var(--reverb-shadow-xs)",
                      }}
                    >
                      <Check size={12} className="text-white" strokeWidth={3} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <div className="px-4 py-2.5 border-t border-[var(--reverb-border-soft)] bg-[#fbf8f4]">
            <p className="text-[10.5px] text-[var(--reverb-text-tertiary)] tracking-wide">
              All models powered by retrieval-augmented learning from your feedback.
            </p>
          </div>
        </div>
        </>
      )}
    </div>
  );
}
