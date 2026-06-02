"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

/**
 * First-load intro: black screen, the logo sits there while a bright diagonal
 * light sweeps across it once, then the overlay lifts away. Once per session,
 * bypassed under reduced motion.
 *
 * Lifecycle (show + exit fade) uses Framer Motion. The sweep itself uses plain
 * CSS keyframes (.intro-sweep in globals.css) for maximum reliability — masked
 * to the logo shape via .intro-mask.
 */
export function IntroOverlay() {
  const reduce = useReducedMotion();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (reduce) return;
    try {
      if (sessionStorage.getItem("u20_intro")) return;
      sessionStorage.setItem("u20_intro", "1");
    } catch {
      /* storage blocked — just play it */
    }
    setShow(true);
    const t = setTimeout(() => setShow(false), 2000);
    return () => clearTimeout(t);
  }, [reduce]);

  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          key="intro"
          id="u20-intro"
          aria-hidden
          className="fixed inset-0 z-[200] flex items-center justify-center bg-[#0a0a0a]"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: [0.83, 0, 0.17, 1] }}
        >
          <div className="intro-mask">
            <div className="intro-base" />
            <div className="intro-sweep" />
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
