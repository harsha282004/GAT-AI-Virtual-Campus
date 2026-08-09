"use client";

import { motion } from "framer-motion";
import { Building2, GraduationCap, MapPinned, Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";

import { getApiErrorMessage } from "@/api/client";
import { useChatSend } from "@/hooks";
import { useChatStore } from "@/store";
import type { ChatApiSource, ChatMessage, ChatSource } from "@/types";

import { ChatInput } from "./ChatInput";
import { ChatMessageBubble } from "./ChatMessageBubble";
import { TypingIndicator } from "./TypingIndicator";

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

const QUICK_PROMPTS = [
  { icon: GraduationCap, label: "How do admissions work?" },
  { icon: Building2, label: "What departments does GAT offer?" },
  { icon: MapPinned, label: "Where is the library?" },
];

let messageCounter = 0;
function nextId(prefix: string) {
  messageCounter += 1;
  return `${prefix}-${messageCounter}`;
}

export function ChatWindow() {
  const messages = useChatStore((state) => state.messages);
  const isAssistantTyping = useChatStore((state) => state.isAssistantTyping);
  const sessionId = useChatStore((state) => state.sessionId);
  const addMessage = useChatStore((state) => state.addMessage);
  const setAssistantTyping = useChatStore((state) => state.setAssistantTyping);
  const clearMessages = useChatStore((state) => state.clearMessages);
  const setSessionId = useChatStore((state) => state.setSessionId);

  const scrollRef = useRef<HTMLDivElement>(null);
  const chatSend = useChatSend();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isAssistantTyping]);

  function handleSend(content: string) {
    // Guards against a duplicate in-flight request — ChatInput already
    // disables itself while isAssistantTyping, this is the belt-and-braces
    // check at the call site itself.
    if (isAssistantTyping) return;

    const userMessage: ChatMessage = {
      id: nextId("user"),
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };
    addMessage(userMessage);
    setAssistantTyping(true);

    chatSend.mutate(
      { message: content, sessionId },
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

  const showQuickPrompts = messages.length <= 1 && !isAssistantTyping;

  return (
    <div className="flex h-[calc(100vh-11rem)] flex-col overflow-hidden rounded-3xl border border-hairline bg-white shadow-soft dark:bg-[#0F172A] dark:shadow-black/30">
      <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
        <div>
          <p className="font-display text-sm font-semibold text-ink">GAT Assistant</p>
          <p className="text-xs text-muted">Ask about admissions, academics, facilities, or navigation</p>
        </div>
        <button
          type="button"
          onClick={clearMessages}
          aria-label="Clear conversation"
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-brand/5 hover:text-brand"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
        {messages.map((message) => (
          <ChatMessageBubble key={message.id} message={message} />
        ))}
        {isAssistantTyping && <TypingIndicator />}

        {showQuickPrompts && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="flex flex-wrap gap-2 pl-11"
          >
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt.label}
                type="button"
                onClick={() => handleSend(prompt.label)}
                className="flex items-center gap-2 rounded-full border border-hairline bg-white px-4 py-2 text-xs font-medium text-ink/75 transition-colors hover:border-brand hover:text-brand dark:bg-[#0F172A]"
              >
                <prompt.icon className="h-3.5 w-3.5" />
                {prompt.label}
              </button>
            ))}
          </motion.div>
        )}
      </div>

      <div className="border-t border-hairline p-4">
        <ChatInput onSend={handleSend} disabled={isAssistantTyping} />
      </div>
    </div>
  );
}
