import { useQuery } from "@tanstack/react-query";

import { campusApi } from "@/api/campus";

export function useCampusStats(campusId = 1) {
  return useQuery({
    queryKey: ["campus-stats", campusId],
    queryFn: () => campusApi.stats(campusId),
    staleTime: 10 * 60 * 1000,
  });
}
