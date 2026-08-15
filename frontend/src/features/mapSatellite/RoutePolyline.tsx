"use client";

import { Polyline } from "@vis.gl/react-google-maps";

import type { CampusNode, Route } from "@/types";

interface RoutePolylineProps {
  route: Route;
  nodes: CampusNode[];
}

/**
 * Phase 19 — draws the route as a real line on the satellite map ONLY
 * when every node along the path has a surveyed latitude/longitude.
 * Today that's true for zero routes (no campus node has real
 * coordinates yet — see findNearestCampusNode.ts), so this renders
 * nothing rather than connecting fabricated positions on the satellite
 * tile, which would repeat exactly the mistake Phase 17 deliberately
 * avoided for building markers (see BuildingMarker.tsx). The
 * turn-by-turn text list in NavigationPanel.tsx is the route's real,
 * always-available representation, independent of geocoding coverage.
 */
export function RoutePolyline({ route, nodes }: RoutePolylineProps) {
  const nodesById = new Map(nodes.map((n) => [n.id, n]));

  const path: google.maps.LatLngLiteral[] = [];
  for (const nodeId of route.path_node_ids) {
    const node = nodesById.get(nodeId);
    if (!node || node.latitude === null || node.longitude === null) {
      return null;
    }
    path.push({ lat: node.latitude, lng: node.longitude });
  }

  return <Polyline path={path} strokeColor="#4285F4" strokeOpacity={0.9} strokeWeight={4} />;
}
