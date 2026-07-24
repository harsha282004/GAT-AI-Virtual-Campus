"use client";

import { motion } from "framer-motion";
import { Camera, DoorOpen } from "lucide-react";

import { Button } from "@/components/ui";

interface PanoramaCardProps {
  title: string;
  buildingName: string;
  floorName: string | null;
  roomName: string | null;
  isPlaceholder: boolean;
  onOpen: () => void;
  isActive: boolean;
  index: number;
}

export function PanoramaCard({
  title,
  buildingName,
  floorName,
  roomName,
  isPlaceholder,
  onOpen,
  isActive,
  index,
}: PanoramaCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow hover:shadow-md dark:bg-gat-navy-light ${
        isActive ? "border-gat-maroon" : "border-gat-navy/10 dark:border-white/10"
      }`}
    >
      <div className="flex aspect-video items-center justify-center bg-gat-navy/5 dark:bg-white/5">
        <div className="flex flex-col items-center gap-2 text-gat-navy/25 dark:text-white/25">
          <Camera className="h-8 w-8" strokeWidth={1.5} />
          <span className="text-[11px] uppercase tracking-wide">Thumbnail placeholder</span>
        </div>
      </div>

      <div className="p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="font-display text-sm font-semibold text-gat-navy dark:text-white">
            {title}
          </p>
          {isPlaceholder && (
            <span className="shrink-0 rounded-full bg-gat-gold/15 px-2 py-0.5 text-[10px] font-medium text-gat-gold-dark">
              Placeholder
            </span>
          )}
        </div>

        <div className="mb-4 space-y-1 text-xs text-gat-navy/60 dark:text-white/60">
          <p>Building: {buildingName}</p>
          <p>Floor: {floorName ?? "—"}</p>
          <p className="flex items-center gap-1">
            <DoorOpen className="h-3 w-3" /> Room: {roomName ?? "—"}
          </p>
        </div>

        <Button size="sm" variant="outline" fullWidth onClick={onOpen}>
          Open Viewer
        </Button>
      </div>
    </motion.div>
  );
}
