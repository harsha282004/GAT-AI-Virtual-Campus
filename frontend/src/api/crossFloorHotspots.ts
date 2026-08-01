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

  // The generic CRUD router already exposed PUT /{id} from the start (see
  // backend/app/api/v1/cross_floor_hotspots.py) — this just starts using it.
  update: async (id: number, payload: CrossFloorHotspotCreatePayload): Promise<CrossFloorHotspotDto> => {
    const { data } = await apiClient.put<CrossFloorHotspotDto>(`/cross-floor-hotspots/${id}`, payload);
    return data;
  },

  remove: async (id: number): Promise<void> => {
    await apiClient.delete(`/cross-floor-hotspots/${id}`);
  },
};
