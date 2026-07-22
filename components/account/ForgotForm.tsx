"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Wordmark } from "@/components/layout/Wordmark";

/**
 * Redirect-free password reset via an emailed OTP code (not a reset link — the
 * shared project's link redirects can bounce to the wrong app). Works for any
 * auth user, including the admin. Flow: email → code → new password.
 */
export function ForgotForm() {
  const [step, setStep] = useState<"email" | "code" | "done">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: false },
      });
      if (otpError) {
        setError(otpError.message);
        setLoading(false);
        return;
      }
      setStep("code");
      setLoading(false);
    } catch {
      setError("Reset is unavailable right now.");
      setLoading(false);
    }
  };

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || password.length < 8) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: "email",
      });
      if (verifyError) {
        setError("That code didn't work — check it and try again, or resend.");
        setLoading(false);
        return;
      }
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        setLoading(false);
        return;
      }
      setStep("done");
      setLoading(false);
    } catch {
      setError("Reset is unavailable right now.");
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-sm pb-24 pt-32 md:pt-40">
      <div className="mb-8 flex items-center gap-3">
        <Wordmark className="w-[96px]" />
        <span className="font-mono text-[11px] uppercase tracking-meta text-text-dim">Account</span>
      </div>

      {error ? (
        <div role="alert" className="mb-6 border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      {step === "email" ? (
        <form onSubmit={sendCode}>
          <h1 className="h2 text-text">Reset your password</h1>
          <p className="lead mt-2 text-sm">We&rsquo;ll email you a code to confirm it&rsquo;s you.</p>

          <div className="mt-8">
            <label htmlFor="email" className="font-mono text-meta uppercase tracking-meta text-text-muted">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input mt-2"
            />
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary mt-8 w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Email me a code"}
          </button>

          <Link
            href="/account/login"
            className="mt-6 inline-block font-mono text-meta uppercase tracking-meta text-text-muted underline underline-offset-4"
          >
            Back to sign in
          </Link>
        </form>
      ) : step === "code" ? (
        <form onSubmit={resetPassword}>
          <h1 className="h2 text-text">New password</h1>
          <p className="lead mt-2 text-sm">
            Enter the code we sent to <span className="text-text">{email}</span> and choose a new
            password.
          </p>

          <div className="mt-8">
            <label htmlFor="code" className="font-mono text-meta uppercase tracking-meta text-text-muted">
              Code
            </label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={10}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="input mt-2 tracking-[0.4em]"
            />
          </div>

          <div className="mt-6">
            <label htmlFor="new-password" className="font-mono text-meta uppercase tracking-meta text-text-muted">
              New password
            </label>
            <input
              id="new-password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input mt-2"
            />
            <p className="mt-2 font-mono text-[11px] uppercase tracking-meta text-text-dim">
              8 characters or more.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || code.length < 6 || password.length < 8}
            className="btn btn-primary mt-8 w-full"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Update password"}
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => sendCode({ preventDefault: () => {} } as React.FormEvent)}
            className="mt-6 font-mono text-meta uppercase tracking-meta text-text-muted underline underline-offset-4"
          >
            Resend code
          </button>
        </form>
      ) : (
        <div>
          <h1 className="h2 text-text">Password updated</h1>
          <p className="lead mt-2 text-sm">You can sign in with your new password now.</p>
          <div className="mt-8 flex flex-col gap-3">
            <Link href="/account" className="btn btn-primary w-full">
              Go to my account
            </Link>
            <Link
              href="/admin/login"
              className="font-mono text-meta uppercase tracking-meta text-text-muted underline underline-offset-4"
            >
              Staff sign in
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
