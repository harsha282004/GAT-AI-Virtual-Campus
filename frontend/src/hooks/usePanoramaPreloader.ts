import { useEffect } from "react";

import type { TourPanorama } from "@/types";

/**
 * Warms the browser's image cache for the current scene's hotspot targets
 * (which, for a sequential walkthrough, are exactly its forward/back/branch
 * neighbors) so stepping to them feels instant instead of showing a spinner.
 * Pure side effect — nothing to render or return.
 */
export function usePanoramaPreloader(panoramas: TourPanorama[], currentId: string): void {
  useEffect(() => {
    const current = panoramas.find((p) => p.id === currentId);
    if (!current) return;

    const neighborIds = new Set(current.hotspots.map((h) => h.targetId));
    const images = panoramas
      .filter((p) => neighborIds.has(p.id))
      .map((p) => {
        const img = new Image();
        img.src = p.image;
        return img;
      });

    return () => {
      for (const img of images) img.src = "";
    };
  }, [panoramas, currentId]);
}
