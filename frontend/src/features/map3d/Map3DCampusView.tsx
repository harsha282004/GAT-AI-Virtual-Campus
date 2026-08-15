"use client";

import { RotateCcw } from "lucide-react";
import dynamic from "next/dynamic";
import { useMemo, useRef } from "react";

import { ErrorState, Skeleton } from "@/components/ui";
import { useBuildings, useFloors, useNodes } from "@/hooks";
import { useCampusStore } from "@/store";

import { BuildingInfoPanel } from "./BuildingInfoPanel";
import { deriveBuildingPlacements } from "./campusLayout";
import type { CampusSceneHandle } from "./CampusScene3D";
import { isWebGLAvailable, Map3DErrorBoundary, Map3DUnavailable } from "./Map3DErrorBoundary";
import { MapSearch } from "./MapSearch";

// react-three-fiber's <Canvas> touches WebGL/window at mount — loaded only
// on the client, never during Next.js's server render (Section 15/22: no
// broken/blank canvas flash, and no SSR crash on a server with no GPU).
const CampusScene3D = dynamic(
  () => import("./CampusScene3D").then((mod) => mod.CampusScene3D),
  { ssr: false, loading: () => <Map3DLoading /> },
);

function Map3DLoading() {
  return (
    <div className="flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-3 rounded-3xl bg-brand-gradient shadow-glow">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/30 border-t-white" />
      <p className="font-display text-sm font-medium text-white/80">Loading GAT Campus…</p>
    </div>
  );
}

/** Phase 16 — the real interactive 3D campus map, replacing the previous
 * Map3DPlaceholder reserved slot. Reuses the existing useBuildings()/
 * useNodes()/useFloors() hooks (Phase 5-era campus API, unmodified) and
 * the existing useCampusStore selection state — the same store
 * BuildingNodeSidebar already reads, so selecting a building in 3D and in
 * the sidebar stay in sync automatically. */
export function Map3DCampusView() {
  const buildings = useBuildings();
  const nodes = useNodes();
  const floors = useFloors();

  const selectedBuildingId = useCampusStore((state) => state.selectedBuildingId);
  const setSelectedBuildingId = useCampusStore((state) => state.setSelectedBuildingId);

  const sceneRef = useRef<CampusSceneHandle>(null);

  const isLoading = buildings.isLoading || nodes.isLoading || floors.isLoading;
  const isError = buildings.isError || nodes.isError || floors.isError;

  const placements = useMemo(
    () => deriveBuildingPlacements(buildings.data ?? [], nodes.data ?? [], floors.data ?? []),
    [buildings.data, nodes.data, floors.data],
  );

  const selectedPlacement = placements.find((p) => p.building.id === selectedBuildingId) ?? null;
  const selectedNodeCount = selectedBuildingId
    ? (nodes.data ?? []).filter((n) => n.building_id === selectedBuildingId).length
    : 0;

  function retryAll() {
    buildings.refetch();
    nodes.refetch();
    floors.refetch();
  }

  function handleSelectBuilding(buildingId: number) {
    setSelectedBuildingId(buildingId === selectedBuildingId ? null : buildingId);
  }

  function handleLocate(buildingId: number) {
    setSelectedBuildingId(buildingId);
    const placement = placements.find((p) => p.building.id === buildingId);
    if (placement) sceneRef.current?.focusBuilding(placement);
  }

  if (isLoading) {
    return (
      <div className="flex h-full min-w-0 flex-1 flex-col gap-4 rounded-3xl border border-hairline bg-white p-8 dark:bg-[#0F172A]">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-full w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-full min-w-0 flex-1 items-center justify-center">
        <ErrorState
          title="Unable to load campus map"
          message="The campus buildings and map data could not be retrieved. Please try again."
          onRetry={retryAll}
        />
      </div>
    );
  }

  if (!isWebGLAvailable()) {
    return <Map3DUnavailable />;
  }

  return (
    <div className="relative flex h-full min-w-0 flex-1 gap-4">
      <div className="relative flex-1 overflow-hidden rounded-3xl shadow-glow">
        <Map3DErrorBoundary>
          <CampusScene3D
            ref={sceneRef}
            placements={placements}
            selectedBuildingId={selectedBuildingId}
            onSelectBuilding={handleSelectBuilding}
          />
        </Map3DErrorBoundary>

        {/* Floating controls — top bar (search) and a reset-view button,
            kept minimal per Section 14's "do not overload the screen". */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4">
          <div className="pointer-events-auto">
            <MapSearch buildings={buildings.data ?? []} onLocate={handleLocate} />
          </div>
          <button
            type="button"
            onClick={() => sceneRef.current?.resetView()}
            aria-label="Reset camera view"
            title="Reset view"
            className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-hairline bg-white text-ink shadow-soft transition-colors hover:bg-brand/5 dark:bg-[#0F172A] dark:text-white"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>

        {selectedPlacement && (
          <div className="pointer-events-none absolute bottom-4 right-4 max-w-[calc(100%-2rem)]">
            <div className="pointer-events-auto">
              <BuildingInfoPanel
                placement={selectedPlacement}
                nodeCount={selectedNodeCount}
                onClose={() => setSelectedBuildingId(null)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
