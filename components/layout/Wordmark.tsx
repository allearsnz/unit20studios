import Image from "next/image";
import { cn } from "@/lib/utils";

/** The Unit 20 wordmark logo. Default display width 104px; pass className to resize. */
export function Wordmark({
  className,
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/unit20-logo.png"
      alt="Unit 20"
      width={208}
      height={46}
      priority={priority}
      className={cn("h-auto w-[104px]", className)}
    />
  );
}
