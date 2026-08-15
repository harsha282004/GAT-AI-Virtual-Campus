"use client";

import { Mic, SendHorizontal } from "lucide-react";
import type { FormEvent, PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useRef, useState } from "react";

import { useSpeechRecognition } from "@/hooks";
import { cn } from "@/utils";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

// A quick tap (press+release faster than this) switches into hands-free
// "listening until tapped again" mode instead of stopping immediately —
// press-and-hold stays the primary interaction, but a fast tap is easier
// on mobile where holding a button down is awkward (Section 5).
const TAP_TOGGLE_THRESHOLD_MS = 350;
// How long the transcribed text stays visible in the input before it's
// auto-submitted — long enough for the user to see what was heard
// (Section 4's "resulting text should appear in the chatbot input")
// before it goes to the existing send path.
const AUTO_SEND_DELAY_MS = 350;

export function ChatInput({ onSend, disabled = false }: ChatInputProps) {
  const [value, setValue] = useState("");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const pressStartRef = useRef<number | null>(null);
  const toggleModeRef = useRef(false);

  // Voice only ever converts speech -> text. The transcript is fed into
  // the exact same onSend() the text form below uses — it never talks to
  // the AI backend on its own (Section 6).
  const handleResult = useCallback(
    (transcript: string) => {
      setVoiceError(null);
      setValue(transcript);
      setIsProcessing(true);
      window.setTimeout(() => {
        onSend(transcript);
        setValue("");
        setIsProcessing(false);
      }, AUTO_SEND_DELAY_MS);
    },
    [onSend],
  );

  const handleVoiceError = useCallback((message: string) => {
    setVoiceError(message);
    setIsProcessing(false);
  }, []);

  const { isSupported, status, start, stop } = useSpeechRecognition({
    onResult: handleResult,
    onError: handleVoiceError,
  });
  const isListening = status === "listening";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  }

  function handleMicPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (disabled || !isSupported) return;

    if (toggleModeRef.current) {
      toggleModeRef.current = false;
      stop();
      return;
    }
    setVoiceError(null);
    pressStartRef.current = Date.now();
    start();
  }

  function handleMicPointerUp() {
    if (disabled || !isSupported) return;
    const startedAt = pressStartRef.current;
    pressStartRef.current = null;
    if (startedAt === null) return;

    if (Date.now() - startedAt < TAP_TOGGLE_THRESHOLD_MS) {
      // Quick tap — keep listening hands-free until tapped again.
      toggleModeRef.current = true;
      return;
    }
    stop();
  }

  function handleMicPointerLeave() {
    if (toggleModeRef.current) return;
    if (pressStartRef.current !== null) {
      pressStartRef.current = null;
      stop();
    }
  }

  const micTitle = !isSupported
    ? "Voice input isn't supported in this browser"
    : isListening
      ? "Release to stop listening"
      : "Press and hold, or tap, to ask by voice";

  return (
    <div className="flex flex-col gap-1.5">
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 rounded-2xl border border-hairline bg-white p-2 transition-shadow duration-300 focus-within:border-brand/40 focus-within:shadow-glow dark:bg-[#0F172A]"
      >
        <button
          type="button"
          onPointerDown={handleMicPointerDown}
          onPointerUp={handleMicPointerUp}
          onPointerLeave={handleMicPointerLeave}
          disabled={disabled || !isSupported}
          title={micTitle}
          aria-label={isListening ? "Stop voice input" : "Start voice input"}
          aria-pressed={isListening}
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
            !isSupported && "cursor-not-allowed text-ink/25",
            isSupported && !isListening && "text-ink/60 hover:bg-brand/5 hover:text-brand",
            isListening && "animate-pulse bg-red-500 text-white hover:bg-red-500",
          )}
        >
          <Mic className="h-4 w-4" />
        </button>

        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={
            isListening
              ? "Listening…"
              : isProcessing
                ? "Processing…"
                : "Ask about admissions, academics, facilities…"
          }
          className="flex-1 bg-transparent px-1 text-sm text-ink placeholder:text-muted focus:outline-none"
        />

        <button
          type="submit"
          disabled={!value.trim() || disabled}
          aria-label="Send message"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-40"
        >
          <SendHorizontal className="h-4 w-4" />
        </button>
      </form>

      {voiceError && (
        <p role="alert" className="px-2 text-xs text-red-600 dark:text-red-400">
          {voiceError}
        </p>
      )}
    </div>
  );
}
