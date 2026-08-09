import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { ChatMessage } from "@/types";

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Hi, I'm the GAT Assistant. Ask me about admissions, academics, facilities, or getting around campus.",
  createdAt: "2025-01-01T00:00:00.000Z",
};

interface ChatState {
  messages: ChatMessage[];
  isAssistantTyping: boolean;
  voiceEnabled: boolean;
  /** Backend-issued session_id, replayed on each request so the backend's
   * PostgreSQL-backed conversation history (Phase 8; in-process in Phase 7)
   * can resolve follow-ups (e.g. "how do I get there?") against previous
   * turns. Persisted via this store's zustand `persist` middleware like
   * every other field here, so it — and the conversation it points to —
   * survives a page refresh. Cleared with the conversation since a fresh
   * conversation has no prior context. */
  sessionId: string | null;
  addMessage: (message: ChatMessage) => void;
  setAssistantTyping: (value: boolean) => void;
  toggleVoice: () => void;
  clearMessages: () => void;
  setSessionId: (sessionId: string | null) => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      messages: [WELCOME_MESSAGE],
      isAssistantTyping: false,
      voiceEnabled: false,
      sessionId: null,

      addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),

      setAssistantTyping: (value) => set({ isAssistantTyping: value }),

      toggleVoice: () => set((state) => ({ voiceEnabled: !state.voiceEnabled })),

      clearMessages: () => set({ messages: [WELCOME_MESSAGE], sessionId: null }),

      setSessionId: (sessionId) => set({ sessionId }),
    }),
    { name: "gat-chat" },
  ),
);
