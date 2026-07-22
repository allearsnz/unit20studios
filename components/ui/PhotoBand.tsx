import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Full-bleed cinematic photo band with an optional statement over it.
 * Used to carry the high-res booth photography between content sections.
 */
export function PhotoBand({
  src,
  alt,
  eyebrow,
  title,
  priority,
  className,
  height = "h-[46vh] min-h-[300px] md:h-[62vh] md:min-h-[420px]",
}: {
  src: string;
  alt: string;
  eyebrow?: string;
  title?: React.ReactNode;
  priority?: boolean;
  className?: string;
  height?: string;
}) {
  return (
    <section
      className={cn(
        "relative overflow-hidden border-y border-border",
        height,
        className,
      )}
    >
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        sizes="100vw"
        className="object-cover"
      />
      {/* legibility wash — bottom-weighted so the copy always reads */}
      <div
        className="absolute inset-0 bg-gradient-to-t from-bg via-bg/45 to-bg/10"
        aria-hidden
      />
      {title ? (
        <div className="container-page relative flex h-full flex-col justify-end pb-10 md:pb-16">
          <div className="max-w-xl">
            {eyebrow ? <p className="eyebrow mb-3">{eyebrow}</p> : null}
            <p className="h2 text-text text-balance">{title}</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
