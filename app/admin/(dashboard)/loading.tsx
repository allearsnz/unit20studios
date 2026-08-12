import {
  LoadingAnnouncement,
  SkeletonBlock,
  SkeletonHeading,
  SkeletonTable,
} from "@/components/ui/Skeletons";

/**
 * Fallback for the bookings list — and the default for any admin route that
 * doesn't ship its own. Switching tabs (Today / Upcoming / Past / All) re-runs
 * the query, so this is what a tab click looks like now instead of nothing.
 */
export default function Loading() {
  return (
    <div className="p-5 md:p-10">
      <LoadingAnnouncement>Loading bookings…</LoadingAnnouncement>
      <SkeletonHeading />
      <div className="mt-8 flex gap-1 border-b border-border">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonBlock key={i} className="mb-2 h-4 w-16" />
        ))}
      </div>
      <SkeletonTable rows={8} />
    </div>
  );
}
