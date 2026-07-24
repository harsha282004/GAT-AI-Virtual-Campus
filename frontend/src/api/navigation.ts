import { apiClient } from "@/api/client";
import type { BuildingNavigationResponse, RoomNavigationResponse, RouteResponse } from "@/types";

export const navigationApi = {
  route: async (fromNodeId: number, toNodeId: number): Promise<RouteResponse> => {
    const { data } = await apiClient.get<RouteResponse>("/navigation", {
      params: { from_node_id: fromNodeId, to_node_id: toNodeId },
    });
    return data;
  },

  searchRooms: async (query: string): Promise<RoomNavigationResponse> => {
    const { data } = await apiClient.get<RoomNavigationResponse>("/navigation/room", {
      params: { q: query },
    });
    return data;
  },

  navigateToRoom: async (roomId: number, fromNodeId: number): Promise<RoomNavigationResponse> => {
    const { data } = await apiClient.get<RoomNavigationResponse>("/navigation/room", {
      params: { room_id: roomId, from_node_id: fromNodeId },
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
  ): Promise<BuildingNavigationResponse> => {
    const { data } = await apiClient.get<BuildingNavigationResponse>("/navigation/building", {
      params: { building_id: buildingId, from_node_id: fromNodeId },
    });
    return data;
  },
};
