"use client";

import { Trash2, Volume2, VolumeX, X } from "lucide-react";
import { useEffect, useRef } from "react";

import { useChatConversation, useSpeechSynthesis, useTranslation } from "@/hooks";
import { SPEECH_LANG } from "@/lib/i18n/translations";
import { useChatStore, useLanguageStore } from "@/store";
import { cn } from "@/utils";

import { ChatInput } from "./ChatInput";
import { ChatMessageBubble } from "./ChatMessageBubble";
import { TypingIndicator } from "./TypingIndicator";

interface ChatWindowProps {
  /** Overrides the default full-page height (h-[calc(100vh-11rem)]) — the
   * floating assistant widget (FloatingAssistant.tsx) renders this same
   * component inside a fixed-size panel instead of a full page. */
  className?: string;
  /** Renders an extra close (X) button in the existing header — used only
   * by FloatingAssistant.tsx so the widget doesn't need a second, duplicate
   * header wrapped around this component. Omit on the full /chat page. */
  onClose?: () => void;
}

export function ChatWindow({ className, onClose }: ChatWindowProps = {}) {
  const { t } = useTranslation();
  const messages = useChatStore((state) => state.messages);
  const isAssistantTyping = useChatStore((state) => state.isAssistantTyping);
  const clearMessages = useChatStore((state) => state.clearMessages);
  const voiceEnabled = useChatStore((state) => state.voiceEnabled);
  const toggleVoice = useChatStore((state) => state.toggleVoice);
  const speechLang = useLanguageStore((state) => SPEECH_LANG[state.language]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const { sendMessage } = useChatConversation();
  const { isSupported: ttsSupported, isSpeaking, speak, stop } = useSpeechSynthesis({ lang: speechLang });

  const speakingMessageIdRef = useRef<string | null>(null);
  const lastAutoSpokenIdRef = useRef<string | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isAssistantTyping]);

  // Text-to-Speech for AI answers: auto-speak a new assistant answer
  // exactly once when it either (a) answers a voice-submitted question
  // (message.spokenQuery, set by ChatInput/useChatConversation), or (b)
  // "read answers aloud" is toggled on. Never speaks the user's own
  // question, interim transcripts, the typing indicator, or error text.
  useEffect(() => {
    if (!ttsSupported) return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant" || last.error || last.pending) return;
    if (last.id === lastAutoSpokenIdRef.current) return;
    if (!last.spokenQuery && !voiceEnabled) return;

    lastAutoSpokenIdRef.current = last.id;
    speakingMessageIdRef.current = last.id;
    speak(last.content, { lang: speechLang });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, ttsSupported, voiceEnabled, speechLang]);

  function handleToggleSpeak(messageId: string, content: string) {
    if (isSpeaking && speakingMessageIdRef.current === messageId) {
      stop();
      speakingMessageIdRef.current = null;
      return;
    }
    speakingMessageIdRef.current = messageId;
    speak(content, { lang: speechLang });
  }

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-3xl border border-hairline bg-white shadow-soft dark:bg-[#0F172A] dark:shadow-black/30",
        className ?? "h-[calc(100vh-11rem)]",
      )}
    >
      <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
        <div>
          <p className="font-display text-sm font-semibold text-ink">{t("GAT Assistant")}</p>
          <p className="text-xs text-muted">{t("Ask about admissions, academics, facilities, or navigation")}</p>
        </div>
        <div className="flex items-center gap-1">
          {ttsSupported && (
            <button
              type="button"
              onClick={toggleVoice}
              aria-pressed={voiceEnabled}
              aria-label={t("Read answers aloud")}
              title={t("Read answers aloud")}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                voiceEnabled ? "bg-brand/10 text-brand" : "text-muted hover:bg-brand/5 hover:text-brand",
              )}
            >
              {voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              stop();
              speakingMessageIdRef.current = null;
              clearMessages();
            }}
            aria-label={t("Clear conversation")}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-brand/5 hover:text-brand"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label={t("Close")}
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-brand/5 hover:text-brand"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
        {messages.map((message) => (
          <ChatMessageBubble
            key={message.id}
            message={message}
            isSpeaking={isSpeaking && speakingMessageIdRef.current === message.id}
            onToggleSpeak={
              ttsSupported ? () => handleToggleSpeak(message.id, message.content) : undefined
            }
          />
        ))}
        {isAssistantTyping && <TypingIndicator />}
      </div>

      <div className="border-t border-hairline p-4">
        <ChatInput onSend={sendMessage} disabled={isAssistantTyping} />
      </div>
    </div>
  );
}
