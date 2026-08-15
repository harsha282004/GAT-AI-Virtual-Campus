"use client";

import { motion } from "framer-motion";
import { MapPin } from "lucide-react";

import type { TourPanorama } from "@/types";

export function TourTopBar({ panorama }: { panorama: TourPanorama }) {
  const crumbs = [panorama.building, panorama.floor, panorama.room].filter(
    (part): part is string => Boolean(part),
  );

  return (
    <motion.div
      key={panorama.id}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="glass inline-flex items-center gap-2.5 self-start rounded-full px-5 py-2.5 text-base font-medium text-ink shadow-soft"
    >
      <MapPin className="h-5 w-5 text-brand" />
      {crumbs.join(" · ")}
    </motion.div>
  );
}
