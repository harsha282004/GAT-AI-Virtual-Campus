"use client";

import { getApiErrorMessage } from "@/api/client";
import { useChatStore, useLanguageStore } from "@/store";
import type { ChatApiSource, ChatMessage, ChatSource } from "@/types";

import { useChatSend } from "./useChat";

function dedupeSources(sources: ChatApiSource[], selectedAgent: string): ChatSource[] {
  const seen = new Set<string>();
  const result: ChatSource[] = [];
  for (const source of sources) {
    const label = source.title ?? source.source_url ?? null;
    if (!label || seen.has(label)) continue;
    seen.add(label);
    result.push({ label, domain: selectedAgent });
  }
  return result;
}

// A module-level incrementing counter is NOT safe here: useChatStore
// persists `messages` (via zustand's `persist` middleware, key "gat-chat")
// to localStorage, so prior IDs like "user-1"/"assistant-2" survive a page
// reload while this counter resets to 0 — the next message after reload
// then regenerates the same IDs and collides with the persisted history
// (the "two children with the same key" warning). crypto.randomUUID() is
// unique regardless of reloads/persisted history/StrictMode double-renders.
function nextId(prefix: string) {
  const unique =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${unique}`;
}

/** Centralizes the "send a message through the existing RAG chat
 * pipeline" flow (POST /api/v1/chat via chatApi, same shared chat
 * store) so every entry point — typed input, suggested-question clicks,
 * and voice transcripts (post speech-to-text) — goes through the exact
 * same request/response handling instead of each maintaining its own
 * copy of it. */
export function useChatConversation() {
  const isAssistantTyping = useChatStore((state) => state.isAssistantTyping);
  const sessionId = useChatStore((state) => state.sessionId);
  const addMessage = useChatStore((state) => state.addMessage);
  const setAssistantTyping = useChatStore((state) => state.setAssistantTyping);
  const setSessionId = useChatStore((state) => state.setSessionId);
  const language = useLanguageStore((state) => state.language);
  const chatSend = useChatSend();

  function sendMessage(content: string, options?: { viaVoice?: boolean }) {
    // Belt-and-braces guard — callers (ChatInput, SuggestedQuestions) also
    // disable their own controls while a request is in flight.
    const trimmed = content.trim();
    if (!trimmed || isAssistantTyping) return;
    const viaVoice = options?.viaVoice ?? false;

    const userMessage: ChatMessage = {
      id: nextId("user"),
      role: "user",
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    addMessage(userMessage);
    setAssistantTyping(true);

    chatSend.mutate(
      { message: trimmed, sessionId, language },
      {
        onSuccess: (response) => {
          setSessionId(response.session_id);
          addMessage({
            id: nextId("assistant"),
            role: "assistant",
            content: response.answer,
            createdAt: new Date().toISOString(),
            sources: dedupeSources(response.sources, response.selected_agent),
            navigation: response.navigation,
            panorama: response.panorama,
            spokenQuery: viaVoice,
          });
        },
        onError: (error) => {
          addMessage({
            id: nextId("assistant"),
            role: "assistant",
            content: getApiErrorMessage(error),
            createdAt: new Date().toISOString(),
            error: true,
          });
        },
        onSettled: () => {
          setAssistantTyping(false);
        },
      },
    );
  }

  return { sendMessage, isAssistantTyping };
}
