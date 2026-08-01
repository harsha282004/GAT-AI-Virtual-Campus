import { apiClient } from "@/api/client";
import type { CrossFloorHotspotCreatePayload, CrossFloorHotspotDto } from "@/types";

export const crossFloorHotspotsApi = {
  list: async (): Promise<CrossFloorHotspotDto[]> => {
    const { data } = await apiClient.get<CrossFloorHotspotDto[]>("/cross-floor-hotspots");
    return data;
  },

  create: async (payload: CrossFloorHotspotCreatePayload): Promise<CrossFloorHotspotDto> => {
    const { data } = await apiClient.post<CrossFloorHotspotDto>("/cross-floor-hotspots", payload);
    return data;
  },

  remove: async (id: number): Promise<void> => {
    await apiClient.delete(`/cross-floor-hotspots/${id}`);
  },
};
