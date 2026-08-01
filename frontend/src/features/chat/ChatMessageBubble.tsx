"use client";

import { motion } from "framer-motion";
import { Bot, Check, Copy, User } from "lucide-react";
import { useState } from "react";

import { cn } from "@/utils";
import type { ChatMessage } from "@/types";

export function ChatMessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — silently no-op.
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn("group/bubble flex items-end gap-3", isUser && "flex-row-reverse")}
    >
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-brand text-white" : "bg-accent-purple/12 text-accent-purple",
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </span>

      <div className={cn("flex max-w-[75%] flex-col gap-1", isUser && "items-end")}>
        <div
          className={cn(
            "rounded-2xl px-4 py-3 text-sm leading-relaxed",
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

        {!isUser && (
          <button
            type="button"
            onClick={handleCopy}
            aria-label={copied ? "Copied" : "Copy message"}
            className="flex items-center gap-1 self-start rounded-full px-2 py-1 text-[11px] text-muted opacity-0 transition-opacity duration-200 hover:text-brand group-hover/bubble:opacity-100"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
        )}
      </div>
    </motion.div>
  );
}
