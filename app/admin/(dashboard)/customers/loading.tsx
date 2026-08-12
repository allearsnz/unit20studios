import {
  LoadingAnnouncement,
  SkeletonBlock,
  SkeletonTable,
} from "@/components/ui/Skeletons";

export default function Loading() {
  return (
    <div className="p-5 md:p-10">
      <LoadingAnnouncement>Loading customers…</LoadingAnnouncement>
      <SkeletonBlock className="h-9 w-44" />
      <SkeletonTable rows={10} />
    </div>
  );
}
