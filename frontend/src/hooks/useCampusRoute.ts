import { useMutation } from "@tanstack/react-query";

import { navigateApi } from "@/api/navigate";

/**
 * On-demand A* route lookup for the Campus "Get Directions" action.
 * A mutation (not a query) because it runs when the user clicks, against
 * a start/destination pair chosen at that moment.
 */
export function useCampusRoute() {
  return useMutation({
    mutationFn: ({
      startNodeId,
      destinationNodeId,
      accessibleOnly,
    }: {
      startNodeId: number;
      destinationNodeId: number;
      accessibleOnly?: boolean;
    }) => navigateApi.route(startNodeId, destinationNodeId, accessibleOnly ?? false),
  });
}
