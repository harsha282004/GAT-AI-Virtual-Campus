import { apiClient } from "@/api/client";
import type { ChatApiRequest, ChatApiResponse } from "@/types";

export const chatApi = {
  send: async (
    message: string,
    sessionId?: string | null,
    language?: string | null,
  ): Promise<ChatApiResponse> => {
    const payload: ChatApiRequest = { message, session_id: sessionId ?? null, language: language ?? null };
    // Longer than apiClient's default 10s: this is the one endpoint that
    // waits on local LLM generation (observed 6-9s even when Ollama's
    // model is already warm/loaded — see backend warmup()), not a fast
    // DB/pathfinding call like the other endpoints sharing apiClient's
    // default timeout.
    const { data } = await apiClient.post<ChatApiResponse>("/chat", payload, { timeout: 25_000 });
    return data;
  },
};
