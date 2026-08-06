"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

/**
 * Mouse-driven 3D parallax tilt for a hero photo. Replaces what the 3D
 * CDJ scene used to do on the studio landing (tilt toward the cursor) so
 * the static photo still feels alive. Bypassed under reduced motion.
 *
 * - Tilts on pointer-move across the whole window (so it tracks while the
 *   user reads the headline on the left half too)
 * - Adds a faint accent glow that follows the cursor
 * - Lerps each frame for buttery motion
 *
 * Skipped entirely on coarse pointers: there is no cursor to follow on a phone,
 * so the loop was writing six unchanging custom properties every frame, forever,
 * on the homepage's LCP element — pure battery cost for no visible effect. It
 * also parks itself once the lerp converges and restarts on the next move,
 * rather than running for the lifetime of the page.
 */
export function ParallaxPhoto({
  src,
  alt,
  className,
  priority,
}: {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef({ x: 0, y: 0 });
  const currentRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // matchMedia rather than framer-motion's useReducedMotion: importing an
    // animation library for one boolean put it on every route's bundle.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    const wrap = wrapRef.current;
    if (!wrap) return;

    const start = () => {
      if (rafRef.current === null) rafRef.current = requestAnimationFrame(tick);
    };

    const onMove = (e: PointerEvent) => {
      const x = (e.clientX / window.innerWidth) * 2 - 1; // -1 .. 1
      const y = -((e.clientY / window.innerHeight) * 2 - 1);
      targetRef.current.x = x;
      targetRef.current.y = y;
      start();
    };

    // On `document`, not `window` — pointerleave on window fires unreliably and
    // left the tilt stuck off-axis when the cursor exited the viewport.
    const onLeave = () => {
      targetRef.current.x = 0;
      targetRef.current.y = 0;
      start();
    };

    const tick = () => {
      const t = targetRef.current;
      const c = currentRef.current;
      c.x += (t.x - c.x) * 0.06;
      c.y += (t.y - c.y) * 0.06;

      // Subtle: max ±6deg tilt, ±10px translate, glow position 0–100%
      const rotY = c.x * 6;
      const rotX = c.y * 6;
      const tx = c.x * 10;
      const ty = c.y * -10;
      const gx = ((c.x + 1) / 2) * 100;
      const gy = ((-c.y + 1) / 2) * 100;

      wrap.style.setProperty("--tilt-rot-x", `${rotX.toFixed(2)}deg`);
      wrap.style.setProperty("--tilt-rot-y", `${rotY.toFixed(2)}deg`);
      wrap.style.setProperty("--tilt-tx", `${tx.toFixed(2)}px`);
      wrap.style.setProperty("--tilt-ty", `${ty.toFixed(2)}px`);
      wrap.style.setProperty("--tilt-gx", `${gx.toFixed(1)}%`);
      wrap.style.setProperty("--tilt-gy", `${gy.toFixed(1)}%`);

      // Settled — park until the pointer moves again.
      if (Math.abs(t.x - c.x) < 0.001 && Math.abs(t.y - c.y) < 0.001) {
        rafRef.current = null;
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    start();

    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      className={className}
      style={{
        perspective: "1200px",
        // initial values so SSR + first paint are neutral
        ["--tilt-rot-x" as string]: "0deg",
        ["--tilt-rot-y" as string]: "0deg",
        ["--tilt-tx" as string]: "0px",
        ["--tilt-ty" as string]: "0px",
        ["--tilt-gx" as string]: "50%",
        ["--tilt-gy" as string]: "50%",
      }}
    >
      <div
        className="relative h-full w-full overflow-hidden will-change-transform"
        style={{
          transform:
            "rotateX(var(--tilt-rot-x)) rotateY(var(--tilt-rot-y)) translate3d(var(--tilt-tx), var(--tilt-ty), 0)",
          transformStyle: "preserve-3d",
          // The global prefers-reduced-motion rule neutralises this, so it
          // doesn't need a JS branch of its own.
          transition: "transform 80ms linear",
        }}
      >
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          sizes="(min-width: 768px) 45vw, 100vw"
          className="object-cover"
        />
        {/* cursor-follow accent glow */}
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden
          style={{
            background:
              "radial-gradient(40% 50% at var(--tilt-gx) var(--tilt-gy), rgba(61,220,151,0.18), transparent 65%)",
            mixBlendMode: "screen",
          }}
        />
        {/* legibility wash */}
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden
          style={{
            background:
              "linear-gradient(180deg, rgba(10,10,10,0.15) 0%, rgba(10,10,10,0.0) 30%, rgba(10,10,10,0.35) 100%)",
          }}
        />
      </div>
    </div>
  );
}
