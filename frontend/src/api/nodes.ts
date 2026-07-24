import { apiClient } from "@/api/client";
import type { CampusNode } from "@/types";

/**
 * Not one of the explicitly requested service modules, but the Navigation
 * page's "Current Location" selector needs a real node id to send as
 * from_node_id — this is the minimal supporting piece for that.
 */
export const nodesApi = {
  list: async (): Promise<CampusNode[]> => {
    const { data } = await apiClient.get<CampusNode[]>("/nodes");
    return data;
  },
};
