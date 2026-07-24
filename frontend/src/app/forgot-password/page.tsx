"use client";

import { useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Loader2, Mail, AlertCircle, CheckCircle2 } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) { setError(error.message); setLoading(false); return; }
    setSent(true);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: "var(--reverb-bg-app)" }}>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] pointer-events-none opacity-50"
        style={{ background: "radial-gradient(ellipse at top, rgba(193,74,42,0.12) 0%, transparent 70%)" }} />
      <div className="relative w-full max-w-md reverb-fade-in">
        <div className="flex justify-center mb-7">
          <span className="font-semibold tracking-tight text-[var(--reverb-accent)] text-lg">Reverb</span>
        </div>

        <div className="p-6 sm:p-8 rounded-2xl" style={{ background: "var(--reverb-gradient-card)", border: "1px solid var(--reverb-border-soft)", boxShadow: "var(--reverb-shadow-xl)" }}>
          {sent ? (
            <div className="text-center">
              <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: "var(--reverb-gradient-accent)", boxShadow: "var(--reverb-shadow-accent)" }}>
                <CheckCircle2 size={26} className="text-white" />
              </div>
              <h1 className="text-[22px] font-semibold tracking-tight text-[var(--reverb-text-primary)] mb-2">Check your email</h1>
              <p className="text-[13.5px] text-[var(--reverb-text-secondary)] mb-6 leading-relaxed">
                We&apos;ve sent a password reset link to <strong className="text-[var(--reverb-text-primary)]">{email}</strong>.
                Click it to set a new password.
              </p>
              <Link href="/signin" className="text-[13px] font-semibold text-[var(--reverb-accent)] hover:text-[var(--reverb-accent-rich)]">
                Back to sign in →
              </Link>
            </div>
          ) : (
            <>
              <div className="text-center mb-7">
                <h1 className="text-[24px] font-semibold tracking-tight text-[var(--reverb-text-primary)] mb-1.5">Reset your password</h1>
                <p className="text-[13.5px] text-[var(--reverb-text-secondary)]">Enter your email and we&apos;ll send you a reset link</p>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--reverb-text-tertiary)] pointer-events-none" />
                  <input type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email"
                    className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-white border border-[var(--reverb-border-soft)] text-[14px] focus:outline-none focus:border-[var(--reverb-accent)] focus:ring-4 focus:ring-[var(--reverb-accent)]/10 transition-all" />
                </div>

                {error && (
                  <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-[12.5px] text-red-700">
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <button type="submit" disabled={loading || !email}
                  className="h-11 rounded-xl reverb-btn-primary text-[14px] font-semibold flex items-center justify-center gap-2">
                  {loading ? <><Loader2 size={15} className="animate-spin" /> Sending…</> : "Send reset link"}
                </button>
              </form>

              <p className="text-center text-[13px] text-[var(--reverb-text-secondary)] mt-6">
                Remembered it?{" "}
                <Link href="/signin" className="font-semibold text-[var(--reverb-accent)] hover:text-[var(--reverb-accent-rich)]">Back to sign in</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
