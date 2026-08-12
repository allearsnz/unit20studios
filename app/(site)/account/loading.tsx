import { LoadingAnnouncement, SkeletonBlock } from "@/components/ui/Skeletons";

/**
 * The customer's own dashboard reads four tables plus a count, all from a
 * database on the far side of the Pacific. Same problem as the admin, same fix:
 * arrive instantly, fill in after.
 */
export default function Loading() {
  return (
    <div className="container-page pb-24 pt-32 md:pt-40">
      <LoadingAnnouncement>Loading your account…</LoadingAnnouncement>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <SkeletonBlock className="h-3 w-20" />
          <SkeletonBlock className="mt-3 h-10 w-64" />
          <SkeletonBlock className="mt-3 h-3 w-48" />
        </div>
        <SkeletonBlock className="h-10 w-28" />
      </div>

      <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        <SkeletonBlock className="h-40 w-full" />
        <SkeletonBlock className="h-40 w-full" />
        <SkeletonBlock className="h-40 w-full" />
      </div>

      <div className="mt-12 grid gap-10 md:grid-cols-2">
        <div className="space-y-3">
          <SkeletonBlock className="h-3 w-32" />
          <SkeletonBlock className="h-20 w-full" />
          <SkeletonBlock className="h-20 w-full" />
        </div>
        <div className="space-y-3">
          <SkeletonBlock className="h-3 w-32" />
          <SkeletonBlock className="h-20 w-full" />
        </div>
      </div>
    </div>
  );
}
