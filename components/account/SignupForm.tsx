"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Wordmark } from "@/components/layout/Wordmark";
import { completeAccountSetup } from "@/app/(site)/account/actions";

/**
 * OTP-verified sign-up: prove the email, THEN set a password + name. Verifying
 * the email before the account can see an existing customer's booking history
 * is deliberate (that history is PII), and the OTP flow is redirect-free — the
 * same reason the admin login avoids magic links on this shared project.
 */
export function SignupForm() {
  const [step, setStep] = useState<"details" | "code">("details");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || password.length < 8) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: true },
      });
      if (otpError) {
        setError(otpError.message);
        setLoading(false);
        return;
      }
      setStep("code");
      setLoading(false);
    } catch {
      setError("Sign-up is unavailable right now.");
      setLoading(false);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = code.trim();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token,
        type: "email",
      });
      if (verifyError) {
        setError("That code didn't work — check it and try again, or resend.");
        setLoading(false);
        return;
      }
      // Session established. Set the password + name on the now-verified user.
      const { error: updateError } = await supabase.auth.updateUser({
        password,
        data: { name: name.trim() },
      });
      if (updateError) {
        setError(updateError.message);
        setLoading(false);
        return;
      }
      // Link any existing customer record + send the welcome email (best-effort).
      await completeAccountSetup();
      // Full navigation so the server picks up the fresh session cookie.
      window.location.href = "/account";
    } catch {
      setError("Sign-up is unavailable right now.");
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

      {step === "details" ? (
        <form onSubmit={sendCode}>
          <h1 className="h2 text-text">Create your account</h1>
          <p className="lead mt-2 text-sm">
            Track your sessions, banked hours and rewards in one place.
          </p>

          <div className="mt-8">
            <label htmlFor="name" className="font-mono text-meta uppercase tracking-meta text-text-muted">
              Name
            </label>
            <input
              id="name"
              type="text"
              required
              autoComplete="name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input mt-2"
            />
          </div>

          <div className="mt-6">
            <label htmlFor="email" className="font-mono text-meta uppercase tracking-meta text-text-muted">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input mt-2"
            />
          </div>

          <div className="mt-6">
            <label htmlFor="password" className="font-mono text-meta uppercase tracking-meta text-text-muted">
              Password
            </label>
            <input
              id="password"
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
            disabled={loading || password.length < 8}
            className="btn btn-primary mt-8 w-full"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Continue"}
          </button>

          <p className="mt-6 text-sm text-text-muted">
            Booked with us before? Use the same email — your booking history
            connects automatically.
          </p>
          <Link
            href="/account/login"
            className="mt-4 inline-block font-mono text-meta uppercase tracking-meta text-text-muted underline underline-offset-4"
          >
            I already have an account
          </Link>
        </form>
      ) : (
        <form onSubmit={verify}>
          <h1 className="h2 text-text">Enter your code</h1>
          <p className="lead mt-2 text-sm">
            We emailed a 6-digit code to <span className="text-text">{email}</span>. Enter it to
            finish setting up your account.
          </p>

          <div className="mt-8">
            <label htmlFor="code" className="font-mono text-meta uppercase tracking-meta text-text-muted">
              Sign-up code
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

          <button type="submit" disabled={loading || code.length < 6} className="btn btn-primary mt-8 w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Create account"}
          </button>

          <div className="mt-6 flex items-center gap-4">
            <button
              type="button"
              onClick={() => {
                setStep("details");
                setCode("");
                setError(null);
              }}
              className="font-mono text-meta uppercase tracking-meta text-text-muted underline underline-offset-4"
            >
              Change details
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => sendCode({ preventDefault: () => {} } as React.FormEvent)}
              className="font-mono text-meta uppercase tracking-meta text-text-muted underline underline-offset-4"
            >
              Resend code
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
