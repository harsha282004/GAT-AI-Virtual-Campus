"use client";

import { Building2, Layers } from "lucide-react";
import { useMemo } from "react";

import { useTranslation } from "@/hooks";
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
  const { t } = useTranslation();
  const tree = useMemo(() => groupByBuilding(panoramas), [panoramas]);

  return (
    <aside className="flex h-full w-full flex-col overflow-y-auto rounded-3xl border border-hairline bg-white p-6 shadow-soft dark:bg-[#0F172A] dark:shadow-black/30 lg:w-80">
      <h2 className="mb-5 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
        <Building2 className="h-4 w-4" />
        {t("Buildings")}
      </h2>

      <div className="space-y-5">
        {Array.from(tree.entries()).map(([building, floors]) => (
          <div key={building}>
            <div className="truncate rounded-xl bg-brand/10 px-4 py-3 text-base font-semibold text-brand">
              {t(building)}
            </div>

            <div className="mt-2 space-y-1 pl-3">
              {floors.map((floor) => {
                const active = floor === currentFloor;
                return (
                  <button
                    key={floor}
                    type="button"
                    onClick={() => onSelectFloor(floor)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-left text-sm font-medium transition-colors",
                      active ? "bg-brand text-white" : "text-ink/70 hover:bg-brand/5",
                    )}
                  >
                    <Layers className="h-4 w-4 shrink-0" />
                    <span className="truncate">{t(floor)}</span>
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
