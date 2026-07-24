import { useQuery } from "@tanstack/react-query";

import { floorsApi } from "@/api/floors";

export function useFloors() {
  return useQuery({
    queryKey: ["floors"],
    queryFn: floorsApi.list,
    staleTime: 5 * 60 * 1000,
  });
}
