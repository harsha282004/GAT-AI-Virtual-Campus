"use client";

import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { Compass } from "lucide-react";

import type { PanoramaViewerHandle } from "./PanoramaViewer";

interface OrientationCalibrationPanelProps {
  sceneId: string;
  viewerRef: RefObject<PanoramaViewerHandle | null>;
  onSave: (yaw: number, pitch: number) => Promise<void>;
}

/**
 * Dev-only orientation calibration panel. Reads the live camera angle
 * straight off the existing PanoramaViewer handle (viewer.getCurrentView(),
 * the same API the minimap's heading needle already uses) and, on save,
 * permanently recalibrates this panorama's resting orientation — no reset,
 * no preview/testing mode, saving is the only action.
 *
 * The live yaw/pitch readout is written directly to the DOM every animation
 * frame rather than through React state — the same pattern PanoramaViewer's
 * heading badge and Minimap's needle already use, and for the same reason:
 * a 60/sec setState here would re-render this panel (and fight click
 * stability) for a number nobody needs React to react to.
 */
export function OrientationCalibrationPanel({
  sceneId,
  viewerRef,
  onSave,
}: OrientationCalibrationPanelProps) {
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedSceneId, setSavedSceneId] = useState<string | null>(null);
  const yawRef = useRef<HTMLSpanElement | null>(null);
  const pitchRef = useRef<HTMLSpanElement | null>(null);
  const liveViewRef = useRef<{ yaw: number; pitch: number } | null>(null);

  useEffect(() => {
    let frameId: number;
    function tick() {
      const view = viewerRef.current?.getCurrentView() ?? null;
      liveViewRef.current = view;
      if (view) {
        if (yawRef.current) yawRef.current.textContent = `${view.yaw.toFixed(2)}°`;
        if (pitchRef.current) pitchRef.current.textContent = `${view.pitch.toFixed(2)}°`;
        setReady((prev) => prev || true);
      }
      frameId = requestAnimationFrame(tick);
    }
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [viewerRef]);

  useEffect(() => {
    setSaveError(null);
    setSavedSceneId(null);
  }, [sceneId]);

  async function handleSave() {
    const view = liveViewRef.current;
    if (!view) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(view.yaw, view.pitch);
      setSavedSceneId(sceneId);
    } catch {
      setSaveError("Could not save this orientation. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="glass flex w-64 flex-col gap-2 rounded-2xl border-2 border-dashed border-amber-400/70 p-3 text-xs shadow-soft">
      <div className="flex items-center gap-1.5 font-semibold uppercase tracking-wide text-amber-600">
        <Compass className="h-3.5 w-3.5" />
        Orientation Calibration
      </div>
      <p className="text-[11px] text-muted">Scene ID: {sceneId}</p>
      <div className="flex items-center justify-between rounded-lg bg-black/5 px-2 py-1.5 dark:bg-white/5">
        <span className="text-ink/70">Current Yaw</span>
        <span ref={yawRef} className="font-mono font-medium text-ink">
          —
        </span>
      </div>
      <div className="flex items-center justify-between rounded-lg bg-black/5 px-2 py-1.5 dark:bg-white/5">
        <span className="text-ink/70">Current Pitch</span>
        <span ref={pitchRef} className="font-mono font-medium text-ink">
          —
        </span>
      </div>
      <button
        type="button"
        onClick={handleSave}
        disabled={!ready || saving}
        className="rounded-full bg-amber-500 px-3 py-2 text-center font-medium text-white transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save Current View"}
      </button>
      {savedSceneId === sceneId && !saving && (
        <p className="text-center text-[11px] font-medium text-emerald-600">
          Saved — this is now the permanent orientation.
        </p>
      )}
      {saveError && <p className="text-center text-[11px] font-medium text-red-500">{saveError}</p>}
    </div>
  );
}
