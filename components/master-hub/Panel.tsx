"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { CDJStage } from "@/components/three/CDJStage";

export type HubPanel = {
  index: string;
  title: string;
  href: string;
  kind: "studio" | "venue";
  tagline: string;
  cta: string;
  external?: boolean;
  gradient: string;
};

export function Panel({
  panel,
  index,
  active,
  onActivate,
  onDeactivate,
}: {
  panel: HubPanel;
  index: number;
  active: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
}) {
  const isStudio = panel.kind === "studio";
  const Icon = panel.external ? ArrowUpRight : ArrowRight;

  const inner = (
    <>
      <span className="font-mono text-meta tracking-meta text-text-muted">
        {panel.index}
      </span>

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
    "relative z-10 flex h-full w-full flex-col justify-between p-7 pb-10 md:p-12";

  return (
    <li
      data-panel
      data-index={index}
      className="hub-panel group relative flex h-[100dvh] min-w-0 shrink-0 snap-start snap-always flex-col overflow-hidden [&:not(:last-child)]:border-b md:h-full md:shrink md:snap-none md:[&:not(:last-child)]:border-b-0 md:[&:not(:last-child)]:border-r"
    >
      {/* gradient backdrop (placeholder for photography) */}
      <div className="hub-bg absolute inset-0 z-0" style={{ background: panel.gradient }} />

      {/* floating 3D CDJ — studio panel only */}
      {isStudio && (
        <CDJStage
          active={active}
          className="pointer-events-none absolute left-1/2 top-[42%] z-[2] aspect-square w-[92%] max-w-[680px] -translate-x-1/2 -translate-y-1/2"
        />
      )}

      {/* legibility wash over the lower third */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[3] h-2/3 bg-gradient-to-t from-bg via-bg/60 to-transparent" />

      {panel.external ? (
        <a
          href={panel.href}
          target="_blank"
          rel="noreferrer"
          onMouseEnter={onActivate}
          onMouseLeave={onDeactivate}
          onFocus={onActivate}
          onBlur={onDeactivate}
          className={linkClass}
        >
          {inner}
        </a>
      ) : (
        <Link
          href={panel.href}
          onMouseEnter={onActivate}
          onMouseLeave={onDeactivate}
          onFocus={onActivate}
          onBlur={onDeactivate}
          className={linkClass}
        >
          {inner}
        </Link>
      )}
    </li>
  );
}
