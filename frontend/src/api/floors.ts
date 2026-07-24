import { apiClient } from "@/api/client";
import type { Floor } from "@/types";

/**
 * Not one of the explicitly requested service modules, but the Campus
 * Overview page needs floor data to group rooms under each building —
 * this is the minimal supporting piece for that.
 */
export const floorsApi = {
  list: async (): Promise<Floor[]> => {
    const { data } = await apiClient.get<Floor[]>("/floors");
    return data;
  },
};
