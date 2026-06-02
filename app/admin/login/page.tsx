"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Wordmark } from "@/components/layout/Wordmark";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("e") === "config") {
      setError("Supabase isn't configured yet — add the env vars and restart.");
    }
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }
      router.replace("/admin");
      router.refresh();
    } catch {
      setError("Sign-in is unavailable right now.");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3">
          <Wordmark className="w-[96px]" />
          <span className="font-mono text-[11px] uppercase tracking-meta text-text-dim">Admin</span>
        </div>
        <h1 className="h2 text-text">Sign in</h1>
        <p className="lead mt-2 text-sm">Staff access only.</p>

        {error ? (
          <div role="alert" className="mt-6 border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        ) : null}

        <div className="mt-8 space-y-6">
          <div>
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
          <div>
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
        </div>

        <button type="submit" disabled={loading} className="btn btn-primary mt-8 w-full">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Sign in"}
        </button>
      </form>
    </div>
  );
}
