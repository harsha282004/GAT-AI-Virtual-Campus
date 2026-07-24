import { apiClient } from "@/api/client";
import type { Room } from "@/types";

export const roomsApi = {
  list: async (): Promise<Room[]> => {
    const { data } = await apiClient.get<Room[]>("/rooms");
    return data;
  },
  get: async (id: number): Promise<Room> => {
    const { data } = await apiClient.get<Room>(`/rooms/${id}`);
    return data;
  },
};
