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
  GAT_CAMPUS_USER_LOCATION_ZOOM,
} from "@/config/campusLocation";
import type { Building } from "@/types";

import { BuildingMarker } from "./BuildingMarker";
import { CampusMarker } from "./CampusMarker";
import { SatelliteMapUnavailable } from "./SatelliteMapUnavailable";
import type { UserLocationPosition } from "./useUserLocation";
import { UserLocationMarker } from "./UserLocationMarker";

export interface GoogleSatelliteMapHandle {
  resetView: () => void;
  panTo: (latitude: number, longitude: number) => void;
  /** Phase 18 — pans/zooms to the user's real GPS position, distinct
   * from resetView() (which always returns to the configured GAT
   * campus center — Section "MAP CAMERA BEHAVIOR": these must stay two
   * separate actions). */
  centerOnUser: (latitude: number, longitude: number) => void;
}

interface GoogleSatelliteMapProps {
  buildings: Building[];
  selectedBuildingId: number | null;
  onSelectBuilding: (buildingId: number) => void;
  userPosition: UserLocationPosition | null;
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
 * the rest of the page (Navbar, sidebar, the 3D view toggle) keeps
 * working either way (Section 13). */
export const GoogleSatelliteMap = forwardRef<GoogleSatelliteMapHandle, GoogleSatelliteMapProps>(
  function GoogleSatelliteMap({ buildings, selectedBuildingId, onSelectBuilding, userPosition }, ref) {
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
          userPosition={userPosition}
        />
      </APIProvider>
    );
  },
);

const SatelliteMapInner = forwardRef<GoogleSatelliteMapHandle, GoogleSatelliteMapProps>(
  function SatelliteMapInner({ buildings, selectedBuildingId, onSelectBuilding, userPosition }, ref) {
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
        mapTypeId="satellite"
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
        {userPosition && (
          <UserLocationMarker
            latitude={userPosition.latitude}
            longitude={userPosition.longitude}
            accuracy={userPosition.accuracy}
          />
        )}
      </Map>
    );
  },
);

/** Renders null — exists only to reach useMap() from inside <Map>'s own
 * context (the map instance isn't available any higher up the tree) and
 * expose an imperative resetView() to the floating "Reset View" button
 * that lives outside this component, mirroring map3d/CampusScene3D.tsx's
 * forwardRef + useImperativeHandle pattern for the 3D scene. */
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
        panTo: (latitude: number, longitude: number) => {
          if (!map) return;
          map.panTo({ lat: latitude, lng: longitude });
        },
        centerOnUser: (latitude: number, longitude: number) => {
          if (!map) return;
          map.panTo({ lat: latitude, lng: longitude });
          map.setZoom(GAT_CAMPUS_USER_LOCATION_ZOOM);
        },
      }),
      [map],
    );

    return null;
  },
);
