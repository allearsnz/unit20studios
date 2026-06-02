"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCw } from "lucide-react";
import { Wordmark } from "@/components/layout/Wordmark";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log for diagnostics (wire to Sentry/etc. in phase 2)
    console.error("[app error]", error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-24 text-center">
      <Link href="/" className="mb-12 flex items-center" aria-label="Unit 20 — home">
        <Wordmark className="w-[136px]" />
      </Link>

      <p className="eyebrow">Something broke</p>
      <h1 className="display mt-4 text-text">Our end, not yours.</h1>
      <p className="lead mt-5 max-w-md">
        We hit an unexpected error and we&apos;ve been notified. Try again — and
        if it keeps happening, drop us a line.
      </p>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <button type="button" onClick={reset} className="btn btn-primary">
          <RotateCw className="h-4 w-4" aria-hidden />
          Try again
        </button>
        <Link href="/" className="btn btn-secondary">
          Back to the hub
        </Link>
      </div>

      {error.digest ? (
        <p className="mt-8 font-mono text-meta uppercase tracking-meta text-text-dim">
          Ref {error.digest}
        </p>
      ) : null}
    </main>
  );
}
