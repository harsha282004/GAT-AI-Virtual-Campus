"use client";

import { motion } from "framer-motion";
import { Building2, ImageIcon, Layers } from "lucide-react";
import Link from "next/link";

interface BuildingCardProps {
  building: {
    id: number;
    name: string;
    code: string | null;
    description: string | null;
  };
  floorCount: number;
  index: number;
}

export function BuildingCard({ building, floorCount, index }: BuildingCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      whileHover={{ y: -6 }}
    >
      <Link
        href={`/campus/${building.id}`}
        className="group block overflow-hidden rounded-3xl border border-hairline bg-white shadow-soft transition-shadow duration-300 hover:shadow-glow"
      >
        {/* Building image placeholder — swap for a real photo later, no code change needed elsewhere */}
        <div className="flex aspect-[4/3] items-center justify-center bg-brand/5">
          <div className="flex flex-col items-center gap-2 text-brand/30">
            <ImageIcon className="h-8 w-8" strokeWidth={1.5} />
            <span className="text-[11px] uppercase tracking-wide">Image placeholder</span>
          </div>
        </div>

        <div className="p-6">
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand transition-colors group-hover:bg-brand group-hover:text-white">
              <Building2 className="h-4 w-4" />
            </span>
            <p className="font-display font-semibold text-ink">{building.name}</p>
          </div>

          {building.code && (
            <p className="mb-2 text-xs uppercase tracking-wide text-muted">{building.code}</p>
          )}

          <p className="mb-4 line-clamp-2 min-h-[2.5rem] text-sm text-muted">
            {building.description ?? "No description available yet."}
          </p>

          <p className="flex items-center gap-1.5 text-xs font-semibold text-brand">
            <Layers className="h-3.5 w-3.5" />
            {floorCount} {floorCount === 1 ? "floor" : "floors"}
          </p>
        </div>
      </Link>
    </motion.div>
  );
}
