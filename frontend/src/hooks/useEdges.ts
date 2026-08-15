import { useQuery } from "@tanstack/react-query";

import { edgesApi } from "@/api/edges";

export function useEdges() {
  return useQuery({
    queryKey: ["edges"],
    queryFn: edgesApi.list,
    staleTime: 5 * 60 * 1000,
  });
}
