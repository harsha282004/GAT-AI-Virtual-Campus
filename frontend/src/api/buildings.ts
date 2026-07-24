import { apiClient } from "@/api/client";
import type { Building } from "@/types";

export const buildingsApi = {
  list: async (): Promise<Building[]> => {
    const { data } = await apiClient.get<Building[]>("/buildings");
    return data;
  },
  get: async (id: number): Promise<Building> => {
    const { data } = await apiClient.get<Building>(`/buildings/${id}`);
    return data;
  },
};
