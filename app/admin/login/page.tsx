"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Wordmark } from "@/components/layout/Wordmark";

/**
 * Admin sign-in via email + PASSWORD (`signInWithPassword`).
 * Deliberately password-based and redirect-free: this Supabase project is
 * shared with the crew app, so a magic-link / OAuth redirect can fall back to
 * the shared Site URL and bounce the user into the wrong app. Password sign-in
 * establishes the session in-place — no redirect, no /auth/callback, no
 * redirect-allow-list matching involved.
 *
 * The admin auth user already exists with a password (see README → Supabase
 * setup). Forgot it? Reset it via /account/forgot (auth-method agnostic — works
 * for the admin user too) or from the Supabase dashboard.
 */
export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const e = new URLSearchParams(window.location.search).get("e");
    if (e === "config") {
      setError("Supabase isn't configured yet — add the env vars and restart.");
    } else if (e === "auth") {
      setError("That sign-in link expired or is invalid — sign in with your password.");
    }
  }, []);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) {
        setError("Wrong email or password.");
        setLoading(false);
        return;
      }
      // Full navigation so the server (proxy.ts) picks up the fresh session cookie.
      window.location.href = "/admin";
    } catch {
      setError("Sign-in is unavailable right now.");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3">
          <Wordmark className="w-[96px]" />
          <span className="font-mono text-[11px] uppercase tracking-meta text-text-dim">Admin</span>
        </div>

        {error ? (
          <div role="alert" className="mb-6 border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        ) : null}

        <form onSubmit={signIn}>
          <h1 className="h2 text-text">Sign in</h1>
          <p className="lead mt-2 text-sm">Staff access only.</p>

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

          <div className="mt-6">
            <label htmlFor="password" className="font-mono text-meta uppercase tracking-meta text-text-muted">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input mt-2"
            />
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary mt-8 w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Sign in"}
          </button>

          <p className="mt-6 font-mono text-meta uppercase tracking-meta text-text-dim">
            Forgot your password?{" "}
            <a href="/account/forgot" className="text-text-muted underline underline-offset-4">
              Reset it
            </a>
            , then sign in here.
          </p>
        </form>
      </div>
    </div>
  );
}
