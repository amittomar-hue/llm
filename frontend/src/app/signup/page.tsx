"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Loader2, Mail, Lock, User, AlertCircle } from "lucide-react";

function LinkedInGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.852 3.37-1.852 3.601 0 4.267 2.37 4.267 5.455v6.288zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.063 2.063 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

export default function SignUpPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Anti-bot fields: honeypot stays hidden + empty for real users;
  // formRenderedAt timestamps page mount so the server can reject
  // submissions that arrive within milliseconds (bot-speed).
  const [honeypot, setHoneypot] = useState("");
  const formRenderedAt = useRef<number>(0);
  useEffect(() => { formRenderedAt.current = Date.now(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setLoading(true);

    // Server-side anti-bot precheck. Runs BEFORE Supabase signUp so
    // we never create accounts for known bot signatures (gibberish
    // names, gmail dot-trick emails, sub-second form submissions,
    // filled-honeypot bots). Returns a generic error to humans who
    // somehow trip the heuristics — we don't reveal which check
    // failed because that's gift-wrapping a bypass to attackers.
    try {
      const precheckRes = await fetch("/api/auth/signup-precheck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName,
          email,
          honeypot,
          form_rendered_at: formRenderedAt.current,
        }),
      });
      if (!precheckRes.ok) {
        const j = await precheckRes.json().catch(() => ({}));
        setError(j.reason ?? "We couldn't create your account.");
        setLoading(false);
        return;
      }
    } catch {
      // Network failure on precheck — fail open (let the user through)
      // rather than blocking a real signup behind a transient error.
    }

    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName } },
    });
    if (error) { setError(error.message); setLoading(false); return; }

    // If Supabase's auto-confirm is on, signUp returns a live session
    // and we can route straight to chat. When auto-confirm is off (the
    // OTP flow), signUp returns no session and Supabase has sent a
    // 6-digit code to the email — route to /verify to collect it.
    if (data.session) {
      router.push("/chat");
      router.refresh();
      return;
    }
    router.push(`/verify?email=${encodeURIComponent(email)}`);
  };

  const handleLinkedIn = async () => {
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "linkedin_oidc",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError(error.message);
  };

  return (
    <AuthShellLite title="Get started with Reverb" subtitle="Create your account in seconds">
      <button type="button" onClick={handleLinkedIn}
        className="h-11 w-full rounded-xl flex items-center justify-center gap-2 text-[14px] font-semibold text-white transition-all hover:opacity-90"
        style={{ background: "#0A66C2", boxShadow: "0 1px 2px rgba(10,102,194,0.25)" }}>
        <LinkedInGlyph size={16} /> Continue with LinkedIn
      </button>
      <div className="flex items-center gap-3 my-4">
        <div className="flex-1 h-px bg-[var(--reverb-border-soft)]" />
        <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--reverb-text-tertiary)]">or</span>
        <div className="flex-1 h-px bg-[var(--reverb-border-soft)]" />
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Honeypot — invisible to humans (off-screen, aria-hidden,
            tabIndex=-1, autocomplete=off), irresistible to dumb scrapers
            that auto-fill every input on the page. If this field comes
            back populated, the server precheck rejects the signup. */}
        <input
          type="text"
          name="company_url"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          style={{
            position: "absolute",
            left: "-10000px",
            top: "auto",
            width: 1,
            height: 1,
            overflow: "hidden",
            opacity: 0,
            pointerEvents: "none",
          }}
        />
        <InlineField icon={User} type="text" placeholder="Full name" value={fullName} onChange={setFullName} autoComplete="name" />
        <InlineField icon={Mail} type="email" placeholder="you@company.com" value={email} onChange={setEmail} autoComplete="email" />
        <InlineField icon={Lock} type="password" placeholder="Password (min 8 characters)" value={password} onChange={setPassword} autoComplete="new-password" />

        {error && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-[12.5px] text-red-700">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <button type="submit" disabled={loading || !email || !password || !fullName}
          className="h-11 rounded-xl reverb-btn-primary text-[14px] font-semibold flex items-center justify-center gap-2">
          {loading ? <><Loader2 size={15} className="animate-spin" /> Creating account…</> : "Create account"}
        </button>
      </form>

      <p className="text-center text-[11.5px] text-[var(--reverb-text-tertiary)] mt-4 leading-relaxed px-2">
        By creating an account you agree to our{" "}
        <Link href="/terms" className="text-[var(--reverb-text-secondary)] underline underline-offset-2 hover:text-[var(--reverb-accent)]">Terms of Service</Link>
        {" "}and{" "}
        <Link href="/privacy" className="text-[var(--reverb-text-secondary)] underline underline-offset-2 hover:text-[var(--reverb-accent)]">Privacy Policy</Link>.
      </p>

      <p className="text-center text-[13px] text-[var(--reverb-text-secondary)] mt-5">
        Already have an account?{" "}
        <Link href="/signin" className="font-semibold text-[var(--reverb-accent)] hover:text-[var(--reverb-accent-rich)]">Sign in</Link>
      </p>
    </AuthShellLite>
  );
}

function AuthShellLite({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: "var(--reverb-bg-app)" }}>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] pointer-events-none opacity-50"
        style={{ background: "radial-gradient(ellipse at top, rgba(193,74,42,0.12) 0%, transparent 70%)" }} />
      <div className="relative w-full max-w-md reverb-fade-in">
        <div className="flex justify-center mb-7">
          <span className="font-semibold tracking-tight text-[var(--reverb-accent)] text-lg">Reverb</span>
        </div>
        <div className="p-6 sm:p-8 rounded-2xl" style={{ background: "var(--reverb-gradient-card)", border: "1px solid var(--reverb-border-soft)", boxShadow: "var(--reverb-shadow-xl)" }}>
          <div className="text-center mb-7">
            <h1 className="text-[24px] font-semibold tracking-tight text-[var(--reverb-text-primary)] mb-1.5">{title}</h1>
            <p className="text-[13.5px] text-[var(--reverb-text-secondary)]">{subtitle}</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

function InlineField({ icon: Icon, type, placeholder, value, onChange, autoComplete }: {
  icon: React.ComponentType<{ size: number; className?: string }>;
  type: string; placeholder: string; value: string; onChange: (v: string) => void; autoComplete?: string;
}) {
  return (
    <div className="relative">
      <Icon size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--reverb-text-tertiary)] pointer-events-none" />
      <input type={type} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} required
        className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-white border border-[var(--reverb-border-soft)] text-[14px] focus:outline-none focus:border-[var(--reverb-accent)] focus:ring-4 focus:ring-[var(--reverb-accent)]/10 transition-all" />
    </div>
  );
}
