"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseSpeechSynthesisOptions {
  /** BCP-47 tag, e.g. "en-IN" / "kn-IN" / "hi-IN" — see lib/i18n/translations.ts SPEECH_LANG. */
  lang?: string;
}

// Regional preference, checked in order, when multiple voices share the
// same base language — e.g. for English, an en-IN voice (if the system
// has one) reads more naturally for this India-based project than a
// generic en-US one, but any en-* voice is still accepted.
const REGIONAL_PREFERENCE: Record<string, string[]> = {
  en: ["en-in", "en-us", "en-gb"],
  hi: ["hi-in"],
  kn: ["kn-in"],
};

/** Ranks a candidate voice already known to match the target base
 * language — never used to reject a voice, only to pick the best among
 * several real matches. Never assumes a specific voice NAME exists. */
function scoreVoice(voice: SpeechSynthesisVoice, targetLang: string): number {
  const voiceLang = voice.lang.toLowerCase();
  const base = targetLang.split("-")[0]?.toLowerCase() ?? targetLang.toLowerCase();
  let score = 0;

  if (voiceLang === targetLang.toLowerCase()) score += 100;
  const preference = REGIONAL_PREFERENCE[base] ?? [];
  const preferenceRank = preference.indexOf(voiceLang);
  if (preferenceRank !== -1) score += 30 - preferenceRank * 5;

  // Network/cloud voices (Chrome's "Google ..." voices, Edge's "Online
  // (Natural) ..." voices) are consistently less robotic than local OS
  // SAPI voices — prefer them when available, but never require them.
  if (voice.localService === false) score += 25;
  if (/natural|neural|online|wavenet|premium|enhanced/i.test(voice.name)) score += 15;
  if (voice.default) score += 5;
  return score;
}

function pickBestVoice(voices: SpeechSynthesisVoice[], targetLang: string): SpeechSynthesisVoice | null {
  const base = targetLang.split("-")[0]?.toLowerCase();
  const candidates = voices.filter((v) => v.lang.toLowerCase().startsWith(base ?? targetLang));
  if (!candidates.length) return null;
  return candidates.reduce((best, current) =>
    scoreVoice(current, targetLang) > scoreVoice(best, targetLang) ? current : best,
  );
}

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

function loadVoicesAsync(): Promise<SpeechSynthesisVoice[]> {
  const existing = window.speechSynthesis.getVoices();
  if (existing.length > 0) return Promise.resolve(existing);
  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => resolve(window.speechSynthesis.getVoices()), 1000);
    window.speechSynthesis.addEventListener(
      "voiceschanged",
      () => {
        window.clearTimeout(timeout);
        resolve(window.speechSynthesis.getVoices());
      },
      { once: true },
    );
  });
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
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const queueRef = useRef<string[]>([]);
  const speakTokenRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    setIsSupported(true);

    const loadVoices = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
    };
    loadVoices();
    // Chrome loads voices asynchronously — the list is often empty on the
    // first call, populated once this event fires.
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
  }, []);

  const stop = useCallback(() => {
    speakTokenRef.current += 1; // invalidate any in-flight async speak()/chunk chain
    queueRef.current = [];
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  const speakNextChunk = useCallback((token: number, voice: SpeechSynthesisVoice | null, targetLang: string) => {
    if (token !== speakTokenRef.current) return; // superseded by a newer speak()/stop()
    const next = queueRef.current.shift();
    if (next === undefined) {
      setIsSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(next);
    utterance.lang = targetLang;
    if (voice) utterance.voice = voice;
    // Slightly under natural conversational pace and unmodified pitch/
    // volume reads as measured rather than rushed or robotic-fast, without
    // being so slow it sounds unnatural either way.
    utterance.rate = 0.97;
    utterance.pitch = 1;
    utterance.volume = 1;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => speakNextChunk(token, voice, targetLang);
    utterance.onerror = () => {
      if (token !== speakTokenRef.current) return;
      queueRef.current = [];
      setIsSpeaking(false);
    };

    window.speechSynthesis.speak(utterance);
  }, []);

  const speak = useCallback(
    (text: string, options?: { lang?: string }) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
      const cleaned = cleanTextForSpeech(text);
      if (!cleaned) return;

      // Always stop previous speech before starting a new answer — never
      // overlap, never queue up multiple answers.
      window.speechSynthesis.cancel();
      const token = ++speakTokenRef.current;
      const targetLang = options?.lang ?? lang;
      queueRef.current = splitIntoSpeechChunks(cleaned);

      void loadVoicesAsync().then((voices) => {
        if (token !== speakTokenRef.current) return; // a newer speak()/stop() already won
        voicesRef.current = voices;
        const voice = pickBestVoice(voices, targetLang);
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
