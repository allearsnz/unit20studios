"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { useInView } from "framer-motion";
import { CDJModel } from "./CDJModel";

/**
 * R3F canvas hosting the CDJ. Transparent background so it floats over the
 * panel. Renders only while in view, caps DPR on mobile, and drops DPR if the
 * frame rate declines. Reduced-motion / no-WebGL bypass happens in CDJStage.
 */
export function CDJScene({ active = false }: { active?: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const inView = useInView(wrapRef, { margin: "200px 0px" });
  const [dpr, setDpr] = useState(1.5);

  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 768px)").matches;
    setDpr(mobile ? 1 : 1.5);
  }, []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  return (
    <div ref={wrapRef} className="h-full w-full">
      <Canvas
        frameloop={inView ? "always" : "never"}
        dpr={dpr}
        camera={{ position: [0, 1.7, 4.2], fov: 32 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <PerformanceMonitor onDecline={() => setDpr(1)} />

        <ambientLight intensity={0.35} color="#fff1e0" />
        <hemisphereLight args={["#bfd9ff", "#0a0a0a", 0.25]} />
        {/* rim light, upper-left, accent */}
        <directionalLight position={[-4, 5, 3]} intensity={1.4} color="#3ddc97" />
        {/* key light, above-right, warm white */}
        <directionalLight position={[5, 6, 4]} intensity={0.9} color="#fff1e0" />
        <pointLight position={[0, 2, 3]} intensity={0.3} color="#3ddc97" />

        <Suspense fallback={null}>
          <CDJModel active={active} pointer={pointer} />
        </Suspense>
      </Canvas>
    </div>
  );
}
