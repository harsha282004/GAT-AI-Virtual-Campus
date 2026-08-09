import { apiClient } from "@/api/client";
import type { ChatApiRequest, ChatApiResponse } from "@/types";

export const chatApi = {
  send: async (message: string, sessionId?: string | null): Promise<ChatApiResponse> => {
    const payload: ChatApiRequest = { message, session_id: sessionId ?? null };
    const { data } = await apiClient.post<ChatApiResponse>("/chat", payload);
    return data;
  },
};
