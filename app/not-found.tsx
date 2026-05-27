import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-24 text-center">
      <Link href="/" className="mb-12 flex items-center gap-2.5" aria-label="Unit 20 — home">
        <span className="block h-2 w-2 bg-accent" aria-hidden />
        <span className="font-mono text-sm uppercase tracking-meta text-text">Unit 20</span>
      </Link>

      <p className="eyebrow">Error 404</p>
      <h1 className="display mt-4 text-text">Lost the signal.</h1>
      <p className="lead mt-5 max-w-md">
        That page isn&apos;t here. It might have moved, or never existed — either
        way, let&apos;s get you back to something that does.
      </p>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <Link href="/" className="btn btn-primary">
          Back to the hub
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
        <Link href="/studio" className="btn btn-secondary">
          The studio
        </Link>
        <Link href="/contact" className="btn btn-secondary">
          Contact
        </Link>
      </div>
    </main>
  );
}
