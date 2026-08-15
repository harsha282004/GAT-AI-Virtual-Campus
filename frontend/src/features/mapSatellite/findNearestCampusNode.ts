import type { CampusNode } from "@/types";

import { haversineDistanceMeters } from "./geoDistance";

export interface NearestCampusNode {
  nearestNodeId: number;
  nearestNodeName: string;
  distanceMeters: number;
  latitude: number;
  longitude: number;
}

/**
 * Phase 19 — GPS position -> nearest campus navigation node.
 *
 * Only considers nodes that actually carry real, surveyed
 * latitude/longitude (backend/app/models/node.py's columns — see
 * config/campusLocation.ts's BUILDING_GEOCODING_STATUS note for why
 * Phase 17/18 never derive these from the unrelated local pos_x/pos_y
 * plane). As of Phase 19, zero nodes in the live database have real
 * coordinates yet, so this legitimately returns null for every campus
 * today — that is the correct, honest answer, not a bug; it starts
 * returning real matches the moment any node's lat/lng is surveyed and
 * recorded, with no code change needed here.
 *
 * Never fabricates a node's position and never alters the caller's real
 * GPS coordinate — this only searches existing data for the closest
 * real point to it.
 */
export function findNearestCampusNode(
  userPosition: { latitude: number; longitude: number },
  nodes: CampusNode[],
): NearestCampusNode | null {
  const geocodedNodes = nodes.filter(
    (n): n is CampusNode & { latitude: number; longitude: number } =>
      n.latitude !== null && n.longitude !== null,
  );

  if (geocodedNodes.length === 0) return null;

  let nearest = geocodedNodes[0];
  let nearestDistance = haversineDistanceMeters(userPosition, {
    latitude: nearest.latitude,
    longitude: nearest.longitude,
  });

  for (const node of geocodedNodes.slice(1)) {
    const distance = haversineDistanceMeters(userPosition, {
      latitude: node.latitude,
      longitude: node.longitude,
    });
    if (distance < nearestDistance) {
      nearest = node;
      nearestDistance = distance;
    }
  }

  return {
    nearestNodeId: nearest.id,
    nearestNodeName: nearest.name,
    distanceMeters: nearestDistance,
    latitude: nearest.latitude,
    longitude: nearest.longitude,
  };
}
