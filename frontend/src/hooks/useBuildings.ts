import { useQuery } from "@tanstack/react-query";

import { buildingsApi } from "@/api/buildings";

export function useBuildings() {
  return useQuery({
    queryKey: ["buildings"],
    queryFn: buildingsApi.list,
    staleTime: 5 * 60 * 1000,
  });
}

export function useBuilding(id: number | null) {
  return useQuery({
    queryKey: ["buildings", id],
    queryFn: () => buildingsApi.get(id as number),
    enabled: id !== null,
  });
}
