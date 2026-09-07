"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  classifyGender,
  findStoredVoice,
  selectPreferredVoice,
  type StoredVoiceRef,
} from "./voiceSelection";

interface UseSpeechSynthesisOptions {
  /** BCP-47 tag, e.g. "en-IN" / "kn-IN" / "hi-IN" — see lib/i18n/translations.ts SPEECH_LANG. */
  lang?: string;
}

const isDev = process.env.NODE_ENV !== "production";

/** Strips markdown/formatting/citation artifacts the RAG answer may
 * contain so speech doesn't read out literal asterisks, links, etc. Only
 * affects what's SPOKEN — the displayed chat bubble text is never touched
 * (callers pass the original message.content straight through; cleaning
 * happens internally, right before synthesis). */
function cleanTextForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ") // fenced code blocks
    .replace(/`([^`]+)`/g, "$1") // inline code
    .replace(/\[([^\]]+)\]\((?:[^)]+)\)/g, "$1") // [label](url) -> label
    .replace(/\[\d+\]/g, "") // citation markers like [1]
    .replace(/https?:\/\/\S+/g, "") // bare URLs
    .replace(/(\*\*\*|\*\*|\*|__|_)/g, "") // bold/italic markers
    .replace(/^\s{0,3}#{1,6}\s+/gm, "") // markdown headings
    .replace(/^\s*[-•*]\s+/gm, "") // bullet markers
    .replace(/^\s*\d+[.)]\s+/gm, "") // numbered list markers
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "") // emoji
    .replace(/([!?.,])\1{1,}/g, "$1") // excessive punctuation
    .replace(/\s+/g, " ")
    .trim();
}

/** Splits cleaned text on sentence boundaries and regroups into
 * moderate-length chunks. Speaking one utterance per sentence (rather
 * than one giant utterance) gives more natural pacing/intonation and
 * avoids the long-utterance stalls some browsers' speechSynthesis has
 * with very long single utterances. */
function splitIntoSpeechChunks(text: string): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) ?? [text];
  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if (current && (current + sentence).length > 220) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current += sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length ? chunks : [text];
}

/**
 * Robustly wait for the OS/browser voice list to be fully populated.
 *
 * `speechSynthesis.getVoices()` is empty on the first call in Chrome/Edge
 * and is filled asynchronously: local voices appear first, then cloud
 * "Natural"/"Online" voices a beat later. Resolving too early (the old
 * 1000ms hard timeout) meant the one-time deterministic selection
 * sometimes ran against a partial list. This waits until the list has any
 * voices AND has stopped growing (or a 4s cap), so the selection sees the
 * complete set — every time.
 */
async function waitForVoices(): Promise<SpeechSynthesisVoice[]> {
  const synth = window.speechSynthesis;
  const deadline = Date.now() + 4000;

  let voices = synth.getVoices();
  while (voices.length === 0 && Date.now() < deadline) {
    await new Promise<void>((resolve) => window.setTimeout(resolve, 100));
    voices = synth.getVoices();
  }

  // Let the list settle so late cloud voices are included in the pick.
  let stableTicks = 0;
  let prevLength = voices.length;
  while (stableTicks < 3 && Date.now() < deadline) {
    await new Promise<void>((resolve) => window.setTimeout(resolve, 120));
    const now = synth.getVoices();
    if (now.length === prevLength) {
      stableTicks += 1;
    } else {
      stableTicks = 0;
      prevLength = now.length;
    }
    voices = now;
  }
  return voices;
}

// --------------------------------------------------------------------------
// Deterministic voice resolution — selected ONCE per language per page
// session and reused for every utterance (the greeting AND every answer),
// persisted to localStorage so the same voice is restored on later visits.
// --------------------------------------------------------------------------

const STORE_PREFIX = "gat-tts-voice:";

/** Module-level, so the choice survives component remounts within the same
 * page load (FloatingAssistant and the /chat page each mount this hook). */
const sessionVoiceCache = new Map<string, SpeechSynthesisVoice>();
let devVoiceLogDone = false;

function baseLang(targetLang: string): string {
  return targetLang.split("-")[0]?.toLowerCase() ?? "en";
}

function readStoredVoice(base: string): StoredVoiceRef | null {
  try {
    const raw = window.localStorage.getItem(STORE_PREFIX + base);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredVoiceRef>;
    if (
      typeof parsed.voiceURI === "string" &&
      typeof parsed.name === "string" &&
      typeof parsed.lang === "string"
    ) {
      return { voiceURI: parsed.voiceURI, name: parsed.name, lang: parsed.lang };
    }
    return null;
  } catch {
    // Private mode / disabled storage / malformed JSON — non-fatal, the
    // session cache still keeps the choice consistent within this visit.
    return null;
  }
}

function writeStoredVoice(base: string, voice: SpeechSynthesisVoice): void {
  try {
    window.localStorage.setItem(
      STORE_PREFIX + base,
      JSON.stringify({ voiceURI: voice.voiceURI, name: voice.name, lang: voice.lang }),
    );
  } catch {
    // Quota / private mode — ignore; session cache covers this visit.
  }
}

function devLogVoices(voices: SpeechSynthesisVoice[], chosen: SpeechSynthesisVoice | null, base: string): void {
  if (!isDev || devVoiceLogDone) return;
  devVoiceLogDone = true;
  try {
    console.groupCollapsed(`[TTS] voice selection (${base}) — ${voices.length} voice(s) available`);
    console.table(
      voices.map((v) => ({
        name: v.name,
        lang: v.lang,
        default: v.default,
        localService: v.localService,
        gender: classifyGender(v),
      })),
    );
    console.log("[TTS] selected:", chosen ? `${chosen.name} (${chosen.lang})` : "browser default");
    console.groupEnd();
  } catch {
    // console.table may be unavailable in some environments — ignore.
  }
}

/**
 * Resolve the voice to use for `targetLang`. Order:
 *   1. this session's already-picked voice, if still installed;
 *   2. the voice persisted from a previous visit, if still installed;
 *   3. a fresh deterministic pick (voiceSelection.selectPreferredVoice).
 * The result is cached (session + localStorage) so it never changes again
 * for this language during the session, and is restored next visit.
 */
async function resolveVoice(targetLang: string): Promise<SpeechSynthesisVoice | null> {
  const synth = window.speechSynthesis;
  const base = baseLang(targetLang);

  const cached = sessionVoiceCache.get(base);
  if (cached && synth.getVoices().some((v) => v.voiceURI === cached.voiceURI)) {
    return cached;
  }

  const voices = await waitForVoices();
  if (voices.length === 0) return null;

  const stored = readStoredVoice(base);
  const restored = findStoredVoice(voices, stored);

  let chosen: SpeechSynthesisVoice | null;
  if (restored) {
    // The voice chosen on a previous visit is still installed — reuse it
    // verbatim and do NOT re-persist, so the remembered choice is stable.
    chosen = restored;
  } else {
    chosen = selectPreferredVoice(voices, targetLang);
    // Persist only when there is no remembered choice yet. If a remembered
    // voice is merely absent right now (e.g. a cloud voice that failed to
    // load this once), keep the record so it is restored when it returns —
    // this session just uses the deterministic fallback instead.
    if (chosen && !stored) writeStoredVoice(base, chosen);
  }

  if (chosen) sessionVoiceCache.set(base, chosen);
  devLogVoices(voices, chosen, base);
  return chosen;
}

/** Thin wrapper around the browser-native Web Speech Synthesis API
 * (window.speechSynthesis / SpeechSynthesisUtterance) — no external TTS
 * service, matching the existing STT hook's "browser-native, no
 * server-side voice cost" decision (CLAUDE.md Phase 4). Only ever speaks
 * text the caller explicitly passes to speak() — never the user's
 * question, never interim transcripts, never loading/error text; that
 * policy lives in the caller (ChatWindow.tsx), not here. */
export function useSpeechSynthesis({ lang = "en-IN" }: UseSpeechSynthesisOptions = {}) {
  const [isSupported, setIsSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const queueRef = useRef<string[]>([]);
  const speakTokenRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    setIsSupported(true);

    // Warm the deterministic voice cache ahead of the first speak() (e.g.
    // the auto-spoken greeting) so that call doesn't pay the async
    // voice-loading wait inline. This is pure resolution — it reads the
    // voice list and picks one, it never starts speech, so it cannot
    // cause a duplicate greeting.
    void resolveVoice(lang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stop = useCallback(() => {
    speakTokenRef.current += 1; // invalidate any in-flight async speak()/chunk chain
    queueRef.current = [];
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  const speakNextChunk = useCallback(
    (token: number, voice: SpeechSynthesisVoice | null, targetLang: string) => {
      if (token !== speakTokenRef.current) return; // superseded by a newer speak()/stop()
      const next = queueRef.current.shift();
      if (next === undefined) {
        setIsSpeaking(false);
        return;
      }

      const utterance = new SpeechSynthesisUtterance(next);
      // Align the utterance language with the CHOSEN voice's own locale
      // (for English that is en-US, from the deterministic pick) so the
      // engine renders that voice instead of substituting another for a
      // mismatched lang tag.
      utterance.lang = voice?.lang ?? targetLang;
      if (voice) utterance.voice = voice;
      // Just under natural conversational pace; a slightly-lowered pitch
      // reads as a calm, professional male assistant without sounding
      // artificial. All within the 0.9–1.0 range.
      utterance.rate = 0.97;
      utterance.pitch = 0.95;
      utterance.volume = 1;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => speakNextChunk(token, voice, targetLang);
      utterance.onerror = () => {
        if (token !== speakTokenRef.current) return;
        queueRef.current = [];
        setIsSpeaking(false);
      };

      window.speechSynthesis.speak(utterance);
    },
    [],
  );

  const speak = useCallback(
    (text: string, options?: { lang?: string }) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
      const cleaned = cleanTextForSpeech(text);
      if (!cleaned) return;

      // Always stop previous speech before starting a new answer — never
      // overlap, never queue up multiple answers. The token bump below
      // also makes any StrictMode/re-render double-call collapse to one.
      window.speechSynthesis.cancel();
      const token = ++speakTokenRef.current;
      const targetLang = options?.lang ?? lang;
      queueRef.current = splitIntoSpeechChunks(cleaned);

      void resolveVoice(targetLang).then((voice) => {
        if (token !== speakTokenRef.current) return; // a newer speak()/stop() already won
        speakNextChunk(token, voice, targetLang);
      });
    },
    [lang, speakNextChunk],
  );

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return { isSupported, isSpeaking, speak, stop };
}
