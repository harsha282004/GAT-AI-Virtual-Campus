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
      <h3 className="mb-4 flex items-center gap-2 font-display text-sm font-semibold text-ink">
        <Camera className="h-4 w-4 text-brand" />
        Available Panoramas
      </h3>

      {panoramas.length === 0 ? (
        <p className="text-sm text-muted">No panoramas have been captured for this building yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {panoramas.map((panorama) => (
            <div
              key={panorama.id}
              className="flex flex-col items-center gap-2 rounded-2xl border border-hairline bg-brand/5 p-4 text-center"
            >
              <Camera className="h-5 w-5 text-brand/40" />
              <span className="text-xs font-medium text-ink/70">
                {panorama.title ?? "Untitled location"}
              </span>
              {panorama.is_placeholder && (
                <span className="rounded-full bg-accent-gold/15 px-2 py-0.5 text-[10px] font-medium text-accent-gold">
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
