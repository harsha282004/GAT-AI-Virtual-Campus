import { useMutation, useQuery } from "@tanstack/react-query";

import { navigationApi } from "@/api/navigation";
import type { DestinationType } from "@/store/navigationStore";

export function useRoute(fromNodeId: number | null, toNodeId: number | null, accessible = false) {
  return useQuery({
    queryKey: ["navigation", "route", fromNodeId, toNodeId, accessible],
    queryFn: () => navigationApi.route(fromNodeId as number, toNodeId as number, accessible),
    enabled: fromNodeId !== null && toNodeId !== null,
  });
}

/** Routes to whichever destination type (room/building) is currently selected. */
export function useDestinationRoute(
  fromNodeId: number | null,
  destinationType: DestinationType,
  destinationId: number | null,
  accessible = false,
) {
  return useQuery({
    queryKey: [
      "navigation",
      "destination-route",
      fromNodeId,
      destinationType,
      destinationId,
      accessible,
    ],
    queryFn: async () => {
      if (destinationType === "room") {
        return navigationApi.navigateToRoom(
          destinationId as number,
          fromNodeId as number,
          accessible,
        );
      }
      return navigationApi.navigateToBuilding(
        destinationId as number,
        fromNodeId as number,
        accessible,
      );
    },
    enabled: fromNodeId !== null && destinationType !== null && destinationId !== null,
  });
}

export function useRoomSearch() {
  return useMutation({
    mutationFn: (query: string) => navigationApi.searchRooms(query),
  });
}

export function useBuildingSearch() {
  return useMutation({
    mutationFn: (query: string) => navigationApi.searchBuildings(query),
  });
}

export function useNavigateToRoom() {
  return useMutation({
    mutationFn: ({ roomId, fromNodeId }: { roomId: number; fromNodeId: number }) =>
      navigationApi.navigateToRoom(roomId, fromNodeId),
  });
}

export function useNavigateToBuilding() {
  return useMutation({
    mutationFn: ({ buildingId, fromNodeId }: { buildingId: number; fromNodeId: number }) =>
      navigationApi.navigateToBuilding(buildingId, fromNodeId),
  });
}

export function useNearbyRooms(nodeId: number | null, limit = 5) {
  return useQuery({
    queryKey: ["navigation", "nearby", nodeId, limit],
    queryFn: () => navigationApi.nearbyRooms(nodeId as number, limit),
    enabled: nodeId !== null,
  });
}

export function useNearestPanorama(nodeId: number | null) {
  return useQuery({
    queryKey: ["navigation", "nearest-panorama", nodeId],
    queryFn: () => navigationApi.nearestPanorama(nodeId as number),
    enabled: nodeId !== null,
  });
}
