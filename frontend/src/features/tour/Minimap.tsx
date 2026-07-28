"use client";

import { Compass, Navigation } from "lucide-react";
import { useEffect, useRef } from "react";

import { cn } from "@/utils";
import type { TourPanorama } from "@/types";

interface MinimapProps {
  panoramas: TourPanorama[];
  current: TourPanorama;
  visitedIds: ReadonlySet<string>;
  onSelect: (id: string) => void;
  /** Reads the live camera yaw straight from the panorama viewer, once per
   * animation frame — deliberately not a React prop value, so the heading
   * needle can rotate smoothly without re-rendering the whole minimap (or
   * the page) 60 times a second. */
  getLiveYaw: () => number | null;
}

/**
 * Schematic (not-to-scale) minimap of the current floor's walking sequence —
 * indoor nodes have no surveyed real-world coordinates yet, so scenes are
 * laid out evenly by sequenceIndex rather than true position. Swapping in
 * real coordinates later (Node.pos_x/pos_y) only requires changing the
 * layout math here, not this component's shape.
 */
export function Minimap({ panoramas, current, visitedIds, onSelect, getLiveYaw }: MinimapProps) {
  const needleRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let frameId: number;
    function tick() {
      const yaw = getLiveYaw();
      if (needleRef.current && yaw !== null) {
        needleRef.current.style.transform = `rotate(${yaw}deg)`;
      }
      frameId = requestAnimationFrame(tick);
    }
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [getLiveYaw]);

  const floorScenes = panoramas
    .filter((p) => p.floor === current.floor)
    .sort((a, b) => (a.sequenceIndex ?? 0) - (b.sequenceIndex ?? 0));

  const currentIndex = floorScenes.findIndex((p) => p.id === current.id);

  return (
    <div className="glass flex w-full flex-col gap-2 rounded-3xl p-4 shadow-soft lg:w-64">
      <div className="flex items-center justify-between gap-1.5 text-xs font-medium text-ink/70">
        <span className="flex items-center gap-1.5">
          <Compass className="h-3.5 w-3.5 text-brand/60" />
          {current.floor}
        </span>
        {/* Live heading needle — rotated directly via rAF above, not React state. */}
        <div
          ref={needleRef}
          aria-hidden="true"
          className="flex h-5 w-5 items-center justify-center rounded-full bg-brand/10"
          style={{ transition: "none" }}
        >
          <Navigation className="h-3 w-3 text-brand" strokeWidth={2.5} />
        </div>
      </div>

      {floorScenes.length > 1 ? (
        <div className="relative flex h-9 items-center">
          <div className="absolute inset-x-1 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-brand/15" />
          <div className="relative flex w-full items-center justify-between">
            {floorScenes.map((scene) => {
              const active = scene.id === current.id;
              const visited = visitedIds.has(scene.id);
              return (
                <button
                  key={scene.id}
                  type="button"
                  title={scene.name}
                  aria-current={active}
                  aria-label={`${scene.name}${visited ? " (visited)" : ""}`}
                  onClick={() => onSelect(scene.id)}
                  className={cn(
                    "relative flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                    active
                      ? "scale-125 border-brand bg-brand shadow-[0_0_0_4px_rgba(46,77,183,0.2)]"
                      : visited
                        ? "border-brand/60 bg-brand/30 hover:border-brand"
                        : "border-brand/30 bg-white hover:border-brand/70 dark:bg-[#0F172A]",
                  )}
                >
                  {active && (
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand/50" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-muted">Single scene on this floor.</p>
      )}

      {/* Hotspot direction ticks for the current scene — a compact ring
          around a center dot, each tick angled to its hotspot's yaw. */}
      {current.hotspots.length > 0 && (
        <div className="relative mx-auto my-1 h-16 w-16">
          <div className="absolute inset-0 rounded-full border border-brand/15" />
          <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand" />
          {current.hotspots.map((hotspot, index) => (
            <div
              key={`${hotspot.targetId}-${index}`}
              title={hotspot.label}
              className="absolute left-1/2 top-1/2 h-16 w-0.5 origin-top"
              style={{ transform: `translateX(-50%) rotate(${hotspot.yaw}deg)` }}
            >
              <span className="absolute -top-0.5 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-brand/70" />
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] text-muted">
        {currentIndex >= 0 ? `Step ${currentIndex + 1} of ${floorScenes.length}` : current.name}
      </p>
    </div>
  );
}
