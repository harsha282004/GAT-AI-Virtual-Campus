"use client";

import { Compass } from "lucide-react";

import type { TourPanorama } from "@/types";

export function MinimapPlaceholder({ panorama }: { panorama: TourPanorama }) {
  return (
    <div className="glass flex h-40 w-full flex-col items-center justify-center gap-2 rounded-3xl p-4 text-center shadow-soft lg:w-56">
      <Compass className="h-6 w-6 text-brand/40" />
      <p className="text-xs font-medium text-ink/70">Minimap</p>
      <p className="text-[11px] text-muted">{panorama.building}</p>
      <p className="text-[10px] text-muted/70">Full 3D map coming in a future phase</p>
    </div>
  );
}
