"use client";

import { useCallback, useRef, useState } from "react";

import { getApiErrorMessage } from "@/api/client";
import { useLanguageStore } from "@/store";
import type { ChatApiResponse } from "@/types";

import { useChatSend } from "./useChat";

export interface CampusExplorerState {
  /** The question currently being asked / answered (null before first ask). */
  submitted: string | null;
  response: ChatApiResponse | null;
  errorMessage: string | null;
  isLoading: boolean;
  /** Send a question through the existing /api/v1/chat pipeline. */
  ask: (question: string) => void;
  reset: () => void;
}

/**
 * Self-contained "AI Campus Explorer" conversation. Uses the SAME endpoint
 * and pipeline as the /chat page (`chatApi.send` via `useChatSend`) but keeps
 * its own local session so it never pollutes the persisted main chat history.
 * Grounding / refusal behaviour is whatever the backend returns — nothing is
 * overridden here.
 */
export function useCampusExplorer(): CampusExplorerState {
  const chatSend = useChatSend();
  const language = useLanguageStore((s) => s.language);
  const sessionRef = useRef<string | null>(null);

  const [submitted, setSubmitted] = useState<string | null>(null);
  const [response, setResponse] = useState<ChatApiResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const ask = useCallback(
    (question: string) => {
      const trimmed = question.trim();
      if (!trimmed || chatSend.isPending) return;
      setSubmitted(trimmed);
      setResponse(null);
      setErrorMessage(null);
      chatSend.mutate(
        { message: trimmed, sessionId: sessionRef.current, language },
        {
          onSuccess: (r) => {
            sessionRef.current = r.session_id ?? sessionRef.current;
            setResponse(r);
          },
          onError: (err) => setErrorMessage(getApiErrorMessage(err)),
        },
      );
    },
    [chatSend, language],
  );

  const reset = useCallback(() => {
    setSubmitted(null);
    setResponse(null);
    setErrorMessage(null);
  }, []);

  return {
    submitted,
    response,
    errorMessage,
    isLoading: chatSend.isPending,
    ask,
    reset,
  };
}
