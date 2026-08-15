"use client";

import { LocateFixed, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { ErrorState, Skeleton } from "@/components/ui";
import { CAMPUS_NEAR_RADIUS_M, GAT_CAMPUS_CENTER } from "@/config/campusLocation";
import { deriveBuildingPlacements } from "@/features/map3d/campusLayout";
import { MapSearch } from "@/features/map3d/MapSearch";
import { useBuildings, useFloors, useNodes } from "@/hooks";
import { useCampusStore } from "@/store";

import { BuildingGeoInfoPanel } from "./BuildingGeoInfoPanel";
import { haversineDistanceMeters } from "./geoDistance";
import { GoogleSatelliteMap, type GoogleSatelliteMapHandle } from "./GoogleSatelliteMap";
import { UserLocationStatusBanner } from "./UserLocationStatusBanner";
import { useUserLocation } from "./useUserLocation";

/** Phase 17 — the real geographic satellite map, now the primary /map
 * experience. Mirrors map3d/Map3DCampusView.tsx's structure (same data
 * hooks, same useCampusStore selection, same MapSearch reuse per Section
 * 7) so the two views behave identically apart from the renderer itself
 * — see campusMap/CampusMapView.tsx for the toggle that switches
 * between this and the preserved Phase 16 3D view. */
export function SatelliteCampusMap() {
  const buildings = useBuildings();
  const nodes = useNodes();
  const floors = useFloors();

  const selectedBuildingId = useCampusStore((state) => state.selectedBuildingId);
  const setSelectedBuildingId = useCampusStore((state) => state.setSelectedBuildingId);

  const mapRef = useRef<GoogleSatelliteMapHandle>(null);

  // Phase 18 — real browser GPS position (never fabricated; see
  // useUserLocation.ts). Distinct from GAT_CAMPUS_CENTER (the campus
  // reference point) and from any future indoor-navigation node — this
  // is only ever the user's real outdoor/geographic position.
  const { status: locationStatus, position: userPosition, errorMessage, requestLocation } =
    useUserLocation();
  const [dismissedMessage, setDismissedMessage] = useState<string | null>(null);

  // "My Location" recenters the camera exactly once per click, on the
  // first fix that arrives after it — later watchPosition() updates
  // move the blue dot but must NOT keep aggressively re-centering the
  // camera out from under a user who has since panned/zoomed elsewhere
  // (Section "REAL-TIME LOCATION"). Clicking the button again sets this
  // flag again for a fresh recenter.
  const shouldRecenterOnNextFixRef = useRef(false);

  useEffect(() => {
    if (userPosition && shouldRecenterOnNextFixRef.current) {
      mapRef.current?.centerOnUser(userPosition.latitude, userPosition.longitude);
      shouldRecenterOnNextFixRef.current = false;
    }
  }, [userPosition]);

  function handleMyLocationClick() {
    setDismissedMessage(null);
    shouldRecenterOnNextFixRef.current = true;
    requestLocation();
  }

  const distanceFromCampusM = userPosition
    ? haversineDistanceMeters(userPosition, GAT_CAMPUS_CENTER)
    : null;
  const isOutsideCampus = distanceFromCampusM !== null && distanceFromCampusM > CAMPUS_NEAR_RADIUS_M;

  // Section "USER EXPERIENCE"'s denied/unavailable/unsupported copy
  // takes priority; once located, an informational "outside campus"
  // hint can follow instead. Either can be dismissed independently.
  const bannerMessage =
    (locationStatus === "denied" || locationStatus === "unavailable" || locationStatus === "unsupported") &&
    errorMessage
      ? errorMessage
      : isOutsideCampus
        ? "You are outside the campus area."
        : null;
  const bannerTone: "warning" | "info" =
    locationStatus === "denied" || locationStatus === "unavailable" || locationStatus === "unsupported"
      ? "warning"
      : "info";
  const showBanner = bannerMessage !== null && bannerMessage !== dismissedMessage;

  const isLoading = buildings.isLoading || nodes.isLoading || floors.isLoading;
  const isError = buildings.isError || nodes.isError || floors.isError;

  // Reused as-is from the 3D map (Section 7's "no duplicate search
  // backend") for floor count / mapped-point count in the info panel —
  // its x/y/width/height/depth fields are simply unused here.
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

  // Unlike the 3D scene's focusBuilding() (Section 7 requires "move the
  // camera toward the building" on search-select), this can only pan the
  // real satellite camera to a building's real coordinate when one
  // exists — panning to a fabricated position would be exactly the kind
  // of invented location Section 11 forbids. Today that's zero
  // buildings, so search selects and opens the info panel without
  // moving the camera; a future phase populating real Building lat/lng
  // makes this pan automatically, no code change needed.
  function handleLocate(buildingId: number) {
    setSelectedBuildingId(buildingId);
    const building = (buildings.data ?? []).find((b) => b.id === buildingId);
    if (building?.latitude !== null && building?.longitude !== null && building) {
      mapRef.current?.panTo(building.latitude, building.longitude);
    }
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
          userPosition={userPosition}
        />

        <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-2 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="pointer-events-auto">
              <MapSearch buildings={buildings.data ?? []} onLocate={handleLocate} />
            </div>
            <div className="pointer-events-auto flex items-center gap-2">
              <button
                type="button"
                onClick={handleMyLocationClick}
                disabled={locationStatus === "requesting"}
                aria-label="My location"
                title="My location"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-hairline bg-white text-ink shadow-soft transition-colors hover:bg-brand/5 disabled:cursor-wait disabled:opacity-60 dark:bg-[#0F172A] dark:text-white"
              >
                <LocateFixed
                  className={`h-4 w-4 ${locationStatus === "requesting" ? "animate-pulse" : ""} ${
                    locationStatus === "available" ? "text-[#4285F4]" : ""
                  }`}
                />
              </button>
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

          {showBanner && bannerMessage && (
            <div className="flex justify-end">
              <div className="max-w-xs">
                <UserLocationStatusBanner
                  message={bannerMessage}
                  tone={bannerTone}
                  onDismiss={() => setDismissedMessage(bannerMessage)}
                />
              </div>
            </div>
          )}
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
