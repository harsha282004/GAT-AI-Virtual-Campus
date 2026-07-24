import { useQuery } from "@tanstack/react-query";

import { panoramasApi } from "@/api/panoramas";

export function usePanoramas() {
  return useQuery({
    queryKey: ["panoramas"],
    queryFn: panoramasApi.list,
    staleTime: 5 * 60 * 1000,
  });
}
