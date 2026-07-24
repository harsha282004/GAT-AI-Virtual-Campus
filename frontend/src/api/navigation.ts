import { apiClient } from "@/api/client";
import type {
  BuildingNavigationResponse,
  NearbyRoomsResponse,
  NearestPanoramaResponse,
  RoomNavigationResponse,
  RouteResponse,
} from "@/types";

export const navigationApi = {
  route: async (
    fromNodeId: number,
    toNodeId: number,
    accessible = false,
  ): Promise<RouteResponse> => {
    const { data } = await apiClient.get<RouteResponse>("/navigation", {
      params: { from_node_id: fromNodeId, to_node_id: toNodeId, accessible },
    });
    return data;
  },

  searchRooms: async (query: string): Promise<RoomNavigationResponse> => {
    const { data } = await apiClient.get<RoomNavigationResponse>("/navigation/room", {
      params: { q: query },
    });
    return data;
  },

  navigateToRoom: async (
    roomId: number,
    fromNodeId: number,
    accessible = false,
  ): Promise<RoomNavigationResponse> => {
    const { data } = await apiClient.get<RoomNavigationResponse>("/navigation/room", {
      params: { room_id: roomId, from_node_id: fromNodeId, accessible },
    });
    return data;
  },

  searchBuildings: async (query: string): Promise<BuildingNavigationResponse> => {
    const { data } = await apiClient.get<BuildingNavigationResponse>("/navigation/building", {
      params: { q: query },
    });
    return data;
  },

  navigateToBuilding: async (
    buildingId: number,
    fromNodeId: number,
    accessible = false,
  ): Promise<BuildingNavigationResponse> => {
    const { data } = await apiClient.get<BuildingNavigationResponse>("/navigation/building", {
      params: { building_id: buildingId, from_node_id: fromNodeId, accessible },
    });
    return data;
  },

  nearbyRooms: async (nodeId: number, limit = 5): Promise<NearbyRoomsResponse> => {
    const { data } = await apiClient.get<NearbyRoomsResponse>("/navigation/nearby", {
      params: { node_id: nodeId, limit },
    });
    return data;
  },

  nearestPanorama: async (nodeId: number): Promise<NearestPanoramaResponse> => {
    const { data } = await apiClient.get<NearestPanoramaResponse>(
      "/navigation/nearest-panorama",
      { params: { node_id: nodeId } },
    );
    return data;
  },
};
