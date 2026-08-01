"use client";

import { useState } from "react";
import { AlertTriangle, Building2, Layers, MapPin, Sparkles, Video } from "lucide-react";

import { cn } from "@/utils";
import type { PanoramaEngine, PanoramaNode } from "@/features/tour/engine";
import { videoPortalButtonLabel } from "@/features/tour/engine";
import type { GuidedTourPhase, GuidedTourStatus } from "@/features/tour/engine";

const PHASE_LABEL: Record<GuidedTourPhase, string> = {
  pause: "Taking in the view…",
  "look-left": "Looking left…",
  "return-center-1": "Returning to center…",
  "look-right": "Looking right…",
  "return-center-2": "Returning to center…",
  moving: "Walking forward…",
};

interface GuidedTourPanelProps {
  currentNode: PanoramaNode;
  engine: PanoramaEngine;
  status: GuidedTourStatus;
  phase: GuidedTourPhase | null;
  errorMessage: string | null;
}

/**
 * Sprint 3 Steps 10-14 — Current Location, Tour Progress, and the AI Guide
 * panel. Every number here is read straight off the current PanoramaNode and
 * its own floor's PanoramaLinkedList (`sequenceIndex` / `list.size`) — O(1)
 * property reads, no array search and no backend call while the tour runs.
 */
export function GuidedTourPanel({ currentNode, engine, status, phase, errorMessage }: GuidedTourPanelProps) {
  const [videoNotice, setVideoNotice] = useState<string | null>(null);

  const floorList = engine.getFloor(currentNode.floor);
  const sceneNumber = currentNode.sequenceIndex ?? null;
  const totalInFloor = floorList?.size ?? null;
  const hasProgress = sceneNumber !== null && totalInFloor !== null && totalInFloor > 0;
  const remaining = hasProgress ? totalInFloor! - sceneNumber! : null;
  const percent = hasProgress ? Math.round((sceneNumber! / totalInFloor!) * 100) : null;

  const portal = currentNode.videoPortal;

  return (
    <div className="glass flex w-full flex-col gap-3 rounded-3xl p-4 shadow-soft lg:w-72">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand">
        <Sparkles className="h-3.5 w-3.5" />
        AI Guide
      </div>

      <div className="space-y-1 text-sm text-ink">
        <p className="flex items-center gap-1.5 font-medium">
          <Building2 className="h-3.5 w-3.5 text-brand/70" />
          {currentNode.building}
        </p>
        <p className="flex items-center gap-1.5 text-ink/80">
          <Layers className="h-3.5 w-3.5 text-brand/70" />
          {currentNode.floor}
        </p>
        {currentNode.room && (
          <p className="flex items-center gap-1.5 text-ink/80">
            <MapPin className="h-3.5 w-3.5 text-brand/70" />
            {currentNode.room}
          </p>
        )}
      </div>

      {hasProgress && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-muted">
            <span>
              Scene {sceneNumber} of {totalInFloor}
            </span>
            <span>{percent}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-brand/10">
            <div
              className="h-full rounded-full bg-brand transition-[width] duration-500 ease-out"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="text-[11px] text-muted">
            {remaining === 0 ? "Last scene on this floor" : `${remaining} scene${remaining === 1 ? "" : "s"} remaining`}
          </p>
        </div>
      )}

      {currentNode.aiDescription && (
        <p className="text-xs leading-relaxed text-ink/80">{currentNode.aiDescription}</p>
      )}

      {(status === "playing" || status === "paused") && phase && (
        <p className="text-[11px] font-medium text-brand">
          {status === "paused" ? "Paused" : PHASE_LABEL[phase]}
        </p>
      )}

      {status === "completed" && (
        <p className="text-[11px] font-medium text-brand">Guided tour complete.</p>
      )}

      {status === "error" && errorMessage && (
        <p className="flex items-start gap-1.5 text-[11px] font-medium text-red-500">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {errorMessage}
        </p>
      )}

      {/* Sprint 3 Step 13/14 — architecture only: renders solely from node
          data, never fetches or plays anything. Hidden whenever the node has
          no enabled videoPortal, per Step 9's "hide, never manually enable". */}
      {portal?.enabled && (
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => setVideoNotice("360° video playback arrives in a future sprint.")}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-medium text-ink shadow-soft transition-colors hover:bg-brand hover:text-white dark:bg-[#0F172A]",
            )}
          >
            <Video className="h-3.5 w-3.5" />
            {videoPortalButtonLabel(portal)}
          </button>
          {videoNotice && <p className="text-center text-[10px] text-muted">{videoNotice}</p>}
        </div>
      )}
    </div>
  );
}
