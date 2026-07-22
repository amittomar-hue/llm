"use client";

// ─────────────────────────────────────────────────────────────────
// Shared top-nav used across the marketing surface: landing,
// /how-it-works, /integrations, and anywhere else that needs to feel
// like part of the same site. Kept intentionally narrow — the app
// surface (chat, admin, settings) has its own contextual nav.
//
// Signed-in state is fetched client-side once mounted, so anonymous
// visitors see "Sign in / Get started" and returning users see
// "Open DMOOP".
// ─────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Menu, X } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

interface NavLink {
  href: string;
  label: string;
}

const LINKS: NavLink[] = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/integrations", label: "Integrations" },
  { href: "/resources", label: "Resources" },
  { href: "/docs/api", label: "API" },
];

export function SharedNav() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const sb = createSupabaseBrowserClient();
    sb.auth.getUser().then(({ data: { user } }) => setSignedIn(!!user));
  }, []);

  return (
    <nav className="sticky top-0 z-30 border-b border-[var(--dmoop-border-soft)] backdrop-blur-xl bg-white/70">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
        <Link href="/" className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          <Image
            src="/dmoop-logo.png"
            alt="DMOOP"
            width={130}
            height={36}
            priority
            className="h-7 sm:h-8 w-auto"
          />
          <span
            className="hidden md:inline text-[10px] font-bold tracking-[0.14em] text-[var(--dmoop-accent)] uppercase px-1.5 py-0.5 rounded-md"
            style={{ background: "rgba(193,74,42,0.08)" }}
          >
            DMOOP
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-1 shrink-0">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="px-3 py-2 text-[13px] font-medium text-[var(--dmoop-text-secondary)] hover:text-[var(--dmoop-text-primary)] transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* Auth CTA */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {signedIn ? (
            <Link
              href="/chat"
              className="h-8 sm:h-9 px-3 sm:px-4 rounded-lg dmoop-btn-primary text-[12.5px] sm:text-[13px] font-semibold flex items-center gap-1.5"
            >
              Open <span className="hidden sm:inline">DMOOP</span>
              <ArrowRight size={13} />
            </Link>
          ) : (
            <>
              <Link
                href="/signin"
                className="hidden sm:inline-block px-2 sm:px-3 py-1.5 sm:py-2 text-[12.5px] sm:text-[13px] font-medium text-[var(--dmoop-text-primary)] hover:bg-white hover:shadow-[var(--dmoop-shadow-sm)] rounded-lg transition-all"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="h-8 sm:h-9 px-3 sm:px-4 rounded-lg dmoop-btn-primary text-[12.5px] sm:text-[13px] font-semibold flex items-center gap-1 sm:gap-1.5"
              >
                <span className="hidden sm:inline">Get started</span>
                <span className="sm:hidden">Start</span>
                <ArrowRight size={13} />
              </Link>
            </>
          )}

          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="md:hidden p-2 rounded-lg text-[var(--dmoop-text-secondary)] hover:bg-[var(--dmoop-border-soft)]/50"
            aria-label="Toggle menu"
          >
            {menuOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-[var(--dmoop-border-soft)] bg-white/95 backdrop-blur">
          <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col gap-1">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className="px-3 py-2.5 rounded-lg text-[13.5px] font-medium text-[var(--dmoop-text-primary)] hover:bg-[var(--dmoop-border-soft)]/50"
              >
                {l.label}
              </Link>
            ))}
            {!signedIn && (
              <Link
                href="/signin"
                onClick={() => setMenuOpen(false)}
                className="px-3 py-2.5 rounded-lg text-[13.5px] font-medium text-[var(--dmoop-text-primary)] hover:bg-[var(--dmoop-border-soft)]/50"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
