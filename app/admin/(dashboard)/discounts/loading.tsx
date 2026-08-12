import {
  LoadingAnnouncement,
  SkeletonBlock,
  SkeletonCard,
} from "@/components/ui/Skeletons";

export default function Loading() {
  return (
    <div className="p-5 md:p-10">
      <LoadingAnnouncement>Loading discount codes…</LoadingAnnouncement>
      <SkeletonBlock className="h-9 w-44" />
      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <SkeletonCard lines={5} />
        <SkeletonCard lines={7} />
      </div>
    </div>
  );
}
