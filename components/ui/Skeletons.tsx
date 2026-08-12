import { cn } from "@/lib/utils";

/**
 * The shapes that stand in for a page while it loads.
 *
 * These exist because the admin had no `loading.tsx` at all: clicking a booking
 * did nothing visible until the whole server render came back from a database in
 * Tokyo, so the honest experience was a dead click followed, seconds later, by a
 * different page. A route-level fallback makes the navigation instant and moves
 * the wait somewhere it can be seen.
 *
 * They deliberately mirror the real layout — same columns, same card rhythm — so
 * the page settles into place rather than jumping.
 */

export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden />;
}

/** A card outline with a heading and a few lines inside it. */
export function SkeletonCard({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <section className={cn("card p-6", className)}>
      <SkeletonBlock className="h-3 w-24" />
      <div className="mt-5 space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <SkeletonBlock
            key={i}
            className={cn("h-4", i === lines - 1 ? "w-2/3" : "w-full")}
          />
        ))}
      </div>
    </section>
  );
}

/** Table rows, for the list views. */
export function SkeletonTable({ rows = 8 }: { rows?: number }) {
  return (
    <div className="mt-6 space-y-px">
      <SkeletonBlock className="h-9 w-full" />
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonBlock
          key={i}
          className="h-12 w-full"
          // Fade down the list so the eye lands at the top, where content
          // actually arrives first.
        />
      ))}
    </div>
  );
}

/** The page heading every admin route opens with. */
export function SkeletonHeading() {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <SkeletonBlock className="h-9 w-48" />
      <div className="flex gap-2">
        <SkeletonBlock className="h-10 w-36" />
        <SkeletonBlock className="h-10 w-32" />
      </div>
    </div>
  );
}

/**
 * Screen-reader announcement. The skeleton is `aria-hidden`, so without this a
 * screen reader gets silence during the wait and then a page that changed under
 * it.
 */
export function LoadingAnnouncement({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" aria-live="polite" className="sr-only">
      {children}
    </p>
  );
}
