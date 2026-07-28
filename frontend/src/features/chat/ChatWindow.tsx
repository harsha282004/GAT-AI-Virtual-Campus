"use client";

import { Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";

import { useChatStore } from "@/store";
import type { ChatMessage } from "@/types";

import { ChatInput } from "./ChatInput";
import { ChatMessageBubble } from "./ChatMessageBubble";
import { TypingIndicator } from "./TypingIndicator";

const NOT_CONNECTED_REPLY =
  "Backend integration coming in AI Phase. In the meantime, try Indoor Navigation or the Virtual Tour from the menu above.";

let messageCounter = 0;
function nextId(prefix: string) {
  messageCounter += 1;
  return `${prefix}-${messageCounter}`;
}

export function ChatWindow() {
  const messages = useChatStore((state) => state.messages);
  const isAssistantTyping = useChatStore((state) => state.isAssistantTyping);
  const addMessage = useChatStore((state) => state.addMessage);
  const setAssistantTyping = useChatStore((state) => state.setAssistantTyping);
  const clearMessages = useChatStore((state) => state.clearMessages);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isAssistantTyping]);

  function handleSend(content: string) {
    const userMessage: ChatMessage = {
      id: nextId("user"),
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };
    addMessage(userMessage);
    setAssistantTyping(true);

    window.setTimeout(() => {
      setAssistantTyping(false);
      addMessage({
        id: nextId("assistant"),
        role: "assistant",
        content: NOT_CONNECTED_REPLY,
        createdAt: new Date().toISOString(),
      });
    }, 900);
  }

  return (
    <div className="flex h-[calc(100vh-11rem)] flex-col overflow-hidden rounded-3xl border border-hairline bg-white shadow-soft dark:bg-[#0F172A] dark:shadow-black/30">
      <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
        <div>
          <p className="font-display text-sm font-semibold text-ink">GAT Assistant</p>
          <p className="text-xs text-muted">Backend integration coming in AI Phase</p>
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
      </div>

      <div className="border-t border-hairline p-4">
        <ChatInput onSend={handleSend} disabled={isAssistantTyping} />
      </div>
    </div>
  );
}
