"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ErrorState, PageContainer, Spinner } from "@/components/ui";
import { cn } from "@/utils";
import {
  CrossFloorHotspotPlacementPanel,
  GuidedTourControls,
  GuidedTourPanel,
  ImmersiveToggle,
  Minimap,
  OrientationCalibrationPanel,
  PanoramaViewer,
  TourControls,
  TourModeToggle,
  TourSidebar,
  TourTopBar,
} from "@/features/tour";
import type { HotspotNavigationContext, PanoramaViewerHandle, TourMode } from "@/features/tour";
import { crossFloorHotspotsApi, panoramasApi } from "@/api";
import {
  GUIDED_TOUR_PHASE_ORDER,
  applyFloorReclassification,
  buildManualTourHotspots,
  buildPanoramaEngine,
  isNodeUsable,
  scaledDuration,
  toManualTourPanorama,
  validatePanoramaEngine,
  videoPortalButtonLabel,
} from "@/features/tour/engine";
import {
  useCrossFloorHotspots,
  useGuidedTour,
  usePanoramaPreloader,
  useTourKeyboardShortcuts,
  useTourPanoramas,
} from "@/hooks";
import type { TourPanorama } from "@/types";

const IDLE_HIDE_MS = 4000;

function TourLoadingSplash() {
  return (
    <div className="relative flex h-screen items-center justify-center overflow-hidden">
      <Image
        src="/images/background1.jpeg"
        alt="Global Academy of Technology"
        fill
        priority
        className="object-cover object-center"
      />
      <div className="absolute inset-0 bg-[#0B1330]/75 backdrop-blur-sm" />
      <div className="relative flex flex-col items-center gap-4 text-white">
        <Spinner size="lg" />
        <div className="text-center">
          <p className="font-display text-lg font-semibold">Loading virtual tour…</p>
          <p className="mt-1 text-sm text-white/70">Preparing the Main Building walkthrough</p>
        </div>
      </div>
    </div>
  );
}

