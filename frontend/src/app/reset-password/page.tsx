"use client";

// ─────────────────────────────────────────────────────────────────
// /reset-password — landing page for the Supabase password reset link.
//
// Supabase's reset link lands the user here with either:
//   • ?code=…           (PKCE flow — default for @supabase/ssr)
//   • #access_token=…&refresh_token=…&type=recovery   (legacy hash)
//
// In both cases the user has NO session yet; we have to establish a
// short-lived "recovery" session first, then let them set a new
// password via supabase.auth.updateUser({password}).
//
// We support both link styles so a recovery email already in someone's
// inbox keeps working if Supabase ever toggles flow type.
// ─────────────────────────────────────────────────────────────────

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Loader2, Lock, AlertCircle } from "lucide-react";

type Stage = "verifying" | "ready" | "invalid";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" style={{ background: "var(--dmoop-bg-app)" }} />}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("verifying");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invalidReason, setInvalidReason] = useState<string | null>(null);

  // Exchange the recovery token in the URL for a session as soon as
  // the component mounts. Until that succeeds, the password form
  // stays hidden — calling updateUser without a session 401s.
  useEffect(() => {
    const run = async () => {
      const supabase = createSupabaseBrowserClient();
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const hasHashTokens = window.location.hash.includes("access_token");

      if (code) {
        const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
        if (exErr) {
          setInvalidReason(exErr.message);
          setStage("invalid");
          return;
        }
        window.history.replaceState(null, "", "/reset-password");
        setStage("ready");
        return;
      }

      if (hasHashTokens) {
        // detectSessionInUrl on the browser client parses the hash
        // during construction — give it a tick to land before we
        // check getSession().
        await new Promise((r) => setTimeout(r, 100));
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          window.history.replaceState(null, "", "/reset-password");
          setStage("ready");
          return;
        }
      }

      // If the user navigated here directly without a recovery link
      // but they already have a logged-in session (e.g. they want to
      // change their password from settings), let them through.
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setStage("ready");
        return;
      }

      setInvalidReason("Reset link is missing or has expired.");
      setStage("invalid");
    };

    void run();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirmPassword) { setError("Passwords don't match."); return; }
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { setError(error.message); setLoading(false); return; }
    // Sign the recovery session out so the user has to log in with
    // the new password — confirms they remember what they just set.
    await supabase.auth.signOut();
    router.push("/signin?reset=success");
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: "var(--dmoop-bg-app)" }}>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] pointer-events-none opacity-50"
        style={{ background: "radial-gradient(ellipse at top, rgba(193,74,42,0.12) 0%, transparent 70%)" }} />
      <div className="relative w-full max-w-md dmoop-fade-in">
        <div className="flex justify-center mb-7">
          <Image src="/dmoop-logo.png" alt="DMOOP" width={180} height={56} priority className="h-12 w-auto" />
        </div>

        <div className="p-6 sm:p-8 rounded-2xl" style={{ background: "var(--dmoop-gradient-card)", border: "1px solid var(--dmoop-border-soft)", boxShadow: "var(--dmoop-shadow-xl)" }}>
          {stage === "verifying" && (
            <div className="text-center py-6">
              <Loader2 size={26} className="animate-spin text-[var(--dmoop-accent)] mx-auto mb-3" />
              <p className="text-[13.5px] text-[var(--dmoop-text-secondary)]">Verifying your reset link…</p>
            </div>
          )}

          {stage === "invalid" && (
            <div className="text-center">
              <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center bg-red-50">
                <AlertCircle size={26} className="text-red-600" />
              </div>
              <h1 className="text-[22px] font-semibold tracking-tight text-[var(--dmoop-text-primary)] mb-2">Link expired</h1>
              <p className="text-[13.5px] text-[var(--dmoop-text-secondary)] mb-6 leading-relaxed">
                {invalidReason || "This reset link is no longer valid."} Request a fresh one and try again.
              </p>
              <Link href="/forgot-password" className="inline-block h-11 px-5 rounded-xl dmoop-btn-primary text-[14px] font-semibold leading-[42px]">
                Get a new link
              </Link>
              <div className="mt-4">
                <Link href="/signin" className="text-[13px] font-semibold text-[var(--dmoop-accent)] hover:text-[var(--dmoop-accent-rich)]">
                  Back to sign in →
                </Link>
              </div>
            </div>
          )}

          {stage === "ready" && (
            <>
              <div className="text-center mb-7">
                <h1 className="text-[24px] font-semibold tracking-tight text-[var(--dmoop-text-primary)] mb-1.5">Set a new password</h1>
                <p className="text-[13.5px] text-[var(--dmoop-text-secondary)]">Pick something strong — minimum 8 characters</p>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--dmoop-text-tertiary)] pointer-events-none" />
                  <input type="password" placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password"
                    className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-white border border-[var(--dmoop-border-soft)] text-[14px] focus:outline-none focus:border-[var(--dmoop-accent)] focus:ring-4 focus:ring-[var(--dmoop-accent)]/10 transition-all" />
                </div>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--dmoop-text-tertiary)] pointer-events-none" />
                  <input type="password" placeholder="Confirm new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required autoComplete="new-password"
                    className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-white border border-[var(--dmoop-border-soft)] text-[14px] focus:outline-none focus:border-[var(--dmoop-accent)] focus:ring-4 focus:ring-[var(--dmoop-accent)]/10 transition-all" />
                </div>

                {error && (
                  <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-[12.5px] text-red-700">
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <button type="submit" disabled={loading || !password || !confirmPassword}
                  className="h-11 rounded-xl dmoop-btn-primary text-[14px] font-semibold flex items-center justify-center gap-2">
                  {loading ? <><Loader2 size={15} className="animate-spin" /> Updating…</> : "Update password"}
                </button>
              </form>

              <p className="text-center text-[13px] text-[var(--dmoop-text-secondary)] mt-6">
                <Link href="/signin" className="font-semibold text-[var(--dmoop-accent)] hover:text-[var(--dmoop-accent-rich)]">
                  Back to sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
