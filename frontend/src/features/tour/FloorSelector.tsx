"use client";

import { motion } from "framer-motion";

import { cn } from "@/utils";
import type { TourPanorama } from "@/types";

// Canonical walking order for the Main Building tour — floors not in this
// list (a future building) sort alphabetically after these.
const FLOOR_ORDER = ["Entrance", "Ground Floor", "First Floor", "Second Floor", "Third Floor"];

function floorSortIndex(floor: string): number {
  const index = FLOOR_ORDER.indexOf(floor);
  return index === -1 ? FLOOR_ORDER.length : index;
}

interface FloorSelectorProps {
  panoramas: TourPanorama[];
  currentFloor: string;
  onSelectFloor: (floor: string) => void;
}

export function FloorSelector({ panoramas, currentFloor, onSelectFloor }: FloorSelectorProps) {
  const floors = Array.from(new Set(panoramas.map((p) => p.floor))).sort((a, b) => {
    const diff = floorSortIndex(a) - floorSortIndex(b);
    return diff !== 0 ? diff : a.localeCompare(b);
  });

  if (floors.length <= 1) return null;

  return (
    <div className="glass flex flex-wrap items-center gap-1 rounded-full px-2 py-1.5 shadow-soft">
      {floors.map((floor) => {
        const active = floor === currentFloor;
        return (
          <button
            key={floor}
            type="button"
            onClick={() => onSelectFloor(floor)}
            className={cn(
              "relative rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
              active ? "text-white" : "text-ink/70 hover:text-ink",
            )}
          >
            {active && (
              <motion.span
                layoutId="floor-selector-active"
                className="absolute inset-0 rounded-full bg-brand"
                transition={{ type: "spring", duration: 0.4 }}
              />
            )}
            <span className="relative">{floor}</span>
          </button>
        );
      })}
    </div>
  );
}
