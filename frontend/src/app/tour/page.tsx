"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import { ErrorState, PageContainer, Spinner } from "@/components/ui";
import { cn } from "@/utils";
import {
  FloorSelector,
  ImmersiveToggle,
  Minimap,
  PanoramaViewer,
  TourControls,
  TourSidebar,
  TourTopBar,
} from "@/features/tour";
import type { HotspotNavigationContext, PanoramaViewerHandle } from "@/features/tour";
import { usePanoramaPreloader, useTourKeyboardShortcuts, useTourPanoramas } from "@/hooks";
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
  const [currentId, setCurrentId] = useState<string | null>(null);
  // Set only when navigating by walking through a hotspot/Next/Previous —
  // Street View style "keep facing the direction of travel". Sidebar/
  // minimap/floor-selector jumps clear it, falling back to the scene's own
  // resting initial_yaw/initial_pitch (see goTo vs goToScene below).
  const [entryOrientation, setEntryOrientation] = useState<{
    yaw: number;
    pitch: number;
  } | null>(null);
  const [visitedIds, setVisitedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [immersiveMode, setImmersiveMode] = useState(false);
  const [chromeIdle, setChromeIdle] = useState(false);
  const viewerRef = useRef<PanoramaViewerHandle>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Computed before the loading/error early returns so the hooks below (which
  // must run unconditionally, same order every render) always have a value —
  // an empty array/id is a harmless no-op for both.
  const allPanoramas: TourPanorama[] = panoramas ?? [];
  const currentIndex = currentId ? allPanoramas.findIndex((p) => p.id === currentId) : -1;
  const current = allPanoramas[currentIndex] ?? allPanoramas[0];
  const displayPanorama: TourPanorama = entryOrientation
    ? { ...current, yaw: entryOrientation.yaw, pitch: entryOrientation.pitch }
    : current;

  usePanoramaPreloader(allPanoramas, current?.id ?? "");

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

  function goToOffset(offset: number) {
    if (allPanoramas.length === 0) return;
    const index = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = (index + offset + allPanoramas.length) % allPanoramas.length;
    const nextPanorama = allPanoramas[nextIndex];
    // Next/Previous walk the same forward/back hotspot a click would — reuse
    // its entry orientation so the two stay perfectly consistent.
    const hotspot = current?.hotspots.find((h) => h.targetId === nextPanorama.id);
    goToScene(
      nextPanorama.id,
      hotspot ? { yaw: hotspot.entryYaw, pitch: hotspot.entryPitch } : undefined,
    );
  }

  function goToFloor(floor: string) {
    const target = allPanoramas.find((p) => p.floor === floor);
    if (target) goToScene(target.id);
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

  return (
    <div
      className="flex h-screen flex-col gap-4 px-4 pb-4 pt-24 sm:px-6 lg:flex-row lg:px-8"
      onMouseMove={resetIdleTimer}
      onTouchStart={resetIdleTimer}
    >
      <AnimatePresence initial={false}>
        {!immersiveMode && !sidebarCollapsed && (
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
          className="h-full w-full"
        />

        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4 transition-opacity duration-300",
            chromeVisible ? "opacity-100" : "opacity-0",
          )}
        >
          <div className="pointer-events-auto flex flex-col items-start gap-2">
            <TourTopBar panorama={current} />
            <FloorSelector
              panoramas={allPanoramas}
              currentFloor={current.floor}
              onSelectFloor={goToFloor}
            />
          </div>
          <div className="pointer-events-auto hidden sm:block">
            <Minimap
              panoramas={allPanoramas}
              current={current}
              visitedIds={visitedIds}
              onSelect={goTo}
              getLiveYaw={getLiveYaw}
            />
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-4 flex items-center justify-center gap-3">
          <div
            className={cn(
              "pointer-events-auto transition-opacity duration-300",
              chromeVisible ? "opacity-100" : "pointer-events-none opacity-0",
            )}
          >
            <TourControls
              onNext={() => goToOffset(1)}
              onPrevious={() => goToOffset(-1)}
              onReset={() => viewerRef.current?.resetView()}
              onFullscreen={() => viewerRef.current?.toggleFullscreen()}
              sidebarCollapsed={sidebarCollapsed}
              onToggleSidebar={() => setSidebarCollapsed((prev) => !prev)}
            />
          </div>
          <div className="pointer-events-auto">
            <ImmersiveToggle
              active={immersiveMode}
              onToggle={() => setImmersiveMode((prev) => !prev)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
