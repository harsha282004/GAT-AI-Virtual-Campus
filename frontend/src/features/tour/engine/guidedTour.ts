import type { PanoramaNode } from "./PanoramaNode";

/** Sprint 3 — the human-walking-tour step sequence, repeated at every node
 * (Step 2). Purely descriptive; useGuidedTour.ts is what actually drives a
 * timer/camera through these in order. */
export type GuidedTourPhase =
  | "pause"
  | "look-left"
  | "return-center-1"
  | "look-right"
  | "return-center-2"
  | "moving";

export const GUIDED_TOUR_PHASE_ORDER: readonly GuidedTourPhase[] = [
  "pause",
  "look-left",
  "return-center-1",
  "look-right",
  "return-center-2",
  "moving",
];

export type GuidedTourSpeed = "slow" | "normal" | "fast";

export type GuidedTourStatus = "idle" | "playing" | "paused" | "stopped" | "completed" | "error";

/** Step 4/6 — "approximately 35°-45°". */
export const LOOK_ANGLE_DEG = 40;

/** Base (normal-speed) duration in ms for each phase; scaled by SPEED_SCALE. */
export const PHASE_BASE_DURATION_MS: Record<GuidedTourPhase, number> = {
  pause: 900,
  "look-left": 900,
  "return-center-1": 800,
  "look-right": 900,
  "return-center-2": 800,
  // A brief "stepping forward" beat before the actual navigation fires —
  // the scene-to-scene fade transition itself is owned by PanoramaViewer's
  // existing veil (Sprint 1/2), not duplicated here.
  moving: 400,
};

export const SPEED_SCALE: Record<GuidedTourSpeed, number> = {
  slow: 1.6,
  normal: 1,
  fast: 0.55,
};

export function scaledDuration(phase: GuidedTourPhase, speed: GuidedTourSpeed): number {
  return Math.round(PHASE_BASE_DURATION_MS[phase] * SPEED_SCALE[speed]);
}

/** Step 17 guard — a node the guided tour can't safely stand on. */
export function isNodeUsable(node: PanoramaNode | null | undefined): node is PanoramaNode {
  return !!node && typeof node.imagePath === "string" && node.imagePath.length > 0;
}
