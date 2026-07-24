import { useQuery } from "@tanstack/react-query";

import { roomsApi } from "@/api/rooms";

export function useRooms() {
  return useQuery({
    queryKey: ["rooms"],
    queryFn: roomsApi.list,
    staleTime: 5 * 60 * 1000,
  });
}

export function useRoom(id: number | null) {
  return useQuery({
    queryKey: ["rooms", id],
    queryFn: () => roomsApi.get(id as number),
    enabled: id !== null,
  });
}
