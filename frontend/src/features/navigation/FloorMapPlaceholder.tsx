"use client";

import { motion } from "framer-motion";
import { MapIcon } from "lucide-react";

import { useNavigationStore } from "@/store";

/**
 * Reserved slot for the future interactive floor map (per-floor SVG/canvas
 * plan overlay, driven by Node pos_x/pos_y). Intentionally not implemented
 * yet — no Three.js, no floor-plan rendering — this phase only wires the
 * data (route, current floor) that a real map would need.
 */
export function FloorMapPlaceholder() {
  const route = useNavigationStore((state) => state.route);
  const fromNodeLabel = useNavigationStore((state) => state.fromNodeLabel);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="relative flex h-full min-h-[18rem] flex-1 items-center justify-center overflow-hidden rounded-3xl bg-brand-gradient shadow-glow"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      <div className="relative flex flex-col items-center gap-3 px-6 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10">
          <MapIcon className="h-7 w-7 text-white" strokeWidth={1.5} />
        </span>
        <div>
          <p className="font-display text-lg font-semibold text-white">Interactive Floor Map</p>
          <p className="mt-1.5 max-w-xs text-sm text-white/60">
            {route
              ? `Route plotted across ${route.path_node_ids.length} nodes — visual rendering arrives in a future phase.`
              : fromNodeLabel
                ? `Currently at ${fromNodeLabel}. Floor-plan rendering is reserved for a future phase.`
                : "Floor-plan rendering is reserved for a future phase."}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
