"use client";

import { motion } from "framer-motion";
import { Bot, Check, Copy, User, Volume2, VolumeX } from "lucide-react";
import { useState } from "react";

import { useTranslation } from "@/hooks";
import { cn } from "@/utils";
import type { ChatMessage } from "@/types";

interface ChatMessageBubbleProps {
  message: ChatMessage;
  /** Whether Text-to-Speech is currently reading THIS message aloud. */
  isSpeaking?: boolean;
  /** Toggles TTS playback for this message — starts it if idle, calls
   * speechSynthesis.cancel() (via the parent's stop()) if already
   * speaking. Omitted entirely (no button rendered) when TTS isn't
   * supported in this browser. */
  onToggleSpeak?: () => void;
}

export function ChatMessageBubble({ message, isSpeaking = false, onToggleSpeak }: ChatMessageBubbleProps) {
  const { t } = useTranslation();
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
            isUser
              ? "rounded-br-sm bg-brand text-white"
              : message.error
                ? "rounded-bl-sm bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                : "rounded-bl-sm bg-brand/5 text-ink",
          )}
        >
          <p className="whitespace-pre-line">{message.content}</p>

          {message.navigation && (
            <ol className="mt-2.5 list-decimal space-y-1 pl-4 text-[13px] text-ink/80">
              {message.navigation.turn_by_turn.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
          )}

          {message.panorama && (
            <p className="mt-2 text-[11px] font-medium text-accent-purple">
              📍 {message.panorama.title ?? `Scene #${message.panorama.node_id}`}
            </p>
          )}

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
          <div className="flex items-center gap-1 self-start opacity-0 transition-opacity duration-200 group-hover/bubble:opacity-100">
            <button
              type="button"
              onClick={handleCopy}
              aria-label={copied ? t("Copied") : t("Copy")}
              className="flex items-center gap-1 rounded-full px-2 py-1 text-[11px] text-muted hover:text-brand"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? t("Copied") : t("Copy")}
            </button>

            {!message.error && onToggleSpeak && (
              <button
                type="button"
                onClick={onToggleSpeak}
                aria-label={isSpeaking ? t("Stop speaking") : t("Listen to answer")}
                title={isSpeaking ? t("Stop speaking") : t("Listen to answer")}
                className={cn(
                  "flex items-center gap-1 rounded-full px-2 py-1 text-[11px] hover:text-brand",
                  isSpeaking ? "text-brand" : "text-muted",
                )}
              >
                {isSpeaking ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
