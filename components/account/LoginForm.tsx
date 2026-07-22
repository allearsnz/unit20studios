"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Wordmark } from "@/components/layout/Wordmark";

/** Only allow same-origin /account paths as a post-login destination. */
function safeNext(raw: string | null): string {
  if (!raw) return "/account";
  return raw.startsWith("/account") && !raw.startsWith("//") ? raw : "/account";
}

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [next, setNext] = useState("/account");

  useEffect(() => {
    setNext(safeNext(new URLSearchParams(window.location.search).get("next")));
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
      window.location.href = next;
    } catch {
      setError("Sign-in is unavailable right now.");
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

      <form onSubmit={signIn}>
        <h1 className="h2 text-text">Sign in</h1>
        <p className="lead mt-2 text-sm">Your bookings, banked hours and rewards.</p>

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

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/account/signup"
            className="font-mono text-meta uppercase tracking-meta text-text-muted underline underline-offset-4"
          >
            Create an account
          </Link>
          <Link
            href="/account/forgot"
            className="font-mono text-meta uppercase tracking-meta text-text-muted underline underline-offset-4"
          >
            Forgot password
          </Link>
        </div>
      </form>
    </div>
  );
}
