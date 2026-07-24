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
    >
      <Link
        href={`/campus/${building.id}`}
        className="group block overflow-hidden rounded-2xl border border-gat-navy/10 bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-gat-maroon/30 hover:shadow-lg dark:border-white/10 dark:bg-gat-navy-light"
      >
        {/* Building image placeholder — swap for a real photo later, no code change needed elsewhere */}
        <div className="flex aspect-[4/3] items-center justify-center bg-gat-navy/5 dark:bg-white/5">
          <div className="flex flex-col items-center gap-2 text-gat-navy/25 dark:text-white/25">
            <ImageIcon className="h-8 w-8" strokeWidth={1.5} />
            <span className="text-[11px] uppercase tracking-wide">Image placeholder</span>
          </div>
        </div>

        <div className="p-5">
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gat-navy/10 text-gat-navy transition-colors group-hover:bg-gat-maroon group-hover:text-white dark:bg-white/10 dark:text-white">
              <Building2 className="h-4 w-4" />
            </span>
            <p className="font-display font-semibold text-gat-navy dark:text-white">
              {building.name}
            </p>
          </div>

          {building.code && (
            <p className="mb-2 text-xs uppercase tracking-wide text-gat-navy/50 dark:text-white/50">
              {building.code}
            </p>
          )}

          <p className="mb-4 line-clamp-2 min-h-[2.5rem] text-sm text-gat-navy/60 dark:text-white/60">
            {building.description ?? "No description available yet."}
          </p>

          <p className="flex items-center gap-1.5 text-xs font-medium text-gat-maroon">
            <Layers className="h-3.5 w-3.5" />
            {floorCount} {floorCount === 1 ? "floor" : "floors"}
          </p>
        </div>
      </Link>
    </motion.div>
  );
}
