import { apiClient } from "@/api/client";
import type { CampusRoute } from "@/types";

/**
 * Thin client for the existing `GET /api/v1/navigate` A* route endpoint
 * (unchanged since Phase 5 / re-exposed Phase 19). The Campus page's
 * "Get Directions" action is the first caller since the old GPS map UI
 * was removed — no pathfinding logic is reimplemented here.
 */
export const navigateApi = {
  route: async (
    startNodeId: number,
    destinationNodeId: number,
    accessibleOnly = false,
  ): Promise<CampusRoute> => {
    const { data } = await apiClient.get<CampusRoute>("/navigate", {
      params: {
        start_node_id: startNodeId,
        destination_node_id: destinationNodeId,
        accessible_only: accessibleOnly,
      },
    });
    return data;
  },
};
