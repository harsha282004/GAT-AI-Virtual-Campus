"use client";

import { RotateCcw } from "lucide-react";
import { useMemo, useRef } from "react";

import { ErrorState, Skeleton } from "@/components/ui";
import { deriveBuildingPlacements } from "@/features/mapSatellite/campusLayout";
import { useBuildings, useFloors, useNodes } from "@/hooks";
import { useCampusStore } from "@/store";

import { BuildingGeoInfoPanel } from "./BuildingGeoInfoPanel";
import { GoogleSatelliteMap, type GoogleSatelliteMapHandle } from "./GoogleSatelliteMap";

/** The real geographic satellite map — the sole /map experience. Renders
 * full-width with no sidebar, search bar, or 3D toggle; the only overlay
 * controls are building selection (via the map itself) and "Reset View"
 * to return the camera to the configured GAT campus center. */
export function SatelliteCampusMap() {
  const buildings = useBuildings();
  const nodes = useNodes();
  const floors = useFloors();

  const selectedBuildingId = useCampusStore((state) => state.selectedBuildingId);
  const setSelectedBuildingId = useCampusStore((state) => state.setSelectedBuildingId);

  const mapRef = useRef<GoogleSatelliteMapHandle>(null);

  const isLoading = buildings.isLoading || nodes.isLoading || floors.isLoading;
  const isError = buildings.isError || nodes.isError || floors.isError;

  // Reused for floor count / mapped-point count in the info panel — its
  // x/y/width/height/depth fields (originally for the removed 3D scene)
  // are simply unused here.
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

  return (
    <div className="relative flex h-full min-w-0 flex-1 gap-4">
      <div className="relative flex-1 overflow-hidden rounded-3xl shadow-glow">
        <GoogleSatelliteMap
          ref={mapRef}
          buildings={buildings.data ?? []}
          selectedBuildingId={selectedBuildingId}
          onSelectBuilding={handleSelectBuilding}
        />

        <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-end p-4">
          <div className="pointer-events-auto">
            <button
              type="button"
              onClick={() => mapRef.current?.resetView()}
              aria-label="Return to GAT campus"
              title="Return to GAT campus"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-hairline bg-white text-ink shadow-soft transition-colors hover:bg-brand/5 dark:bg-[#0F172A] dark:text-white"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {selectedPlacement && (
          <div className="pointer-events-none absolute bottom-4 right-4 max-w-[calc(100%-2rem)]">
            <div className="pointer-events-auto">
              <BuildingGeoInfoPanel
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
