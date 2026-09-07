import { apiClient } from "@/api/client";
import type { CampusStats } from "@/types";

export const campusApi = {
  /** Aggregate counts for the Campus page's "at a glance" section. */
  stats: async (campusId = 1): Promise<CampusStats> => {
    const { data } = await apiClient.get<CampusStats>(`/campuses/${campusId}/stats`);
    return data;
  },
};
