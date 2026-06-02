"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Panel, type HubPanel } from "./Panel";
import { GyroParallax } from "./GyroParallax";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

const PANELS: HubPanel[] = [
  {
    index: "01",
    title: "Studio / Hire",
    href: "/studio",
    kind: "studio",
    tagline: "Book the booth, or hire the gear.",
    cta: "Enter",
    image: "/studio.png",
    gradient:
      "radial-gradient(120% 120% at 18% 92%, rgba(61,220,151,0.18), transparent 55%), linear-gradient(180deg, #0d0d0d 0%, #0a0a0a 100%)",
  },
  {
    index: "02",
    title: "Venue / Events",
    href: site.venueUrl,
    kind: "venue",
    external: true,
    tagline: "Nights, launches & shows.",
    cta: "Enter (unit20.nz existing site)",
    image: "/venue.jpeg",
    gradient:
      "radial-gradient(100% 100% at 78% 100%, rgba(229,72,77,0.15), transparent 55%), linear-gradient(180deg, #130d0f 0%, #0a0a0a 100%)",
  },
];

export function Hub() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const containerRef = useRef<HTMLUListElement>(null);
  const [section, setSection] = useState(0);
  const [diving, setDiving] = useState(false);

  // "Dive in" transition for the internal Studio panel — fade to black, then go.
  const dive = (href: string) => {
    if (reduce) {
      router.push(href);
      return;
    }
    setDiving(true);
    setTimeout(() => router.push(href), 480);
  };

  // Track which panel is in view on mobile (for the indicator dots)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const panels = Array.from(el.querySelectorAll<HTMLElement>("[data-panel]"));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setSection(Number(e.target.getAttribute("data-index")));
        }
      },
      { root: el, threshold: 0.5 },
    );
    panels.forEach((p) => io.observe(p));
    return () => io.disconnect();
  }, []);

  const scrollToSection = (i: number) => {
    containerRef.current
      ?.querySelector<HTMLElement>(`[data-index="${i}"]`)
      ?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="relative">
      <ul
        ref={containerRef}
        className="hub no-scrollbar flex h-[100dvh] snap-y snap-mandatory flex-col overflow-y-scroll md:snap-none md:flex-row md:overflow-hidden"
      >
        {PANELS.map((panel, i) => (
          <Panel
            key={panel.index}
            panel={panel}
            index={i}
            priority={i === 0}
            onNavigate={panel.external ? undefined : () => dive(panel.href)}
          />
        ))}
      </ul>

      {/* mobile section indicators */}
      <div className="fixed right-4 top-1/2 z-40 flex -translate-y-1/2 flex-col gap-3 md:hidden">
        {PANELS.map((p, i) => (
          <button
            key={p.index}
            type="button"
            onClick={() => scrollToSection(i)}
            aria-label={`Go to ${p.title}`}
            aria-current={section === i ? "true" : undefined}
            className={cn(
              "h-2.5 w-2.5 rounded-full border transition-colors duration-300",
              section === i ? "border-accent bg-accent" : "border-border-strong bg-transparent",
            )}
          />
        ))}
      </div>

      <GyroParallax containerRef={containerRef} />

      {/* dive-to-black transition into /studio */}
      <AnimatePresence>
        {diving ? (
          <motion.div
            key="dive"
            aria-hidden
            className="fixed inset-0 z-[150] flex items-center justify-center bg-bg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.45, ease: [0.83, 0, 0.17, 1] }}
          >
            <motion.img
              src="/unit20-logo.png"
              alt=""
              className="h-auto w-[150px] md:w-[190px]"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.08 }}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
