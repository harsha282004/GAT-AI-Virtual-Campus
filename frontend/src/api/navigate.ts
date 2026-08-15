import { apiClient } from "@/api/client";
import type { Route } from "@/types";

export const navigateApi = {
  getRoute: async (
    startNodeId: number,
    destinationNodeId: number,
    accessibleOnly = false,
  ): Promise<Route> => {
    const { data } = await apiClient.get<Route>("/navigate", {
      params: {
        start_node_id: startNodeId,
        destination_node_id: destinationNodeId,
        accessible_only: accessibleOnly,
      },
    });
    return data;
  },
};
