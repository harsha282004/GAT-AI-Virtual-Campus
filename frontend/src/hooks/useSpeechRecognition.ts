"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type MicRecordingStatus = "idle" | "listening";

interface SpeechRecognitionResultAlternativeLike {
  readonly transcript: string;
}

interface SpeechRecognitionResultLike {
  readonly length: number;
  [index: number]: SpeechRecognitionResultAlternativeLike;
}

interface SpeechRecognitionEventLike extends Event {
  readonly results: {
    readonly length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}

interface SpeechRecognitionErrorEventLike extends Event {
  readonly error: string;
}

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const globalWindow = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return globalWindow.SpeechRecognition ?? globalWindow.webkitSpeechRecognition ?? null;
}

/** Maps the Web Speech API's error codes to a user-friendly message.
 * "aborted" fires whenever recognition is stopped programmatically (e.g.
 * our own stop()/abort() calls) — that is normal control flow, not a
 * failure, so it deliberately returns null (no message shown). */
function describeSpeechError(code: string): string | null {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access was denied. Allow microphone permission to use voice input.";
    case "no-speech":
      return "No speech detected. Please try again.";
    case "audio-capture":
      return "No microphone was found on this device.";
    case "network":
      return "A network error interrupted voice recognition. Please try again.";
    case "aborted":
      return null;
    default:
      return "Voice input couldn't be processed. Please try typing your question instead.";
  }
}

// Upper bound on how long a single recording session may stay "listening"
// without the browser ever calling onresult/onerror/onend — guards
// against a stuck mic (Section 8's "recognition timeout") if the
// platform's recognition backend never calls back, so the button can't
// get stranded in a listening state forever.
const MAX_LISTEN_DURATION_MS = 15_000;

interface UseSpeechRecognitionOptions {
  /** Called with the final transcript once recognition succeeds. This
   * hook only ever converts speech to text — the caller is responsible
   * for feeding the transcript into the existing chat send path (see
   * ChatInput.tsx), never for generating an answer itself. */
  onResult: (transcript: string) => void;
  onError?: (message: string) => void;
  lang?: string;
}

/** Thin wrapper around the browser-native Web Speech API (SpeechRecognition
 * / webkitSpeechRecognition) — no server-side voice cost, per CLAUDE.md's
 * Phase 4 decision. Recognition is single-utterance (continuous: false)
 * and only ever active between an explicit start() and stop()/onend —
 * never a background/always-on listener. */
export function useSpeechRecognition({ onResult, onError, lang = "en-US" }: UseSpeechRecognitionOptions) {
  const [status, setStatus] = useState<MicRecordingStatus>("idle");
  // Feature detection must happen post-mount, not in a useState initializer
  // — that initializer also runs during SSR (where `window` doesn't exist,
  // so it would always resolve to false), producing server/client-rendered
  // HTML that disagrees on the mic button's disabled/title attributes and
  // triggering a hydration mismatch. Same pattern as Navbar.tsx's
  // `mounted` flag for its theme toggle.
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported(getSpeechRecognitionConstructor() !== null);
  }, []);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const clearListenTimeout = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    if (status === "listening") return;

    const Ctor = getSpeechRecognitionConstructor();
    if (!Ctor) {
      onError?.("Voice input isn't supported in this browser.");
      return;
    }

    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      clearListenTimeout();
      const lastIndex = event.results.length - 1;
      const transcript = event.results[lastIndex]?.[0]?.transcript?.trim() ?? "";
      if (transcript) {
        onResult(transcript);
      } else {
        onError?.("No speech detected. Please try again.");
      }
    };

    recognition.onerror = (event) => {
      clearListenTimeout();
      const message = describeSpeechError(event.error);
      if (message) onError?.(message);
      setStatus("idle");
    };

    recognition.onend = () => {
      clearListenTimeout();
      recognitionRef.current = null;
      setStatus("idle");
    };

    try {
      recognitionRef.current = recognition;
      setStatus("listening");
      recognition.start();
      timeoutRef.current = window.setTimeout(() => {
        timeoutRef.current = null;
        recognition.abort();
        onError?.("Voice input timed out. Please try again.");
        setStatus("idle");
      }, MAX_LISTEN_DURATION_MS);
    } catch {
      recognitionRef.current = null;
      setStatus("idle");
      onError?.("Couldn't start voice input. Please try again.");
    }
  }, [status, onResult, onError, lang, clearListenTimeout]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  useEffect(() => {
    return () => {
      // Never leave the microphone active past this component's lifetime.
      clearListenTimeout();
      recognitionRef.current?.abort();
    };
  }, [clearListenTimeout]);

  return { isSupported, status, start, stop };
}
