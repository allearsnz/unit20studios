import {
  LoadingAnnouncement,
  SkeletonBlock,
  SkeletonCard,
} from "@/components/ui/Skeletons";

export default function Loading() {
  return (
    <div className="p-5 md:p-10">
      <LoadingAnnouncement>Loading customer…</LoadingAnnouncement>
      <SkeletonBlock className="h-4 w-32" />
      <div className="mt-5 flex items-center gap-4">
        <SkeletonBlock className="h-8 w-56" />
      </div>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-8">
          <SkeletonCard lines={5} />
          <SkeletonCard lines={6} />
        </div>
        <div className="space-y-8">
          <SkeletonCard lines={4} />
        </div>
      </div>
    </div>
  );
}
