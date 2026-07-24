import { apiClient } from "@/api/client";
import type { Panorama } from "@/types";

export const panoramasApi = {
  list: async (): Promise<Panorama[]> => {
    const { data } = await apiClient.get<Panorama[]>("/panoramas");
    return data;
  },
};
