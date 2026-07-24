"use client";

import { motion } from "framer-motion";
import { Box, Move3d } from "lucide-react";

/**
 * Full-screen reserved container for the future Three.js 3D campus map.
 * No Three.js dependency or scene code is added yet — this is purely the
 * layout slot a <Canvas> (react-three-fiber) would later mount into.
 */
export function Map3DPlaceholder() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="relative flex h-[calc(100vh-7rem)] min-w-0 flex-1 items-center justify-center overflow-hidden rounded-3xl bg-brand-gradient shadow-glow"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />
      <motion.div
        animate={{ rotateY: [0, 360] }}
        transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
        className="pointer-events-none absolute"
        style={{ perspective: 800 }}
      >
        <Box className="h-24 w-24 text-white/5" strokeWidth={0.75} />
      </motion.div>

      <div className="relative flex flex-col items-center gap-4 px-6 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
          <Move3d className="h-8 w-8 text-white" strokeWidth={1.5} />
        </span>
        <div>
          <p className="font-display text-xl font-semibold text-white">3D Campus Map</p>
          <p className="mt-2 max-w-sm text-sm text-white/60">
            An interactive 3D model of the ~10-acre campus is coming in a future phase — this
            full-screen canvas is reserved for it.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
