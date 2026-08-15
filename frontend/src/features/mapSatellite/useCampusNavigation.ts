"use client";

import axios from "axios";
import { useEffect, useRef, useState } from "react";

import { getApiErrorMessage } from "@/api/client";
import { navigateApi } from "@/api/navigate";
import type { Building, CampusNode, Route } from "@/types";

import { findNearestCampusNode, type NearestCampusNode } from "./findNearestCampusNode";
import { haversineDistanceMeters } from "./geoDistance";
import { resolveDestinationNode } from "./resolveDestinationNode";
import type { UserLocationPosition } from "./useUserLocation";

export type NavigationStatus =
  | "idle"
  | "no_location"
  | "no_nearby_node"
  | "no_destination"
  | "computing_route"
  | "route_found"
  | "no_route_found"
  | "error";

// Section "GPS FOLLOWING BEHAVIOR" — don't recompute the nearest node (and
// so don't risk flipping the navigation start point) on every tiny
// watchPosition() tick; only when the user has genuinely moved.
const NEAREST_NODE_RECOMPUTE_THRESHOLD_M = 8;

interface UseCampusNavigationArgs {
  userPosition: UserLocationPosition | null;
  nodes: CampusNode[];
  buildings: Building[];
  selectedBuildingId: number | null;
}

export interface UseCampusNavigationResult {
  /** Real GPS position, passed through unchanged — never recomputed or
   * duplicated here; the single source of truth stays Phase 18's
   * useUserLocation(), reused, not a second watcher. */
  userPosition: UserLocationPosition | null;
  nearestNode: NearestCampusNode | null;
  destinationNode: CampusNode | null;
  destinationBuilding: Building | null;
  route: Route | null;
  status: NavigationStatus;
  errorMessage: string | null;
  startNavigation: () => void;
  clearRoute: () => void;
}

/**
 * Phase 19 — connects Phase 18's real GPS position to the existing
 * navigation graph, per the conceptual chain the phase spec lays out:
 *
 *   GPS position -> nearest campus node -> navigation start node
 *   -> selected destination -> existing navigation graph -> route
 *
 * Reuses: useUserLocation()'s output (passed in, not re-acquired),
 * useCampusStore's selectedBuildingId (passed in — the SAME destination
 * selection state BuildingNodeSidebar/MapSearch already write to, so
 * "select a destination" needs no new UI), and the existing backend A*
 * engine via GET /api/v1/navigate (Phase 5's engine, Phase 19 is only the
 * second caller it's ever had).
 */
export function useCampusNavigation({
  userPosition,
  nodes,
  buildings,
  selectedBuildingId,
}: UseCampusNavigationArgs): UseCampusNavigationResult {
  const [nearestNode, setNearestNode] = useState<NearestCampusNode | null>(null);
  const lastComputedFromRef = useRef<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    if (!userPosition) {
      setNearestNode(null);
      lastComputedFromRef.current = null;
      return;
    }
    const last = lastComputedFromRef.current;
    const movedEnough =
      !last || haversineDistanceMeters(userPosition, last) >= NEAREST_NODE_RECOMPUTE_THRESHOLD_M;
    if (!movedEnough) return;

    lastComputedFromRef.current = { latitude: userPosition.latitude, longitude: userPosition.longitude };
    setNearestNode(findNearestCampusNode(userPosition, nodes));
  }, [userPosition, nodes]);

  const destinationNode =
    selectedBuildingId !== null ? resolveDestinationNode(selectedBuildingId, nodes) : null;
  const destinationBuilding =
    selectedBuildingId !== null ? (buildings.find((b) => b.id === selectedBuildingId) ?? null) : null;

  const [route, setRoute] = useState<Route | null>(null);
  const [status, setStatus] = useState<NavigationStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function startNavigation() {
    setErrorMessage(null);

    if (!userPosition) {
      setStatus("no_location");
      setErrorMessage("Turn on “My Location” first so your starting point is known.");
      return;
    }
    if (!nearestNode) {
      setStatus("no_nearby_node");
      setErrorMessage(
        "GPS navigation is not available for this location yet — no nearby campus point has a surveyed position.",
      );
      return;
    }
    if (!destinationNode) {
      setStatus("no_destination");
      setErrorMessage("Select a destination building first.");
      return;
    }

    setStatus("computing_route");
    try {
      const result = await navigateApi.getRoute(nearestNode.nearestNodeId, destinationNode.id);
      setRoute(result);
      setStatus("route_found");
    } catch (err) {
      setRoute(null);
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        setStatus("no_route_found");
        setErrorMessage("No walking route exists between your location and that destination.");
      } else {
        setStatus("error");
        setErrorMessage(getApiErrorMessage(err));
      }
    }
  }

  function clearRoute() {
    setRoute(null);
    setStatus("idle");
    setErrorMessage(null);
  }

  return {
    userPosition,
    nearestNode,
    destinationNode,
    destinationBuilding,
    route,
    status,
    errorMessage,
    startNavigation,
    clearRoute,
  };
}
