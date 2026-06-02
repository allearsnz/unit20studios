"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";

export type HubPanel = {
  index: string;
  title: string;
  href: string;
  kind: "studio" | "venue";
  tagline: string;
  cta: string;
  external?: boolean;
  image?: string;
  gradient: string;
};

export function Panel({
  panel,
  index,
  priority,
  onNavigate,
}: {
  panel: HubPanel;
  index: number;
  priority?: boolean;
  onNavigate?: () => void;
}) {
  const Icon = panel.external ? ArrowUpRight : ArrowRight;

  const inner = (
    <>
      <div className="max-w-md">
        <h2 className="hub-title text-text">{panel.title}</h2>
        <p className="mt-4 text-lg text-text-muted md:text-xl">{panel.tagline}</p>
        <span className="mt-8 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-meta text-accent">
          {panel.cta}
          <Icon
            className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
            aria-hidden
          />
        </span>
      </div>
    </>
  );

  const linkClass =
    "relative z-10 flex h-full w-full flex-col justify-end p-7 pb-10 md:p-12";

  return (
    <li
      data-panel
      data-index={index}
      className="hub-panel group relative flex h-[100dvh] min-w-0 shrink-0 snap-start snap-always flex-col overflow-hidden [&:not(:last-child)]:border-b md:h-full md:shrink md:snap-none md:[&:not(:last-child)]:border-b-0 md:[&:not(:last-child)]:border-r"
    >
      {/* backdrop — photo (scales/parallaxes via .hub-bg), gradient fallback */}
      <div className="hub-bg absolute inset-0 z-0">
        {panel.image ? (
          <Image
            src={panel.image}
            alt=""
            fill
            priority={priority}
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0" style={{ background: panel.gradient }} />
        )}
        {/* slight darken so the title + CTA always read */}
        <div className="absolute inset-0 bg-bg/35" />
      </div>

      {/* legibility wash over the lower third */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[3] h-2/3 bg-gradient-to-t from-bg via-bg/65 to-transparent" />

      {panel.external ? (
        <a href={panel.href} target="_blank" rel="noreferrer" className={linkClass}>
          {inner}
        </a>
      ) : (
        <Link
          href={panel.href}
          className={linkClass}
          onClick={
            onNavigate
              ? (e) => {
                  e.preventDefault();
                  onNavigate();
                }
              : undefined
          }
        >
          {inner}
        </Link>
      )}
    </li>
  );
}
