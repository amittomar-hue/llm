"use client";

// ─────────────────────────────────────────────────────────────────
// /verify — email-OTP confirmation step for signup.
//
// Flow:
//   1. User signs up on /signup → we call supabase.auth.signUp,
//      which sends a 6-digit code to their email (using the
//      "Confirm signup" template configured to embed {{ .Token }})
//   2. Signup redirects here with ?email=<their_email>
//   3. User enters the 6-digit code from their inbox
//   4. We call supabase.auth.verifyOtp({ email, token, type: "signup" }),
//      which activates the account AND creates a session
//   5. Redirect to /chat
//
// UX bits:
//   • Six individual number inputs for the classic OTP look
//   • Paste handling on any box splits digits across all six
//   • Auto-advance on input, auto-back on backspace
//   • Resend button with a 45-second cooldown
//   • Cover the two failure modes explicitly (bad code, expired code)
// ─────────────────────────────────────────────────────────────────

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Loader2, Mail, AlertCircle, CheckCircle2, ArrowLeft } from "lucide-react";

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_SEC = 45;

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" style={{ background: "var(--dmoop-bg-app)" }} />}>
      <VerifyInner />
    </Suspense>
  );
}

function VerifyInner() {
  const router = useRouter();
  const params = useSearchParams();
  const emailFromQuery = params.get("email") ?? "";
  const [email, setEmail] = useState(emailFromQuery);
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  // Focus first empty box on mount + when email is set.
  useEffect(() => {
    if (!email) return;
    const firstEmpty = digits.findIndex((d) => d === "");
    inputRefs.current[firstEmpty === -1 ? 0 : firstEmpty]?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  // Countdown for resend button.
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const setDigit = (idx: number, val: string) => {
    // Accept only digits — silently ignore letters/symbols.
    const clean = val.replace(/\D/g, "").slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[idx] = clean;
      return next;
    });
    if (clean && idx < CODE_LENGTH - 1) {
      inputRefs.current[idx + 1]?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (e.key === "Backspace" && !digits[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && idx > 0) inputRefs.current[idx - 1]?.focus();
    if (e.key === "ArrowRight" && idx < CODE_LENGTH - 1) inputRefs.current[idx + 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH);
    if (!text) return;
    e.preventDefault();
    const arr = text.split("");
    setDigits((prev) => {
      const next = [...prev];
      for (let i = 0; i < CODE_LENGTH; i++) next[i] = arr[i] ?? "";
      return next;
    });
    const focusIdx = Math.min(arr.length, CODE_LENGTH - 1);
    inputRefs.current[focusIdx]?.focus();
  };

  const handleVerify = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    const code = digits.join("");
    if (code.length !== CODE_LENGTH) {
      setError(`Please enter all ${CODE_LENGTH} digits.`);
      return;
    }
    if (!email) {
      setError("Please enter the email you signed up with.");
      return;
    }
    setLoading(true);

    const supabase = createSupabaseBrowserClient();
    const { error: err } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code,
      type: "signup",
    });
    if (err) {
      // Common failure modes: expired code, wrong code.
      const msg = err.message.toLowerCase();
      if (msg.includes("expired")) {
        setError("This code expired. Tap Resend below to get a new one.");
      } else if (msg.includes("invalid") || msg.includes("token")) {
        setError("That code doesn't match. Double-check the six digits from your email.");
      } else {
        setError(err.message);
      }
      setDigits(Array(CODE_LENGTH).fill(""));
      inputRefs.current[0]?.focus();
      setLoading(false);
      return;
    }

    setSuccess(true);
    // Small pause so the success state is visible before the route change.
    setTimeout(() => {
      router.push("/chat");
      router.refresh();
    }, 800);
  };

  const handleResend = async () => {
    if (!email || resendCooldown > 0) return;
    setResending(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    // For an unverified signup, resend the signup confirmation.
    const { error: err } = await supabase.auth.resend({
      type: "signup",
      email: email.trim().toLowerCase(),
    });
    if (err) {
      setError(err.message);
    } else {
      setResendCooldown(RESEND_COOLDOWN_SEC);
    }
    setResending(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: "var(--dmoop-bg-app)" }}>
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] pointer-events-none opacity-50"
        style={{ background: "radial-gradient(ellipse at top, rgba(193,74,42,0.12) 0%, transparent 70%)" }}
      />
      <div className="relative w-full max-w-md dmoop-fade-in">
        <div className="flex justify-center mb-7">
          <Image src="/dmoop-logo.png" alt="DMOOP" width={180} height={56} priority className="h-12 w-auto" />
        </div>
        <div
          className="p-6 sm:p-8 rounded-2xl"
          style={{
            background: "var(--dmoop-gradient-card)",
            border: "1px solid var(--dmoop-border-soft)",
            boxShadow: "var(--dmoop-shadow-xl)",
          }}
        >
          <div className="text-center mb-6">
            <div
              className="mx-auto w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: "var(--dmoop-gradient-accent)", boxShadow: "var(--dmoop-shadow-accent)" }}
            >
              {success ? (
                <CheckCircle2 size={20} className="text-white" />
              ) : (
                <Mail size={20} className="text-white" />
              )}
            </div>
            <h1 className="text-[24px] font-semibold tracking-tight text-[var(--dmoop-text-primary)] mb-1.5">
              {success ? "You're in!" : "Check your email"}
            </h1>
            <p className="text-[13.5px] text-[var(--dmoop-text-secondary)] leading-relaxed">
              {success
                ? "Taking you to DMOOP…"
                : (
                  <>
                    We sent a 6-digit code to
                    <br />
                    <strong className="font-semibold text-[var(--dmoop-text-primary)]">{email || "your email"}</strong>
                  </>
                )}
            </p>
          </div>

          {!success && (
            <>
              {!emailFromQuery && (
                <div className="mb-4">
                  <label className="block text-[11.5px] font-semibold uppercase tracking-wider text-[var(--dmoop-text-tertiary)] mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    autoComplete="email"
                    className="w-full h-11 px-3.5 rounded-xl bg-white border border-[var(--dmoop-border-soft)] text-[14px] focus:outline-none focus:border-[var(--dmoop-accent)] focus:ring-4 focus:ring-[var(--dmoop-accent)]/10"
                  />
                </div>
              )}

              <form onSubmit={handleVerify} className="flex flex-col gap-4">
                <div>
                  <label className="block text-[11.5px] font-semibold uppercase tracking-wider text-[var(--dmoop-text-tertiary)] mb-1.5 text-center">
                    Verification code
                  </label>
                  <div className="flex items-center justify-center gap-2 sm:gap-2.5" onPaste={handlePaste}>
                    {digits.map((d, i) => (
                      <input
                        key={i}
                        ref={(el) => { inputRefs.current[i] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={d}
                        onChange={(e) => setDigit(i, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, i)}
                        onFocus={(e) => e.currentTarget.select()}
                        className="w-10 h-12 sm:w-11 sm:h-14 rounded-xl bg-white border border-[var(--dmoop-border-soft)] text-center text-[20px] sm:text-[22px] font-semibold text-[var(--dmoop-text-primary)] focus:outline-none focus:border-[var(--dmoop-accent)] focus:ring-4 focus:ring-[var(--dmoop-accent)]/10 transition-all"
                        aria-label={`Digit ${i + 1}`}
                      />
                    ))}
                  </div>
                </div>

                {error && (
                  <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-[12.5px] text-red-700">
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || digits.join("").length !== CODE_LENGTH}
                  className="h-11 rounded-xl dmoop-btn-primary text-[14px] font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 size={15} className="animate-spin" /> Verifying…
                    </>
                  ) : (
                    "Verify email"
                  )}
                </button>
              </form>

              <div className="mt-5 text-center text-[12.5px] text-[var(--dmoop-text-secondary)]">
                Didn&apos;t get the code?{" "}
                <button
                  onClick={handleResend}
                  disabled={resending || resendCooldown > 0 || !email}
                  className="font-semibold text-[var(--dmoop-accent)] hover:text-[var(--dmoop-accent-rich)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resending
                    ? "Sending…"
                    : resendCooldown > 0
                    ? `Resend in ${resendCooldown}s`
                    : "Resend code"}
                </button>
              </div>

              <div className="mt-5 pt-4 border-t border-[var(--dmoop-border-soft)] text-center">
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--dmoop-text-secondary)] hover:text-[var(--dmoop-text-primary)]"
                >
                  <ArrowLeft size={12} /> Use a different email
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
