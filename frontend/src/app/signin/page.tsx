"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Loader2, Mail, Lock, AlertCircle, CheckCircle2 } from "lucide-react";

function LinkedInGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.852 3.37-1.852 3.601 0 4.267 2.37 4.267 5.455v6.288zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.063 2.063 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" style={{ background: "var(--dmoop-bg-app)" }} />}>
      <SignInForm />
    </Suspense>
  );
}

function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = params.get("redirect") ?? "/chat";
  const resetSuccess = params.get("reset") === "success";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      // Supabase returns "Email not confirmed" when the account exists
      // but the OTP flow hasn't been completed yet. Route the user to
      // the verify page so they can enter the code (and resend if the
      // original one expired) instead of getting stuck on a raw error.
      const msg = error.message.toLowerCase();
      if (msg.includes("email not confirmed") || msg.includes("not confirmed")) {
        router.push(`/verify?email=${encodeURIComponent(email)}`);
        return;
      }
      setError(error.message);
      setLoading(false);
      return;
    }
    router.push(redirectTo);
    router.refresh();
  };

  const handleLinkedIn = async () => {
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "linkedin_oidc",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError(error.message);
    // On success Supabase navigates the browser away; nothing more to do.
  };

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your DMOOP account">
      {resetSuccess && (
        <div className="flex items-start gap-2 px-3 py-2.5 mb-4 rounded-lg bg-emerald-50 border border-emerald-200 text-[12.5px] text-emerald-700">
          <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
          <span>Password updated. Sign in with your new password.</span>
        </div>
      )}
      <button type="button" onClick={handleLinkedIn}
        className="h-11 w-full rounded-xl flex items-center justify-center gap-2 text-[14px] font-semibold text-white transition-all hover:opacity-90"
        style={{ background: "#0A66C2", boxShadow: "0 1px 2px rgba(10,102,194,0.25)" }}>
        <LinkedInGlyph size={16} /> Continue with LinkedIn
      </button>
      <div className="flex items-center gap-3 my-4">
        <div className="flex-1 h-px bg-[var(--dmoop-border-soft)]" />
        <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--dmoop-text-tertiary)]">or</span>
        <div className="flex-1 h-px bg-[var(--dmoop-border-soft)]" />
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field icon={Mail} type="email" placeholder="you@company.com" value={email} onChange={setEmail} autoComplete="email" />
        <Field icon={Lock} type="password" placeholder="Password" value={password} onChange={setPassword} autoComplete="current-password" />

        <div className="flex justify-end -mt-1">
          <Link href="/forgot-password" className="text-[12px] text-[var(--dmoop-text-secondary)] hover:text-[var(--dmoop-accent)] transition-colors">
            Forgot password?
          </Link>
        </div>

        {error && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-[12.5px] text-red-700">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <button type="submit" disabled={loading || !email || !password}
          className="h-11 rounded-xl dmoop-btn-primary text-[14px] font-semibold flex items-center justify-center gap-2 transition-all">
          {loading ? <><Loader2 size={15} className="animate-spin" /> Signing in…</> : "Sign in"}
        </button>
      </form>

      <p className="text-center text-[13px] text-[var(--dmoop-text-secondary)] mt-6">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-semibold text-[var(--dmoop-accent)] hover:text-[var(--dmoop-accent-rich)]">
          Create one
        </Link>
      </p>
    </AuthShell>
  );
}

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: "var(--dmoop-bg-app)" }}>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] pointer-events-none opacity-50"
        style={{ background: "radial-gradient(ellipse at top, rgba(193,74,42,0.12) 0%, transparent 70%)" }} />

      <div className="relative w-full max-w-md dmoop-fade-in">
        <div className="flex justify-center mb-7">
          <div className="relative">
            <Image src="/dmoop-logo.png" alt="DMOOP" width={180} height={56} priority className="h-12 w-auto" />
          </div>
        </div>

        <div className="p-6 sm:p-8 rounded-2xl"
          style={{
            background: "var(--dmoop-gradient-card)",
            border: "1px solid var(--dmoop-border-soft)",
            boxShadow: "var(--dmoop-shadow-xl)",
          }}>
          <div className="text-center mb-7">
            <h1 className="text-[24px] font-semibold tracking-tight text-[var(--dmoop-text-primary)] mb-1.5">{title}</h1>
            <p className="text-[13.5px] text-[var(--dmoop-text-secondary)]">{subtitle}</p>
          </div>
          {children}
        </div>

        <p className="text-center text-[11px] text-[var(--dmoop-text-tertiary)] mt-6 tracking-wide">
          Enterprise marketing intelligence, fine-tuned for you.
        </p>
      </div>
    </div>
  );
}

function Field({ icon: Icon, type, placeholder, value, onChange, autoComplete }: {
  icon: React.ComponentType<{ size: number; className?: string }>;
  type: string; placeholder: string; value: string; onChange: (v: string) => void; autoComplete?: string;
}) {
  return (
    <div className="relative">
      <Icon size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--dmoop-text-tertiary)] pointer-events-none" />
      <input type={type} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} required
        className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-white border border-[var(--dmoop-border-soft)] text-[14px] text-[var(--dmoop-text-primary)] placeholder:text-[var(--dmoop-text-tertiary)] focus:outline-none focus:border-[var(--dmoop-accent)] focus:ring-4 focus:ring-[var(--dmoop-accent)]/10 transition-all" />
    </div>
  );
}
