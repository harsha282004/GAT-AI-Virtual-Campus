"use client";

import { motion } from "framer-motion";
import { Camera, MapPin } from "lucide-react";
import Image from "next/image";

import type { CampusFacility } from "../data/campusFacilities";

/**
 * Visual-only facility card: image, 360° badge (when a real captured scene
 * maps to it), floor overlay, and the name. No description paragraph and no
 * detail modal — the underlying facility data (description, panoramaFile,
 * askAi) is kept in campusFacilities.ts for other uses.
 */
export function FacilityCard({
  facility,
  hasScene,
  index,
}: {
  facility: CampusFacility;
  hasScene: boolean;
  index: number;
}) {
  return (
    <motion.figure
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45, delay: (index % 3) * 0.06 }}
      className="group flex flex-col overflow-hidden rounded-3xl border border-hairline bg-white shadow-soft transition-all hover:-translate-y-1 hover:shadow-glow dark:bg-[#0F172A]"
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        <Image
          src={facility.image}
          alt={facility.name}
          fill
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-transparent" />
        {hasScene && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-brand backdrop-blur-sm">
            <Camera className="h-3 w-3" />
            360°
          </span>
        )}
        {facility.floor && (
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 text-xs font-medium text-white/90">
            <MapPin className="h-3.5 w-3.5" />
            {facility.floor}
          </span>
        )}
      </div>
      <figcaption className="p-5">
        <h3 className="font-display text-base font-semibold text-ink">{facility.name}</h3>
      </figcaption>
    </motion.figure>
  );
}
