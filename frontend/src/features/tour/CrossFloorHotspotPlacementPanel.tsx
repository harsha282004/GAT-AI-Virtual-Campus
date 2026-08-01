"use client";

import { useMemo, useState } from "react";
import { Crosshair, Target, Trash2 } from "lucide-react";

import { cn } from "@/utils";
import type { CrossFloorHotspotDto, TourPanorama } from "@/types";

interface CrossFloorHotspotPlacementPanelProps {
  sceneId: string;
  allPanoramas: TourPanorama[];
  hotspots: CrossFloorHotspotDto[];
  placing: boolean;
  onTogglePlacing: () => void;
  pickedCoords: { yaw: number; pitch: number } | null;
  onClearPick: () => void;
  onSave: (targetSceneId: string, label: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

/**
 * Dev-only admin tool (Step 8/9 architecture): rather than guessing real
 * sightline coordinates, a human clicks on the panorama at the spot where
 * another floor is genuinely visible, picks the destination scene, and it
 * persists to the cross_floor_hotspots table via the existing API. The
 * live tour immediately reflects it — same engine rebuild-on-refetch path
 * the orientation calibration panel already established.
 */
export function CrossFloorHotspotPlacementPanel({
  sceneId,
  allPanoramas,
  hotspots,
  placing,
  onTogglePlacing,
  pickedCoords,
  onClearPick,
  onSave,
  onDelete,
}: CrossFloorHotspotPlacementPanelProps) {
  const [targetSceneId, setTargetSceneId] = useState("");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const floorGroups = useMemo(() => {
    const map = new Map<string, TourPanorama[]>();
    for (const scene of allPanoramas) {
      if (scene.id === sceneId) continue; // a hotspot can't target its own scene
      const list = map.get(scene.floor);
      if (list) list.push(scene);
      else map.set(scene.floor, [scene]);
    }
    return map;
  }, [allPanoramas, sceneId]);

  const sceneName = useMemo(() => {
    const byId = new Map(allPanoramas.map((p) => [p.id, p]));
    return (id: string) => byId.get(id)?.name ?? `Scene ${id}`;
  }, [allPanoramas]);

  const onThisScene = hotspots.filter((h) => String(h.source_node_id) === sceneId);

  async function handleSave() {
    if (!pickedCoords || !targetSceneId) return;
    setSaving(true);
    try {
      await onSave(targetSceneId, label);
      setTargetSceneId("");
      setLabel("");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    try {
      await onDelete(id);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="glass flex w-72 flex-col gap-2 rounded-2xl border-2 border-dashed border-sky-400/70 p-3 text-xs shadow-soft">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-semibold uppercase tracking-wide text-sky-600">
          <Target className="h-3.5 w-3.5" />
          Cross-Floor Hotspots
        </span>
        <button
          type="button"
          onClick={onTogglePlacing}
          className={cn(
            "flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
            placing ? "bg-sky-500 text-white" : "bg-white text-ink hover:bg-sky-500/10 dark:bg-[#0F172A]",
          )}
        >
          <Crosshair className="h-3 w-3" />
          {placing ? "Cancel" : "Place"}
        </button>
      </div>

      {placing && !pickedCoords && (
        <p className="rounded-lg bg-black/5 px-2 py-1.5 text-[11px] text-muted dark:bg-white/5">
          Click on the panorama where another floor is visible.
        </p>
      )}

      {pickedCoords && (
        <div className="space-y-2 rounded-lg bg-black/5 p-2 dark:bg-white/5">
          <p className="font-mono text-[11px] text-ink/70">
            yaw {pickedCoords.yaw.toFixed(1)}° · pitch {pickedCoords.pitch.toFixed(1)}°
          </p>
          <select
            value={targetSceneId}
            onChange={(event) => setTargetSceneId(event.target.value)}
            className="w-full rounded-lg border border-hairline bg-white px-2 py-1.5 text-xs dark:bg-[#0F172A]"
          >
            <option value="">Select destination scene…</option>
            {Array.from(floorGroups.entries()).map(([floor, scenes]) => (
              <optgroup key={floor} label={floor}>
                {scenes.map((scene) => (
                  <option key={scene.id} value={scene.id}>
                    {scene.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Label (optional)"
            className="w-full rounded-lg border border-hairline bg-white px-2 py-1.5 text-xs dark:bg-[#0F172A]"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={!targetSceneId || saving}
              className="flex-1 rounded-full bg-sky-500 px-3 py-1.5 font-medium text-white transition-colors hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={onClearPick}
              className="rounded-full bg-white px-3 py-1.5 text-ink dark:bg-[#0F172A]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {onThisScene.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] font-medium text-ink/70">On this scene ({onThisScene.length})</p>
          {onThisScene.map((hotspot) => (
            <div
              key={hotspot.id}
              className="flex items-center justify-between gap-2 rounded-lg bg-black/5 px-2 py-1.5 dark:bg-white/5"
            >
              <span className="truncate text-ink/80">
                {hotspot.label ?? `→ ${sceneName(String(hotspot.target_node_id))}`}
              </span>
              <button
                type="button"
                onClick={() => handleDelete(hotspot.id)}
                disabled={deletingId === hotspot.id}
                aria-label="Delete hotspot"
                className="shrink-0 text-red-500 transition-colors hover:text-red-600 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
