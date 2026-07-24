"use client";

import { motion } from "framer-motion";
import { Bot, User } from "lucide-react";

import { cn } from "@/utils";
import type { ChatMessage } from "@/types";

export function ChatMessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn("flex items-end gap-3", isUser && "flex-row-reverse")}
    >
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-brand text-white" : "bg-accent-purple/12 text-accent-purple",
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </span>

      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isUser ? "rounded-br-sm bg-brand text-white" : "rounded-bl-sm bg-brand/5 text-ink",
        )}
      >
        <p>{message.content}</p>

        {message.sources && message.sources.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {message.sources.map((source) => (
              <span
                key={source.label}
                className="rounded-full bg-accent-gold/15 px-2.5 py-0.5 text-[11px] font-medium text-accent-gold"
              >
                {source.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
