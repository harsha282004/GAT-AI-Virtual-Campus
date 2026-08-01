import { useQuery } from "@tanstack/react-query";

import { crossFloorHotspotsApi } from "@/api/crossFloorHotspots";

/** All hand-placed cross-floor sightline hotspots — a small, admin-placed
 * dataset (not scoped per building/floor server-side; there's only ever a
 * handful of these, so one unfiltered fetch is simplest). Short staleTime
 * (not the tour panoramas' 5 minutes) so a freshly-placed hotspot from the
 * dev-only placement tool shows up on refetch without a full page reload. */
export function useCrossFloorHotspots() {
  return useQuery({
    queryKey: ["cross-floor-hotspots"],
    queryFn: crossFloorHotspotsApi.list,
    staleTime: 30 * 1000,
  });
}
