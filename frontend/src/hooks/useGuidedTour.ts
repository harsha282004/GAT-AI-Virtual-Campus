"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

import type { PanoramaNode } from "@/features/tour/engine";
import {
  GUIDED_TOUR_PHASE_ORDER,
  LOOK_ANGLE_DEG,
  isNodeUsable,
  scaledDuration,
} from "@/features/tour/engine";
import type { GuidedTourPhase, GuidedTourSpeed, GuidedTourStatus } from "@/features/tour/engine";
import type { HotspotNavigationContext, PanoramaViewerHandle } from "@/features/tour";

interface UseGuidedTourOptions {
  /** The node to (re)seed a tour from when start()/restart() is called. Only
   * read at those two moments — once playing, the hook walks node.next
   * object references directly and never re-derives position from props,
   * arrays, or the backend (Sprint 3 Step 8/"never query backend"). */
  seedNode: PanoramaNode | undefined;
  viewerRef: RefObject<PanoramaViewerHandle | null>;
  /** Mirrors the walk into the page's own current-scene state, reusing the
   * exact same navigation path (and fade transition) Manual Tour already
   * uses — Guided Tour never bypasses it. */
  onAdvance: (targetId: string, context: HotspotNavigationContext) => void;
}

export interface UseGuidedTourResult {
  status: GuidedTourStatus;
  phase: GuidedTourPhase | null;
  speed: GuidedTourSpeed;
  errorMessage: string | null;
  start: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  restart: () => void;
  setSpeed: (speed: GuidedTourSpeed) => void;
}

function delay(ms: number, token: number, tokenRef: RefObject<number>): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    const id = setTimeout(resolve, ms);
    // Nothing else references `id` — a stale timer firing after cancellation
    // is harmless because every continuation re-checks tokenRef below.
    void id;
    void token;
    void tokenRef;
  });
}

/**
 * Sprint 3 Guided Tour Engine. A node-to-node walk driven entirely by
 * PanoramaNode.next object references (never array indexing, never a
 * backend call while running) — at each node: pause, look left, return
 * center, look right, return center, move forward (Steps 2-8).
 *
 * Pause/resume operate at phase granularity: pausing lets the in-flight
 * camera animation finish, then freezes before the next phase; resume
 * continues from exactly that phase. Stop cancels outright and leaves the
 * viewer wherever it is. Restart rewinds to the node start() was first
 * called on (Step 9).
 */
