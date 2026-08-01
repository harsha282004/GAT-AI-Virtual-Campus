"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import type { TourPanorama } from "@/types";

interface VisibleFromScenesSelectProps {
  allPanoramas: TourPanorama[];
  /** A hotspot appearing on its own destination scene ("go to X" while
   * already standing in X) doesn't make sense — excluded from the list. */
  excludeSceneId?: string;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

/** Floor-grouped, searchable checkbox list — the only way visibility is
 * ever set (see CrossFloorHotspotPlacementPanel). Deliberately a plain
 * scrollable list rather than a dropdown: the whole point is picking
 * several scenes at once out of what can be hundreds of panoramas. */
export function VisibleFromScenesSelect({
  allPanoramas,
  excludeSceneId,
  selectedIds,
  onChange,
}: VisibleFromScenesSelectProps) {
  const [query, setQuery] = useState("");

  const floorGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const map = new Map<string, TourPanorama[]>();
    for (const scene of allPanoramas) {
      if (scene.id === excludeSceneId) continue;
      if (q && !scene.name.toLowerCase().includes(q) && !scene.floor.toLowerCase().includes(q)) {
        continue;
      }
      const list = map.get(scene.floor);
      if (list) list.push(scene);
      else map.set(scene.floor, [scene]);
    }
    return map;
  }, [allPanoramas, excludeSceneId, query]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  function toggle(id: string) {
    onChange(
      selectedSet.has(id) ? selectedIds.filter((existing) => existing !== id) : [...selectedIds, id],
    );
  }

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium text-ink/70">
        Visible From ({selectedIds.length} scene{selectedIds.length === 1 ? "" : "s"})
      </p>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search scenes…"
          className="w-full rounded-lg border border-hairline bg-white py-1.5 pl-6 pr-2 text-xs dark:bg-[#0F172A]"
        />
      </div>
      <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-lg border border-hairline p-1.5">
        {floorGroups.size === 0 && (
          <p className="px-1 py-1 text-[11px] text-muted">No matching scenes.</p>
        )}
        {Array.from(floorGroups.entries()).map(([floor, scenes]) => (
          <div key={floor}>
            <p className="px-1 text-[10px] font-semibold uppercase tracking-wide text-muted">{floor}</p>
            {scenes.map((scene) => (
              <label
                key={scene.id}
                className="flex items-center gap-1.5 rounded-md px-1 py-1 text-[11px] text-ink/80 hover:bg-black/5 dark:hover:bg-white/5"
              >
                <input
                  type="checkbox"
                  checked={selectedSet.has(scene.id)}
                  onChange={() => toggle(scene.id)}
                  className="h-3 w-3 accent-sky-500"
                />
                <span className="truncate">{scene.name}</span>
              </label>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
