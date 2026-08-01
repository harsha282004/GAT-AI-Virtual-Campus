"use client";

import { useEffect, useMemo, useState } from "react";
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
  /** Set when a marker in the authoring overlay (any scene) was clicked —
   * the ONLY way an edit starts; there is no browsing/list UI in this panel
   * anymore. Drives the edit form below regardless of which scene is open. */
  editingHotspotId: number | null;
  onCancelEdit: () => void;
  onUpdate: (id: number, targetSceneId: string, label: string) => Promise<void>;
}

/**
 * Dev-only admin tool, deliberately minimal: this panel only ever shows one
 * of four short states (idle instructions / placing prompt / new-hotspot
 * form / edit-hotspot form). There is no hotspot list here — creating is
 * "Place" + click the panorama; editing/deleting is "click the marker in
 * the panorama", handled via editingHotspotId being set from outside.
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
  editingHotspotId,
  onCancelEdit,
  onUpdate,
}: CrossFloorHotspotPlacementPanelProps) {
  const [targetSceneId, setTargetSceneId] = useState("");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const editing = useMemo(
    () => hotspots.find((h) => h.id === editingHotspotId) ?? null,
    [hotspots, editingHotspotId],
  );

  // Pre-fill the form whenever a different hotspot is selected for editing.
  useEffect(() => {
    if (!editing) return;
    setTargetSceneId(String(editing.target_node_id));
    setLabel(editing.label ?? "");
  }, [editing]);

  const floorGroups = useMemo(() => {
    const excludeId = editing ? String(editing.source_node_id) : sceneId;
    const map = new Map<string, TourPanorama[]>();
    for (const scene of allPanoramas) {
      if (scene.id === excludeId) continue; // a hotspot can't target its own source scene
      const list = map.get(scene.floor);
      if (list) list.push(scene);
      else map.set(scene.floor, [scene]);
    }
    return map;
  }, [allPanoramas, sceneId, editing]);

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

  async function handleUpdate() {
    if (!editing || !targetSceneId) return;
    setSaving(true);
    try {
      await onUpdate(editing.id, targetSceneId, label);
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
          disabled={!!editing}
          className={cn(
            "flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
            placing ? "bg-sky-500 text-white" : "bg-white text-ink hover:bg-sky-500/10 dark:bg-[#0F172A]",
          )}
        >
          <Crosshair className="h-3 w-3" />
          {placing ? "Cancel" : "Place"}
        </button>
      </div>

      {!editing && !placing && !pickedCoords && (
        <div className="space-y-1.5 text-[11px] leading-relaxed text-muted">
          <p>
            Click <span className="font-medium text-ink">Place</span> and then click
            anywhere inside the panorama to create a new cross-floor hotspot.
          </p>
          <p>Click any existing hotspot marker inside the panorama to edit or delete it.</p>
        </div>
      )}

      {editing && (
        <div className="space-y-2 rounded-lg bg-sky-500/10 p-2">
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
              onClick={handleUpdate}
              disabled={!targetSceneId || saving}
              className="flex-1 rounded-full bg-sky-500 px-3 py-1.5 font-medium text-white transition-colors hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
            <button
              type="button"
              onClick={() => handleDelete(editing.id)}
              disabled={deletingId === editing.id}
              aria-label="Delete hotspot"
              className="rounded-full bg-red-500/10 px-3 py-1.5 text-red-600 transition-colors hover:bg-red-500/20 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              className="rounded-full bg-white px-3 py-1.5 text-ink dark:bg-[#0F172A]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!editing && placing && !pickedCoords && (
        <p className="rounded-lg bg-black/5 px-2 py-1.5 text-[11px] text-muted dark:bg-white/5">
          Click on the panorama where another floor is visible.
        </p>
      )}

      {!editing && pickedCoords && (
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
    </div>
  );
}
