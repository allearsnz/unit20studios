"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

type DOEWithPermission = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

/**
 * Subtle background parallax from device orientation (mobile easter egg).
 * Writes clamped --gyro-x/--gyro-y (max ±12px) onto the hub container, which
 * the .hub-bg transform reads. iOS 13+ needs a tap to grant permission; every
 * other case degrades to nothing. Bypassed entirely under reduced motion.
 */
export function GyroParallax({
  containerRef,
}: {
  containerRef: React.RefObject<HTMLElement | null>;
}) {
  const reduce = useReducedMotion();
  const [needsPermission, setNeedsPermission] = useState(false);
  const [granted, setGranted] = useState(false);

  useEffect(() => {
    if (reduce || typeof window === "undefined") return;
    if (!window.matchMedia("(max-width: 768px)").matches) return;
    const DOE = (window as unknown as { DeviceOrientationEvent?: DOEWithPermission })
      .DeviceOrientationEvent;
    if (!DOE) return;
    if (typeof DOE.requestPermission === "function") setNeedsPermission(true);
    else setGranted(true);
  }, [reduce]);

  useEffect(() => {
    if (!granted) return;
    const el = containerRef.current;
    if (!el) return;
    const clamp = (n: number) => Math.max(-12, Math.min(12, n));
    const onOrient = (e: DeviceOrientationEvent) => {
      const x = clamp(((e.gamma ?? 0) / 45) * 12);
      const y = clamp((((e.beta ?? 45) - 45) / 45) * 12);
      el.style.setProperty("--gyro-x", `${x.toFixed(1)}px`);
      el.style.setProperty("--gyro-y", `${y.toFixed(1)}px`);
    };
    window.addEventListener("deviceorientation", onOrient);
    return () => window.removeEventListener("deviceorientation", onOrient);
  }, [granted, containerRef]);

  const request = async () => {
    const DOE = (window as unknown as { DeviceOrientationEvent?: DOEWithPermission })
      .DeviceOrientationEvent;
    try {
      const res = await DOE?.requestPermission?.();
      if (res === "granted") {
        setGranted(true);
        setNeedsPermission(false);
      } else {
        setNeedsPermission(false);
      }
    } catch {
      setNeedsPermission(false);
    }
  };

  if (reduce || !needsPermission || granted) return null;

  return (
    <button
      type="button"
      onClick={request}
      className="fixed bottom-5 left-4 z-40 border border-border-strong bg-bg-elev/80 px-3 py-2 font-mono text-meta uppercase tracking-meta text-text-muted backdrop-blur-sm md:hidden"
    >
      Tap to enable motion
    </button>
  );
}
