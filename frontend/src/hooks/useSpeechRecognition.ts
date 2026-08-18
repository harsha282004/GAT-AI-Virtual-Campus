"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type MicRecordingStatus = "idle" | "listening";

interface SpeechRecognitionResultAlternativeLike {
  readonly transcript: string;
}

interface SpeechRecognitionResultLike {
  readonly length: number;
  readonly isFinal: boolean;
  [index: number]: SpeechRecognitionResultAlternativeLike;
}

interface SpeechRecognitionEventLike extends Event {
  readonly resultIndex: number;
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

/** Classifies getUserMedia()'s DOMException into the same message
 * vocabulary as describeSpeechError, but from an actual mic-acquisition
 * probe rather than SpeechRecognition's own (coarser, sometimes
 * misleading) error codes. This is what actually distinguishes "user
 * denied permission" from "no microphone hardware exists" from "a
 * microphone exists but the OS/browser can't currently open it" (e.g. the
 * system's default recording device is set to a disconnected Bluetooth
 * headset) — three different problems the SpeechRecognition API alone
 * often collapses into one unhelpful "not-allowed"/"audio-capture" code. */
function describeMediaError(name: string): string {
  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
    case "SecurityError":
      return "Microphone access was denied. Allow microphone permission to use voice input.";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "No microphone was found on this device.";
    case "NotReadableError":
    case "TrackStartError":
      return "Your microphone couldn't be started — it may be in use by another app, or your system's default input device isn't available (e.g. set to a disconnected Bluetooth headset). Check your sound settings and try again.";
    default:
      return "Voice input couldn't be processed. Please try typing your question instead.";
  }
}

// Hard safety cap so a stuck recognition session (platform backend never
// calls back) can't strand the mic button in "listening" forever.
const MAX_LISTEN_DURATION_MS = 25_000;
// How long to wait for the user to start speaking at all before giving up.
const INITIAL_SILENCE_MS = 7_000;
// How long a pause AFTER speech has started is treated as "finished
// speaking" and auto-stops the session. Generous on purpose — short
// enough not to make the user wait, long enough to survive a natural
// mid-sentence pause (e.g. "Where is the CSE department... and what floor
// is it on?") without cutting the question off early.
const POST_SPEECH_SILENCE_MS = 3_000;

interface UseSpeechRecognitionOptions {
  /** Called ONCE with the complete final transcript when the user has
   * finished speaking. This hook only ever converts speech to text — the
   * caller is responsible for feeding the transcript into the existing
   * chat send path (see ChatInput.tsx), never for generating an answer
   * itself. */
  onResult: (transcript: string) => void;
  /** Optional live partial transcript, fired repeatedly while the user is
   * still speaking — for UI preview only, never submitted. */
  onInterimResult?: (transcript: string) => void;
  onError?: (message: string) => void;
  lang?: string;
}

/** Thin wrapper around the browser-native Web Speech API (SpeechRecognition
 * / webkitSpeechRecognition) — no server-side voice cost, per CLAUDE.md's
 * Phase 4 decision.
 *
 * continuous + interimResults are both enabled so a brief mid-sentence
 * pause doesn't end the session early (the single most common cause of a
 * question being submitted incomplete) — final transcript pieces are
 * accumulated across the whole session and only ever submitted once, when
 * recognition actually ends (either the user releases the mic control, a
 * silence timeout decides they're done, or the hard MAX_LISTEN_DURATION_MS
 * cap is hit). */
export function useSpeechRecognition({
  onResult,
  onInterimResult,
  onError,
  lang = "en-US",
}: UseSpeechRecognitionOptions) {
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
  const maxTimeoutRef = useRef<number | null>(null);
  const silenceTimeoutRef = useRef<number | null>(null);
  const finalTranscriptRef = useRef("");
  const terminalHandledRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (maxTimeoutRef.current !== null) {
      window.clearTimeout(maxTimeoutRef.current);
      maxTimeoutRef.current = null;
    }
    if (silenceTimeoutRef.current !== null) {
      window.clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
  }, []);

  const submitOnce = useCallback(
    (transcript: string) => {
      const trimmed = transcript.trim();
      if (!trimmed) {
        onError?.("No speech detected. Please try again.");
        return;
      }
      onResult(trimmed);
    },
    [onResult, onError],
  );

  const start = useCallback(async () => {
    if (status === "listening") return;

    const Ctor = getSpeechRecognitionConstructor();
    if (!Ctor) {
      onError?.("Voice input isn't supported in this browser.");
      return;
    }

    // Preflight mic acquisition (audio only — never requests camera) so we
    // can tell the user exactly what's wrong (permission vs missing
    // hardware vs a device that's currently unreachable) instead of
    // relying solely on SpeechRecognition's own coarser error codes. This
    // never pins a specific deviceId — { audio: true } always resolves to
    // whatever the browser/OS currently considers the default input
    // device (the laptop's built-in mic, unless the OS default has been
    // pointed elsewhere), so it can't be the source of a "wrong device"
    // bug on its own.
    if (navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
      } catch (err) {
        const name = err instanceof DOMException ? err.name : "";
        onError?.(describeMediaError(name));
        setStatus("idle");
        return;
      }
    }

    finalTranscriptRef.current = "";
    terminalHandledRef.current = false;

    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    const armSilenceTimer = (ms: number) => {
      if (silenceTimeoutRef.current !== null) window.clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = window.setTimeout(() => {
        silenceTimeoutRef.current = null;
        recognition.stop();
      }, ms);
    };

    recognition.onresult = (event) => {
      let interim = "";
      const startIndex = event.resultIndex ?? 0;
      for (let i = startIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const piece = result?.[0]?.transcript ?? "";
        if (result?.isFinal) {
          finalTranscriptRef.current = `${finalTranscriptRef.current} ${piece}`.trim();
        } else {
          interim += piece;
        }
      }
      if (interim) onInterimResult?.(interim);
      armSilenceTimer(POST_SPEECH_SILENCE_MS);
    };

    recognition.onerror = (event) => {
      terminalHandledRef.current = true;
      clearTimers();
      if (finalTranscriptRef.current.trim()) {
        // Recognition ended unexpectedly but real speech was already
        // captured — submit what we have rather than discarding it.
        submitOnce(finalTranscriptRef.current);
      } else {
        const message = describeSpeechError(event.error);
        if (message) onError?.(message);
      }
      setStatus("idle");
    };

    recognition.onend = () => {
      clearTimers();
      recognitionRef.current = null;
      setStatus("idle");
      if (terminalHandledRef.current) return; // onerror already handled this session
      submitOnce(finalTranscriptRef.current);
    };

    try {
      recognitionRef.current = recognition;
      setStatus("listening");
      recognition.start();
      armSilenceTimer(INITIAL_SILENCE_MS);
      maxTimeoutRef.current = window.setTimeout(() => {
        maxTimeoutRef.current = null;
        recognition.stop();
      }, MAX_LISTEN_DURATION_MS);
    } catch {
      recognitionRef.current = null;
      setStatus("idle");
      onError?.("Couldn't start voice input. Please try again.");
    }
  }, [status, onInterimResult, onError, lang, clearTimers, submitOnce]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  useEffect(() => {
    return () => {
      // Never leave the microphone active past this component's lifetime.
      clearTimers();
      terminalHandledRef.current = true;
      recognitionRef.current?.abort();
    };
  }, [clearTimers]);

  return { isSupported, status, start, stop };
}
