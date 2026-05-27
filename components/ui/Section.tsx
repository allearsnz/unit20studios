import { cn } from "@/lib/utils";

type HeadingTag = "h1" | "h2" | "h3";

/** Eyebrow → serif headline → thin lead. The site-wide section header pattern. */
export function SectionHeading({
  eyebrow,
  title,
  lead,
  as = "h2",
  align = "left",
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  as?: HeadingTag;
  align?: "left" | "center";
  className?: string;
}) {
  const As = as;
  const titleClass = as === "h1" ? "h1" : as === "h3" ? "h3" : "h2";
  return (
    <div
      className={cn(
        "max-w-2xl",
        align === "center" && "mx-auto text-center",
        className,
      )}
    >
      {eyebrow ? <p className="eyebrow mb-4">{eyebrow}</p> : null}
      <As className={cn(titleClass, "text-text text-balance")}>{title}</As>
      {lead ? <p className="lead mt-5 text-pretty">{lead}</p> : null}
    </div>
  );
}

/** Consistent vertical rhythm wrapper (96px desktop / 64px mobile). */
export function Section({
  children,
  className,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("py-16 md:py-24", className)}>
      <div className="container-page">{children}</div>
    </section>
  );
}
