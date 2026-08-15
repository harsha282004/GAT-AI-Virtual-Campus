"use client";

import { Marker } from "@vis.gl/react-google-maps";

import type { Building } from "@/types";

interface BuildingMarkerProps {
  building: Building;
  selected: boolean;
  onSelect: () => void;
}

/** Renders a real pin only when a building has surveyed coordinates
 * (building.latitude/longitude both non-null) — true for zero buildings
 * today (Phase 17 adds the columns; no on-site survey has been done). A
 * future phase populating real values needs no code change here: the
 * marker appears automatically the moment the data exists (see
 * docs/phase17_satellite_campus_map.md). */
export function BuildingMarker({ building, selected, onSelect }: BuildingMarkerProps) {
  if (building.latitude === null || building.longitude === null) return null;

  return (
    <Marker
      position={{ lat: building.latitude, lng: building.longitude }}
      title={building.name}
      opacity={selected ? 1 : 0.85}
      onClick={onSelect}
    />
  );
}
