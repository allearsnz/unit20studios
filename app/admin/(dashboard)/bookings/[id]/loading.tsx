import {
  LoadingAnnouncement,
  SkeletonBlock,
  SkeletonCard,
} from "@/components/ui/Skeletons";

/**
 * Fallback for one booking. This is the click the owner reported as dead: the
 * page is force-dynamic, so there is nothing to prefetch and nothing rendered
 * until the server comes back. With this boundary the navigation happens
 * immediately and the wait is visible in the right place.
 *
 * The two-column shape matches the real page, so nothing jumps when it lands.
 */
export default function Loading() {
  return (
    <div className="p-5 md:p-10">
      <LoadingAnnouncement>Loading booking…</LoadingAnnouncement>
      <SkeletonBlock className="h-4 w-32" />

      <div className="mt-5 flex items-center gap-4">
        <SkeletonBlock className="h-8 w-40" />
        <SkeletonBlock className="h-6 w-24" />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-8">
          <SkeletonCard lines={2} />
          <SkeletonCard lines={1} />
          <SkeletonCard lines={6} />
          <SkeletonCard lines={2} />
        </div>
        <div className="space-y-8">
          <SkeletonCard lines={5} />
          <SkeletonCard lines={5} />
        </div>
      </div>
    </div>
  );
}
