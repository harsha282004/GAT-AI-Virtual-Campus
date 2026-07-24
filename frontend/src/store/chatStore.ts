import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { ChatMessage } from "@/types";

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Hi, I'm the GAT Assistant. Ask me about admissions, academics, facilities, or getting around campus — full AI answers are coming in a later phase, but you can try the interface out now.",
  createdAt: "2025-01-01T00:00:00.000Z",
};

interface ChatState {
  messages: ChatMessage[];
  isAssistantTyping: boolean;
  voiceEnabled: boolean;
  addMessage: (message: ChatMessage) => void;
  setAssistantTyping: (value: boolean) => void;
  toggleVoice: () => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      messages: [WELCOME_MESSAGE],
      isAssistantTyping: false,
      voiceEnabled: false,

      addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),

      setAssistantTyping: (value) => set({ isAssistantTyping: value }),

      toggleVoice: () => set((state) => ({ voiceEnabled: !state.voiceEnabled })),

      clearMessages: () => set({ messages: [WELCOME_MESSAGE] }),
    }),
    { name: "gat-chat" },
  ),
);
