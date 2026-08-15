"use client";

import { Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";

import { useChatConversation } from "@/hooks";
import { useChatStore } from "@/store";

import { ChatInput } from "./ChatInput";
import { ChatMessageBubble } from "./ChatMessageBubble";
import { TypingIndicator } from "./TypingIndicator";

export function ChatWindow() {
  const messages = useChatStore((state) => state.messages);
  const isAssistantTyping = useChatStore((state) => state.isAssistantTyping);
  const clearMessages = useChatStore((state) => state.clearMessages);

  const scrollRef = useRef<HTMLDivElement>(null);
  const { sendMessage } = useChatConversation();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isAssistantTyping]);

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
      </div>

      <div className="border-t border-hairline p-4">
        <ChatInput onSend={sendMessage} disabled={isAssistantTyping} />
      </div>
    </div>
  );
}
