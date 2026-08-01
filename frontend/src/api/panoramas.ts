import { apiClient } from "@/api/client";
import type { Panorama } from "@/types";

export interface PanoramaOrientationUpdate {
  initial_yaw: number;
  initial_pitch: number;
}

export const panoramasApi = {
  list: async (): Promise<Panorama[]> => {
    const { data } = await apiClient.get<Panorama[]>("/panoramas");
    return data;
  },

  /** Permanent recalibration — PUT /panoramas/{id}/orientation. */
  updateOrientation: async (
    panoramaId: number,
    orientation: PanoramaOrientationUpdate,
  ): Promise<Panorama> => {
    const { data } = await apiClient.put<Panorama>(
      `/panoramas/${panoramaId}/orientation`,
      orientation,
    );
    return data;
  },
};