export default function TourPage() {
  const { data: panoramas, isLoading, isError, refetch } = useTourPanoramas();
  const { data: crossFloorHotspots, refetch: refetchCrossFloorHotspots } = useCrossFloorHotspots();
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [placingCrossFloor, setPlacingCrossFloor] = useState(false);
  const [pickedCoords, setPickedCoords] = useState<{ yaw: number; pitch: number } | null>(null);
  // Set only when navigating by walking through a hotspot/Next/Previous —
  // Street View style "keep facing the direction of travel". Sidebar/
  // minimap/floor-selector jumps clear it, falling back to the scene's own
  // resting initial_yaw/initial_pitch (see goTo vs goToScene below).
  const [entryOrientation, setEntryOrientation] = useState<{
    yaw: number;
    pitch: number;
  } | null>(null);
  const [visitedIds, setVisitedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [mode, setMode] = useState<TourMode>("manual");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [immersiveMode, setImmersiveMode] = useState(false);
  const [chromeIdle, setChromeIdle] = useState(false);
  const viewerRef = useRef<PanoramaViewerHandle>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Computed before the loading/error early returns so the hooks below (which
  // must run unconditionally, same order every render) always have a value —
  // an empty array/id is a harmless no-op for both. The Central Quadrangle
  // reclassification runs once here — every consumer below (sidebar,
  // minimap, preloader, and the engine) shares this single relabeled array,
  // so none of them need their own awareness of the special case.
  const allPanoramas: TourPanorama[] = useMemo(
    () => applyFloorReclassification(panoramas ?? []),
    [panoramas],
  );

  // Doubly-linked-list scene graph — the permanent replacement for the old
  // flat-array + findIndex navigation. Built from the same, unmodified tour
  // API data every existing component already consumes (see PanoramaEngine).
  // crossFloorHotspots is the separate, hand-placed sightline dataset — empty
  // array until the placement tool below has actually saved something.
  const engine = useMemo(
    () => buildPanoramaEngine(allPanoramas, crossFloorHotspots ?? []),
    [allPanoramas, crossFloorHotspots],
  );

  const currentNode = currentId ? engine.getNode(currentId) : undefined;
  // Before the very first navigation, currentId is still null — fall back
  // to the engine's own first node (never the raw allPanoramas[0] object
  // directly), so the initial render's hotspots are always the engine's
  // dynamically-built list too. Skipping the engine here previously meant
  // the very first paint showed the backend's raw (pre-rebuild, no
  // cross-floor) hotspots until the first Next/Previous/jump — invisible
  // for forward/back (their positions happened to already match), but a
  // real gap for anything the engine derives that the backend response
  // never had, like cross-floor hotspots.
  const currentNodeOrFallback =
    currentNode ?? (allPanoramas[0] ? engine.getNode(allPanoramas[0].id) : undefined);
  const current = currentNodeOrFallback ? toManualTourPanorama(currentNodeOrFallback) : allPanoramas[0];
  const displayPanorama: TourPanorama = entryOrientation
    ? { ...current, yaw: entryOrientation.yaw, pitch: entryOrientation.pitch }
    : current;

  usePanoramaPreloader(allPanoramas, current?.id ?? "");

  // A picked-but-unsaved cross-floor coordinate only makes sense on the
  // scene it was picked on — clear it (and placement mode) on any
  // navigation so a stray click can't attribute a hotspot to the wrong node.
  useEffect(() => {
    setPickedCoords(null);
    setPlacingCrossFloor(false);
  }, [currentId]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development" || typeof window === "undefined") return;
    const report = validatePanoramaEngine(engine);
    (window as unknown as { __panoramaEngineDebug?: unknown }).__panoramaEngineDebug = {
      engine,
      report,
      buildManualTourHotspots,
      guidedTour: { GUIDED_TOUR_PHASE_ORDER, isNodeUsable, scaledDuration, videoPortalButtonLabel },
    };
    if (!report.valid) {
      console.warn("[PanoramaEngine] validation issues:", report.issues);
    }
  }, [engine]);

  useEffect(() => {
    if (current?.id) {
      setVisitedIds((prev) => (prev.has(current.id) ? prev : new Set(prev).add(current.id)));
    }
  }, [current?.id]);

  const resetIdleTimer = useCallback(() => {
    setChromeIdle(false);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => setChromeIdle(true), IDLE_HIDE_MS);
  }, []);

  useEffect(() => {
    resetIdleTimer();
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [resetIdleTimer]);

  // Stable reference (viewerRef itself never changes identity) so Minimap's
  // rAF loop doesn't tear down and restart every render.
  const getLiveYaw = useCallback(() => viewerRef.current?.getCurrentView()?.yaw ?? null, []);

  function goToScene(id: string, context?: HotspotNavigationContext) {
    if (!allPanoramas.some((p) => p.id === id)) return;
    setEntryOrientation(
      context?.yaw !== undefined && context?.pitch !== undefined
        ? { yaw: context.yaw, pitch: context.pitch }
        : null,
    );
    setCurrentId(id);
  }

  /** Jumping in directly (sidebar/minimap/floor selector) — always opens
   * facing the scene's own resting orientation, not a walked-in direction. */
  function goTo(id: string) {
    goToScene(id);
  }

  // Sprint 3 — Guided Tour walks PanoramaNode.next references itself and
  // reuses goToScene (the same path Manual Tour's hotspot clicks and
  // Next/Previous already go through) to mirror each step into this page's
  // own current-scene state, so the fade transition and every display below
  // stay identical between modes.
  const guidedTour = useGuidedTour({
    seedNode: currentNodeOrFallback,
    viewerRef,
    onAdvance: goToScene,
  });

  function handleModeChange(nextMode: TourMode) {
    if (nextMode === "manual" && (guidedTour.status === "playing" || guidedTour.status === "paused")) {
      guidedTour.stop();
    }
    setMode(nextMode);
  }

  /** Walks one step along the current floor's doubly linked list — `next`
   * for offset > 0, `previous` for offset < 0. A null link (start/end of the
   * floor's chain) is a no-op: floors no longer wrap into each other, unlike
   * the old flat-array modulo, which is the more correct behavior for a
   * per-floor DLL. */
  function goToOffset(offset: number) {
    const activeNode = currentNodeOrFallback;
    if (!activeNode) return;
    const link = offset > 0 ? activeNode.next : activeNode.previous;
    if (!link) return;
    goToScene(link.node.sceneId, {
      yaw: link.entryYaw ?? undefined,
      pitch: link.entryPitch ?? undefined,
    });
  }

  function goToFloor(floor: string) {
    const head = engine.getFloor(floor)?.head;
    if (head) goToScene(head.sceneId);
  }

  // Orientation Calibration — permanently recalibrates the current
  // panorama's resting direction. Persists via the existing panoramas API,
  // then refetches through the same useTourPanoramas() hook every other
  // scene already loads from, so the DLL/hotspot engine rebuild that
  // naturally follows (see the `engine` useMemo above) picks up the new
  // orientation with no extra plumbing.
  async function handleSaveOrientation(yaw: number, pitch: number) {
    if (!currentNodeOrFallback) return;
    await panoramasApi.updateOrientation(currentNodeOrFallback.panoramaId, {
      initial_yaw: yaw,
      initial_pitch: pitch,
    });
    await refetch();
  }

  // Cross-Floor Hotspot placement tool — an admin-only visual layer, kept
  // entirely separate from orientation calibration (never touches
  // initial_yaw/initial_pitch or any Edge/Panorama row).
  async function handleSaveCrossFloorHotspot(targetSceneId: string, label: string) {
    if (!currentNodeOrFallback || !pickedCoords) return;
    await crossFloorHotspotsApi.create({
      source_node_id: Number(currentNodeOrFallback.sceneId),
      target_node_id: Number(targetSceneId),
      yaw: pickedCoords.yaw,
      pitch: pickedCoords.pitch,
      label: label.trim() || null,
    });
    setPickedCoords(null);
    await refetchCrossFloorHotspots();
  }

  async function handleDeleteCrossFloorHotspot(id: number) {
    await crossFloorHotspotsApi.remove(id);
    await refetchCrossFloorHotspots();
  }

  useTourKeyboardShortcuts({
    onReset: () => viewerRef.current?.resetView(),
    onFullscreen: () => viewerRef.current?.toggleFullscreen(),
    onToggleImmersive: () => setImmersiveMode((prev) => !prev),
  });

  if (isLoading) {
    return <TourLoadingSplash />;
  }

  if (isError || !panoramas || panoramas.length === 0) {
    return (
      <PageContainer>
        <ErrorState
          title="Couldn't load the virtual tour"
          message="The panorama data could not be loaded. Make sure the backend is running and the Main Building tour has been seeded."
          onRetry={() => refetch()}
        />
      </PageContainer>
    );
  }

  const chromeVisible = !immersiveMode && !chromeIdle;
  const guidedActive = guidedTour.status === "playing" || guidedTour.status === "paused";

  return (
    <div
      className="flex h-screen flex-col gap-4 px-4 pb-4 pt-24 sm:px-6 lg:flex-row lg:px-8"
      onMouseMove={resetIdleTimer}
      onTouchStart={resetIdleTimer}
    >
      <AnimatePresence initial={false}>
        {mode === "manual" && !immersiveMode && !sidebarCollapsed && (
          <motion.div
            key="tour-sidebar"
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <TourSidebar
              panoramas={allPanoramas}
              currentFloor={current.floor}
              onSelectFloor={goToFloor}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative min-h-[50vh] flex-1">
        <PanoramaViewer
          ref={viewerRef}
          panorama={displayPanorama}
          onHotspotClick={goToScene}
          interactionsEnabled={mode === "manual" || !guidedActive}
          // Only actively capturing clicks until the first pick — once
          // coords are picked, the overlay must get out of the way so the
          // placement panel's own form (destination picker, Save button)
          // is clickable instead of being covered by it.
          placementModeActive={placingCrossFloor && !pickedCoords}
          onPlacementPick={(yaw, pitch) => setPickedCoords({ yaw, pitch })}
          className="h-full w-full"
        />

        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4 transition-opacity duration-300",
            chromeVisible ? "opacity-100" : "opacity-0",
          )}
        >
          <div className="pointer-events-auto flex flex-col items-start gap-2">
            <TourModeToggle mode={mode} onChange={handleModeChange} />
            <TourTopBar panorama={current} />
            {mode === "manual" &&
              process.env.NEXT_PUBLIC_ENABLE_CROSS_FLOOR_PLACEMENT === "true" &&
              currentNodeOrFallback && (
                <CrossFloorHotspotPlacementPanel
                  sceneId={currentNodeOrFallback.sceneId}
                  allPanoramas={allPanoramas}
                  hotspots={crossFloorHotspots ?? []}
                  placing={placingCrossFloor}
                  onTogglePlacing={() => {
                    setPickedCoords(null);
                    setPlacingCrossFloor((prev) => !prev);
                  }}
                  pickedCoords={pickedCoords}
                  onClearPick={() => setPickedCoords(null)}
                  onSave={handleSaveCrossFloorHotspot}
                  onDelete={handleDeleteCrossFloorHotspot}
                />
              )}
          </div>
          <div className="pointer-events-auto hidden sm:block">
            {mode === "manual" ? (
              <Minimap
                panoramas={allPanoramas}
                current={current}
                visitedIds={visitedIds}
                onSelect={goTo}
                getLiveYaw={getLiveYaw}
              />
            ) : (
              currentNodeOrFallback && (
                <GuidedTourPanel
                  currentNode={currentNodeOrFallback}
                  engine={engine}
                  status={guidedTour.status}
                  phase={guidedTour.phase}
                  errorMessage={guidedTour.errorMessage}
                />
              )
            )}
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-4 flex items-center justify-center gap-3">
          <div
            className={cn(
              "pointer-events-auto transition-opacity duration-300",
              // Manual Tour's own controls (Hide Sidebar/Previous/Reset
              // View/Fullscreen/Next) never auto-hide on idle — only the
              // explicit Immersive toggle can hide them. Guided Tour keeps
              // the original idle-fade behavior, unchanged.
              (mode === "manual" ? !immersiveMode : chromeVisible)
                ? "opacity-100"
                : "pointer-events-none opacity-0",
            )}
          >
            {mode === "manual" ? (
              <TourControls
                onNext={() => goToOffset(1)}
                onPrevious={() => goToOffset(-1)}
                onReset={() => viewerRef.current?.resetView()}
                onFullscreen={() => viewerRef.current?.toggleFullscreen()}
                sidebarCollapsed={sidebarCollapsed}
                onToggleSidebar={() => setSidebarCollapsed((prev) => !prev)}
              />
            ) : (
              <GuidedTourControls
                status={guidedTour.status}
                speed={guidedTour.speed}
                onStart={guidedTour.start}
                onPause={guidedTour.pause}
                onResume={guidedTour.resume}
                onStop={guidedTour.stop}
                onRestart={guidedTour.restart}
                onSpeedChange={guidedTour.setSpeed}
              />
            )}
          </div>
          <div className="pointer-events-auto">
            <ImmersiveToggle
              active={immersiveMode}
              onToggle={() => setImmersiveMode((prev) => !prev)}
            />
          </div>
        </div>

        {process.env.NEXT_PUBLIC_ENABLE_ORIENTATION_CALIBRATION === "true" && currentNodeOrFallback && (
          <div
            className={cn(
              "pointer-events-none absolute bottom-4 left-4 transition-opacity duration-300",
              chromeVisible ? "opacity-100" : "pointer-events-none opacity-0",
            )}
          >
            <div className="pointer-events-auto">
              <OrientationCalibrationPanel
                sceneId={currentNodeOrFallback.sceneId}
                viewerRef={viewerRef}
                onSave={handleSaveOrientation}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
