"use client";

import {
  APILoadingStatus,
  APIProvider,
  Map,
  useApiLoadingStatus,
  useMap,
} from "@vis.gl/react-google-maps";
import { forwardRef, useImperativeHandle } from "react";

import {
  GAT_CAMPUS_CENTER,
  GAT_CAMPUS_DEFAULT_ZOOM,
  GAT_CAMPUS_MAX_ZOOM,
  GAT_CAMPUS_MIN_ZOOM,
} from "@/config/campusLocation";
import type { Building } from "@/types";

import { BuildingMarker } from "./BuildingMarker";
import { CampusMarker } from "./CampusMarker";
import { SatelliteMapUnavailable } from "./SatelliteMapUnavailable";

export interface GoogleSatelliteMapHandle {
  resetView: () => void;
}

interface GoogleSatelliteMapProps {
  buildings: Building[];
  selectedBuildingId: number | null;
  onSelectBuilding: (buildingId: number) => void;
}

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
const CAMPUS_CENTER_LATLNG = {
  lat: GAT_CAMPUS_CENTER.latitude,
  lng: GAT_CAMPUS_CENTER.longitude,
};

/** Section 2/12 — official Google Maps Platform integration via
 * @vis.gl/react-google-maps (Google's own maintained React wrapper around
 * the Maps JavaScript API), key read from an env var, never hardcoded.
 * Renders nothing (a graceful fallback instead) if the key is missing —
 * the rest of the page (Navbar) keeps working either way.
 *
 * mapTypeId is "hybrid" (satellite imagery + Google's own real road/
 * place-label/POI overlay), not "satellite" (raw imagery only) — this is
 * what gives the map progressive, zoom-based geographic detail (area
 * names, roads, nearby landmarks) without hardcoding or inventing any
 * geographic data ourselves; the label density at each zoom level is
 * entirely Google's built-in behavior. */
export const GoogleSatelliteMap = forwardRef<GoogleSatelliteMapHandle, GoogleSatelliteMapProps>(
  function GoogleSatelliteMap({ buildings, selectedBuildingId, onSelectBuilding }, ref) {
    if (!GOOGLE_MAPS_API_KEY) {
      return <SatelliteMapUnavailable reason="missing-key" />;
    }

    return (
      <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
        <SatelliteMapInner
          ref={ref}
          buildings={buildings}
          selectedBuildingId={selectedBuildingId}
          onSelectBuilding={onSelectBuilding}
        />
      </APIProvider>
    );
  },
);

const SatelliteMapInner = forwardRef<GoogleSatelliteMapHandle, GoogleSatelliteMapProps>(
  function SatelliteMapInner({ buildings, selectedBuildingId, onSelectBuilding }, ref) {
    const status = useApiLoadingStatus();

    if (status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE) {
      return <SatelliteMapUnavailable reason="load-failed" />;
    }

    return (
      <Map
        defaultCenter={CAMPUS_CENTER_LATLNG}
        defaultZoom={GAT_CAMPUS_DEFAULT_ZOOM}
        minZoom={GAT_CAMPUS_MIN_ZOOM}
        maxZoom={GAT_CAMPUS_MAX_ZOOM}
        mapTypeId="hybrid"
        gestureHandling="greedy"
        disableDefaultUI={false}
        fullscreenControl={false}
        streetViewControl={false}
        style={{ width: "100%", height: "100%" }}
      >
        <ResetViewController ref={ref} />
        <CampusMarker
          buildings={buildings}
          selectedBuildingId={selectedBuildingId}
          onSelectBuilding={onSelectBuilding}
        />
        {buildings
          .filter((b) => b.latitude !== null && b.longitude !== null)
          .map((building) => (
            <BuildingMarker
              key={building.id}
              building={building}
              selected={building.id === selectedBuildingId}
              onSelect={() => onSelectBuilding(building.id)}
            />
          ))}
      </Map>
    );
  },
);

/** Renders null — exists only to reach useMap() from inside <Map>'s own
 * context (the map instance isn't available any higher up the tree) and
 * expose an imperative resetView() to the floating "Reset View" button
 * that lives outside this component. */
const ResetViewController = forwardRef<GoogleSatelliteMapHandle, unknown>(
  function ResetViewController(_props, ref) {
    const map = useMap();

    useImperativeHandle(
      ref,
      () => ({
        resetView: () => {
          if (!map) return;
          map.panTo(CAMPUS_CENTER_LATLNG);
          map.setZoom(GAT_CAMPUS_DEFAULT_ZOOM);
        },
      }),
      [map],
    );

    return null;
  },
);
