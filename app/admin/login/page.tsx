"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Wordmark } from "@/components/layout/Wordmark";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const e = new URLSearchParams(window.location.search).get("e");
    if (e === "config") {
      setError("Supabase isn't configured yet — add the env vars and restart.");
    } else if (e === "auth") {
      setError("That sign-in link expired or is invalid — send a new one.");
    }
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          shouldCreateUser: false,
        },
      });
      if (otpError) {
        setError(otpError.message);
        setLoading(false);
        return;
      }
      setSent(true);
      setLoading(false);
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

        {sent ? (
          <div>
            <CheckCircle2 className="mb-4 h-8 w-8 text-text" aria-hidden />
            <h1 className="h2 text-text">Check your email</h1>
            <p className="lead mt-2 text-sm">
              We sent a sign-in link to <span className="text-text">{email}</span>. Open it in this
              browser to finish signing in.
            </p>
            <button
              type="button"
              onClick={() => setSent(false)}
              className="mt-6 font-mono text-meta uppercase tracking-meta text-text-muted underline underline-offset-4"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <h1 className="h2 text-text">Sign in</h1>
            <p className="lead mt-2 text-sm">Staff access only. We&rsquo;ll email you a sign-in link.</p>

            {error ? (
              <div role="alert" className="mt-6 border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
                {error}
              </div>
            ) : null}

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
              {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Email me a sign-in link"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