export function useGuidedTour({
  seedNode,
  viewerRef,
  onAdvance,
}: UseGuidedTourOptions): UseGuidedTourResult {
  const [status, setStatus] = useState<GuidedTourStatus>("idle");
  const [phase, setPhase] = useState<GuidedTourPhase | null>(null);
  const [speed, setSpeedState] = useState<GuidedTourSpeed>("normal");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const statusRef = useRef(status);
  statusRef.current = status;
  const speedRef = useRef(speed);
  speedRef.current = speed;

  const runTokenRef = useRef(0);
  const phaseIndexRef = useRef(0);
  const activeNodeRef = useRef<PanoramaNode | undefined>(seedNode);
  const startNodeRef = useRef<PanoramaNode | undefined>(undefined);
  // Step 17 — cycle guard: a DLL is expected to be a straight chain, but a
  // corrupt/hand-edited graph must never spin the tour forever.
  const visitedRef = useRef<Set<string>>(new Set());

  const runPhase = useCallback(
    async (node: PanoramaNode, currentPhase: GuidedTourPhase, token: number) => {
      const duration = scaledDuration(currentPhase, speedRef.current);
      const viewer = viewerRef.current;

      switch (currentPhase) {
        case "pause":
        case "moving":
          await delay(duration, token, runTokenRef);
          return;
        case "look-left":
          if (viewer) await viewer.rotateBy(-LOOK_ANGLE_DEG, duration);
          else await delay(duration, token, runTokenRef);
          return;
        case "look-right":
          if (viewer) await viewer.rotateBy(LOOK_ANGLE_DEG, duration);
          else await delay(duration, token, runTokenRef);
          return;
        case "return-center-1":
        case "return-center-2":
          if (viewer) await viewer.rotateTo(node.yaw, duration);
          else await delay(duration, token, runTokenRef);
          return;
      }
    },
    [viewerRef],
  );

  const runNodeSequence = useCallback(
    async (node: PanoramaNode, startPhaseIndex: number, token: number) => {
      for (let i = startPhaseIndex; i < GUIDED_TOUR_PHASE_ORDER.length; i++) {
        if (token !== runTokenRef.current) return; // stopped/restarted mid-flight
        if (statusRef.current === "paused") {
          phaseIndexRef.current = i;
          return;
        }
        const currentPhase = GUIDED_TOUR_PHASE_ORDER[i];
        setPhase(currentPhase);
        await runPhase(node, currentPhase, token);
        if (token !== runTokenRef.current) return;
      }

      if (statusRef.current === "paused") {
        phaseIndexRef.current = GUIDED_TOUR_PHASE_ORDER.length;
        return;
      }

      const next = node.next?.node;
      if (!next) {
        setStatus("completed");
        setPhase(null);
        return;
      }
      if (!isNodeUsable(next)) {
        setErrorMessage("The next scene is missing its panorama image — guided tour stopped.");
        setStatus("error");
        setPhase(null);
        return;
      }
      if (visitedRef.current.has(next.sceneId)) {
        setErrorMessage("A repeated scene was detected in this floor's chain — guided tour stopped.");
        setStatus("error");
        setPhase(null);
        return;
      }

      visitedRef.current.add(next.sceneId);
      activeNodeRef.current = next;
      phaseIndexRef.current = 0;
      onAdvance(next.sceneId, {
        yaw: node.next?.entryYaw ?? undefined,
        pitch: node.next?.entryPitch ?? undefined,
      });
      void runNodeSequence(next, 0, token);
    },
    [onAdvance, runPhase],
  );

  const start = useCallback(() => {
    if (!isNodeUsable(seedNode)) {
      setErrorMessage("This scene can't start a guided tour — no panorama is loaded.");
      statusRef.current = "error";
      setStatus("error");
      return;
    }
    setErrorMessage(null);
    runTokenRef.current += 1;
    const token = runTokenRef.current;
    startNodeRef.current = seedNode;
    activeNodeRef.current = seedNode;
    visitedRef.current = new Set([seedNode.sceneId]);
    phaseIndexRef.current = 0;
    // statusRef must be updated synchronously here, not just via the
    // `statusRef.current = status` mirror at the top of the hook body —
    // runNodeSequence below runs synchronously up to its first `await`
    // (JS async-function semantics), which happens before React has had a
    // chance to re-render and update the ref from the setStatus() call.
    // Without this, its very first loop check would still read the old
    // status and could bail out immediately (this was exactly Resume's bug:
    // see resume() below).
    statusRef.current = "playing";
    setStatus("playing");
    void runNodeSequence(seedNode, 0, token);
  }, [seedNode, runNodeSequence]);

  const pause = useCallback(() => {
    if (statusRef.current !== "playing") return;
    statusRef.current = "paused";
    setStatus("paused");
  }, []);

  const resume = useCallback(() => {
    if (statusRef.current !== "paused" || !activeNodeRef.current) return;
    const token = runTokenRef.current;
    // Must be set synchronously (see start()'s comment) — otherwise
    // runNodeSequence's first iteration, which runs synchronously inside
    // this same call, would still read statusRef.current as "paused" and
    // immediately re-freeze at the same phaseIndex without ever resuming.
    statusRef.current = "playing";
    setStatus("playing");
    void runNodeSequence(activeNodeRef.current, phaseIndexRef.current, token);
  }, [runNodeSequence]);

  const stop = useCallback(() => {
    runTokenRef.current += 1;
    phaseIndexRef.current = 0;
    statusRef.current = "stopped";
    setStatus("stopped");
    setPhase(null);
  }, []);

  const restart = useCallback(() => {
    const node = startNodeRef.current;
    if (!isNodeUsable(node)) return;
    runTokenRef.current += 1;
    const token = runTokenRef.current;
    activeNodeRef.current = node;
    visitedRef.current = new Set([node.sceneId]);
    phaseIndexRef.current = 0;
    setErrorMessage(null);
    onAdvance(node.sceneId, {});
    statusRef.current = "playing";
    setStatus("playing");
    void runNodeSequence(node, 0, token);
  }, [onAdvance, runNodeSequence]);

  const setSpeed = useCallback((next: GuidedTourSpeed) => {
    speedRef.current = next;
    setSpeedState(next);
  }, []);

  // Step 16/17 — unmounting (leaving /tour, or the parent tearing this down
  // on a mode switch) must not leave a dangling timer chain running.
  useEffect(() => {
    return () => {
      runTokenRef.current += 1;
    };
  }, []);

  return { status, phase, speed, errorMessage, start, pause, resume, stop, restart, setSpeed };
}
