"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { StaticCDJFallback } from "./StaticCDJFallback";

/**
 * Orchestrates the CDJ visual. Renders the static SVG by default (SSR-safe),
 * then upgrades to the live 3D scene after mount — only when motion is allowed
 * and WebGL is available. The 3D module is code-split and never SSR'd.
 */
const CDJScene = dynamic(
  () => import("./CDJScene").then((m) => m.CDJScene),
  { ssr: false, loading: () => <StaticCDJFallback /> },
);

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return (
      typeof window !== "undefined" &&
      !!window.WebGLRenderingContext &&
      !!(canvas.getContext("webgl2") || canvas.getContext("webgl"))
    );
  } catch {
    return false;
  }
}

export function CDJStage({
  active = false,
  className,
}: {
  active?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(!reduce && hasWebGL());
  }, [reduce]);

  return (
    <div className={className} aria-hidden>
      {enabled ? <CDJScene active={active} /> : <StaticCDJFallback />}
    </div>
  );
}
