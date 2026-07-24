import { useQuery } from "@tanstack/react-query";

import { nodesApi } from "@/api/nodes";

export function useNodes() {
  return useQuery({
    queryKey: ["nodes"],
    queryFn: nodesApi.list,
    staleTime: 5 * 60 * 1000,
  });
}
