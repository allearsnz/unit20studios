"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * Per-navigation entrance. Re-mounts on every route change, so each page fades
 * in. Opacity-only on purpose — a transform here would create a containing
 * block and break the site's `position: fixed` header/overlays.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  if (reduce) return <>{children}</>;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
