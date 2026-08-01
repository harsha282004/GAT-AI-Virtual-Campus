"use client";

import { Building2, Layers } from "lucide-react";
import { useMemo } from "react";

import { cn } from "@/utils";
import type { TourPanorama } from "@/types";

// Canonical walking order for the Main Building tour — floors not in this
// list (a future building) sort alphabetically after these. Mirrors
// FloorSelector's ordering so the sidebar and the in-viewer floor tabs
// never disagree.
const FLOOR_ORDER = [
  "Entrance",
  "Ground Floor",
  "First Floor",
  "Second Floor",
  "Third Floor",
  "Central Quadrangle",
];

function floorSortIndex(floor: string): number {
  const index = FLOOR_ORDER.indexOf(floor);
  return index === -1 ? FLOOR_ORDER.length : index;
}

interface TourSidebarProps {
  panoramas: TourPanorama[];
  currentFloor: string;
  onSelectFloor: (floor: string) => void;
}

/**
 * Building > Floor navigation only. Scene-level entries were removed by
 * design — floors already jump to their first scene (see FloorSelector /
 * goToFloor), and a flat 20+ item Scene01..SceneN list per floor added
 * clutter without adding any navigation the floor tabs don't already give.
 * Nothing here expands/collapses; the whole tree is always visible.
 */
function groupByBuilding(panoramas: TourPanorama[]): Map<string, string[]> {
  const tree = new Map<string, string[]>();
  for (const panorama of panoramas) {
    const floors = tree.get(panorama.building) ?? [];
    if (!floors.includes(panorama.floor)) floors.push(panorama.floor);
    tree.set(panorama.building, floors);
  }
  for (const floors of tree.values()) {
    floors.sort((a, b) => {
      const diff = floorSortIndex(a) - floorSortIndex(b);
      return diff !== 0 ? diff : a.localeCompare(b);
    });
  }
  return tree;
}

export function TourSidebar({ panoramas, currentFloor, onSelectFloor }: TourSidebarProps) {
  const tree = useMemo(() => groupByBuilding(panoramas), [panoramas]);

  return (
    <aside className="flex h-full w-full flex-col overflow-y-auto rounded-3xl border border-hairline bg-white p-5 shadow-soft dark:bg-[#0F172A] dark:shadow-black/30 lg:w-72">
      <h2 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
        <Building2 className="h-3.5 w-3.5" />
        Buildings
      </h2>

      <div className="space-y-4">
        {Array.from(tree.entries()).map(([building, floors]) => (
          <div key={building}>
            <div className="rounded-xl bg-brand/10 px-3 py-2.5 text-sm font-medium text-brand">
              {building}
            </div>

            <div className="mt-1.5 space-y-0.5 pl-3">
              {floors.map((floor) => {
                const active = floor === currentFloor;
                return (
                  <button
                    key={floor}
                    type="button"
                    onClick={() => onSelectFloor(floor)}
                    className={cn(
                      "flex w-full items-center gap-1.5 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors",
                      active ? "bg-brand text-white" : "text-ink/70 hover:bg-brand/5",
                    )}
                  >
                    <Layers className="h-3.5 w-3.5 shrink-0" />
                    {floor}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
