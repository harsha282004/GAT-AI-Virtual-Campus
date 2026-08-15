import { apiClient } from "@/api/client";
import type { CampusEdge } from "@/types";

export const edgesApi = {
  list: async (): Promise<CampusEdge[]> => {
    const { data } = await apiClient.get<CampusEdge[]>("/edges");
    return data;
  },
};
