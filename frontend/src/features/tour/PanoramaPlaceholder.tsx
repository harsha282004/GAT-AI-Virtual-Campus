"use client";

import { motion } from "framer-motion";
import { Camera } from "lucide-react";

import { useTourStore } from "@/store";

/**
 * Full-width reserved container for the future Pannellum 360° viewer.
 * Structured so integrating Pannellum later means mounting it here and
 * feeding it `currentNodeId` from tourStore — no page restructuring needed.
 */
export function PanoramaPlaceholder() {
  const currentLocationName = useTourStore((state) => state.currentLocationName);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-3xl bg-gat-hero"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      <div className="relative flex flex-col items-center gap-4 px-6 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
          <Camera className="h-8 w-8 text-gat-gold" strokeWidth={1.5} />
        </span>
        <div>
          <p className="font-display text-xl font-semibold text-white">
            Future Panorama Viewer
          </p>
          <p className="mt-2 max-w-sm text-sm text-white/60">
            {currentLocationName
              ? `Selected: ${currentLocationName} — its 360° panorama will render here once Pannellum is integrated.`
              : "Pick a location below to reserve it as your starting panorama."}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
