"use client";

import { Camera } from "lucide-react";

import { Card } from "@/components/ui";
import type { Panorama } from "@/types";

interface BuildingPanoramasProps {
  panoramas: Panorama[];
}

export function BuildingPanoramas({ panoramas }: BuildingPanoramasProps) {
  return (
    <Card>
      <h3 className="mb-4 flex items-center gap-2 font-display text-sm font-semibold text-gat-navy dark:text-white">
        <Camera className="h-4 w-4 text-gat-maroon" />
        Available Panoramas
      </h3>

      {panoramas.length === 0 ? (
        <p className="text-sm text-gat-navy/50 dark:text-white/50">
          No panoramas have been captured for this building yet.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {panoramas.map((panorama) => (
            <div
              key={panorama.id}
              className="flex flex-col items-center gap-2 rounded-xl border border-gat-navy/10 bg-gat-navy/5 p-4 text-center dark:border-white/10 dark:bg-white/5"
            >
              <Camera className="h-5 w-5 text-gat-navy/30 dark:text-white/30" />
              <span className="text-xs font-medium text-gat-navy/70 dark:text-white/70">
                {panorama.title ?? "Untitled location"}
              </span>
              {panorama.is_placeholder && (
                <span className="rounded-full bg-gat-gold/15 px-2 py-0.5 text-[10px] font-medium text-gat-gold-dark">
                  Placeholder
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
