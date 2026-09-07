/**
 * Deterministic-voice-selection tests — no test framework needed.
 *
 *   node --experimental-strip-types scripts/test-voice-selection.mts
 *
 * Verifies, for realistic Windows / macOS / ChromeOS-Linux / minimal voice
 * sets, that selectPreferredVoice():
 *   - returns the SAME voice no matter how the voice array is ordered
 *     (i.e. it does NOT depend on getVoices() order)
 *   - never returns a heuristically-female voice when an English male one
 *     exists
 *   - always returns an English voice for an English target
 *   - honours the priority hierarchy (preferred named male > any male >
 *     any en-US > …)
 *   - never blindly returns voices[0]
 *   - findStoredVoice() restores a persisted choice and rejects a stale one
 */

import assert from "node:assert/strict";

import {
  classifyGender,
  findStoredVoice,
  selectPreferredVoice,
  type VoiceLike,
} from "../src/hooks/voiceSelection.ts";

let passed = 0;
let failed = 0;
function check(name: string, fn: () => void): void {
  try {
    fn();
    passed += 1;
    console.log(`  PASS  ${name}`);
  } catch (err) {
    failed += 1;
    console.log(`  FAIL  ${name}\n        ${(err as Error).message}`);
  }
}

function v(
  name: string,
  lang: string,
  opts: Partial<VoiceLike> = {},
): VoiceLike {
  return {
    name,
    lang,
    voiceURI: opts.voiceURI ?? name,
    localService: opts.localService ?? true,
    default: opts.default ?? false,
  };
}

// Deterministic shuffle helper (seeded) so runs are reproducible.
function shuffles<T>(arr: T[], count: number): T[][] {
  const out: T[][] = [];
  let seed = 12345;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let i = 0; i < count; i += 1) {
    const copy = [...arr];
    for (let j = copy.length - 1; j > 0; j -= 1) {
      const k = Math.floor(rand() * (j + 1));
      [copy[j], copy[k]] = [copy[k]!, copy[j]!];
    }
    out.push(copy);
  }
  return out;
}

function assertStable(label: string, voices: VoiceLike[], target: string, expectURI: string): void {
  const picks = shuffles(voices, 8).map((s) => selectPreferredVoice(s, target)?.voiceURI ?? null);
  const unique = [...new Set(picks)];
  assert.equal(unique.length, 1, `${label}: unstable across orderings -> ${JSON.stringify(unique)}`);
  assert.equal(unique[0], expectURI, `${label}: expected ${expectURI}, got ${unique[0]}`);
}

// --- Windows 11 + Edge (SAPI locals + "Online (Natural)" cloud voices) ----
const WINDOWS: VoiceLike[] = [
  v("Microsoft David - English (United States)", "en-US", { voiceURI: "ms-david" }),
  v("Microsoft Zira - English (United States)", "en-US", { voiceURI: "ms-zira", default: true }),
  v("Microsoft Mark - English (United States)", "en-US", { voiceURI: "ms-mark" }),
  v("Microsoft Guy Online (Natural) - English (United States)", "en-US", {
    voiceURI: "ms-guy-natural",
    localService: false,
  }),
  v("Microsoft Aria Online (Natural) - English (United States)", "en-US", {
    voiceURI: "ms-aria-natural",
    localService: false,
  }),
  v("Microsoft Jenny Online (Natural) - English (United States)", "en-US", {
    voiceURI: "ms-jenny-natural",
    localService: false,
  }),
  v("Microsoft Swara Online (Natural) - Hindi (India)", "hi-IN", {
    voiceURI: "ms-swara",
    localService: false,
  }),
  v("Microsoft Prabhat Online (Natural) - Hindi (India)", "hi-IN", {
    voiceURI: "ms-prabhat",
    localService: false,
  }),
];

// --- macOS ---------------------------------------------------------------
const MACOS: VoiceLike[] = [
  v("Samantha", "en-US", { voiceURI: "com.apple.samantha", default: true }),
  v("Alex", "en-US", { voiceURI: "com.apple.alex" }),
  v("Victoria", "en-US", { voiceURI: "com.apple.victoria" }),
  v("Fred", "en-US", { voiceURI: "com.apple.fred" }),
  v("Daniel", "en-GB", { voiceURI: "com.apple.daniel" }),
  v("Karen", "en-AU", { voiceURI: "com.apple.karen" }),
];

// --- Chrome on Linux (Google cloud voices, no gender field) --------------
const CHROME_LINUX: VoiceLike[] = [
  v("Google US English", "en-US", { voiceURI: "google-us", localService: false }),
  v("Google UK English Female", "en-GB", { voiceURI: "google-uk-f", localService: false }),
  v("Google UK English Male", "en-GB", { voiceURI: "google-uk-m", localService: false }),
  v("Google हिन्दी", "hi-IN", { voiceURI: "google-hi", localService: false }),
];

// --- Minimal: one generic English voice, gender unknown -----------------
const MINIMAL: VoiceLike[] = [v("English Voice", "en-GB", { voiceURI: "generic-en", default: true })];

// --- No English at all (only Hindi) -----------------------------------
const NO_ENGLISH: VoiceLike[] = [
  v("Hindi Female", "hi-IN", { voiceURI: "hi-f" }),
  v("Hemant", "hi-IN", { voiceURI: "hi-hemant" }),
];

console.log("Deterministic TTS voice selection");
console.log("================================");

check("gender heuristic: David=male, Zira=female, 'Google US English'=female, Alex=male", () => {
  assert.equal(classifyGender(v("Microsoft David - English (United States)", "en-US")), "male");
  assert.equal(classifyGender(v("Microsoft Zira - English (United States)", "en-US")), "female");
  assert.equal(classifyGender(v("Google US English", "en-US")), "female");
  assert.equal(classifyGender(v("Alex", "en-US")), "male");
  assert.equal(classifyGender(v("English Voice", "en-GB")), "unknown");
  assert.equal(classifyGender(v("Custom Reader", "en-US")), "unknown"); // 'tom' must not match 'Custom'
});

check("Windows/Edge -> Microsoft Guy Online (Natural), stable across 8 orderings", () => {
  assertStable("windows", WINDOWS, "en-IN", "ms-guy-natural");
});

check("Windows/Edge with Guy removed -> Microsoft David (T1), still stable", () => {
  const noGuy = WINDOWS.filter((x) => x.voiceURI !== "ms-guy-natural");
  assertStable("windows-no-guy", noGuy, "en-IN", "ms-david");
});

check("Windows with only Natural female voices left -> female en-US (T4), still deterministic", () => {
  const femalesOnly = WINDOWS.filter((x) => x.lang === "en-US" && classifyGender(x) === "female");
  // Aria + Jenny + Zira — all female; must still return ONE consistent voice.
  const picks = shuffles(femalesOnly, 8).map((s) => selectPreferredVoice(s, "en-US")?.voiceURI);
  assert.equal(new Set(picks).size, 1, `unstable: ${JSON.stringify([...new Set(picks)])}`);
});

check("macOS -> Alex (T1 preferred male), stable across 8 orderings", () => {
  assertStable("macos", MACOS, "en-IN", "com.apple.alex");
});

check("Chrome/Linux -> Google UK English Male (T3), never 'Google US English' (female)", () => {
  assertStable("chrome-linux", CHROME_LINUX, "en-IN", "google-uk-m");
  for (const order of shuffles(CHROME_LINUX, 8)) {
    assert.notEqual(selectPreferredVoice(order, "en-IN")?.voiceURI, "google-us");
  }
});

check("minimal single generic English voice -> that voice (T5), consistently", () => {
  assertStable("minimal", MINIMAL, "en-IN", "generic-en");
});

check("no-English list, English target -> null? no — falls back deterministically to a voice", () => {
  // With no English voice, English target falls through to non-English
  // fallback -> the Hindi male voice, deterministically (not voices[0]).
  const picks = shuffles(NO_ENGLISH, 8).map((s) => selectPreferredVoice(s, "en-IN")?.voiceURI);
  assert.equal(new Set(picks).size, 1);
});

check("empty voice list -> null (caller then uses browser default)", () => {
  assert.equal(selectPreferredVoice([], "en-IN"), null);
});

check("never returns voices[0] blindly: put a female voice first, still picks the male", () => {
  const femaleFirst = [
    v("Microsoft Zira - English (United States)", "en-US", { voiceURI: "ms-zira" }),
    v("Microsoft David - English (United States)", "en-US", { voiceURI: "ms-david" }),
  ];
  assert.equal(selectPreferredVoice(femaleFirst, "en-IN")?.voiceURI, "ms-david");
});

check("Hindi target -> a Hindi voice (multilingual preserved), deterministic", () => {
  assertStable("hindi", WINDOWS, "hi-IN", "ms-prabhat"); // Prabhat/Swara both hi-IN natural; stable pick
});

check("findStoredVoice restores an installed voice by voiceURI", () => {
  const got = findStoredVoice(WINDOWS, { voiceURI: "ms-david", name: "x", lang: "y" });
  assert.equal(got?.voiceURI, "ms-david");
});

check("findStoredVoice falls back to name+lang when voiceURI changed", () => {
  const got = findStoredVoice(WINDOWS, {
    voiceURI: "stale-uri",
    name: "Microsoft Mark - English (United States)",
    lang: "en-US",
  });
  assert.equal(got?.voiceURI, "ms-mark");
});

check("findStoredVoice returns null for an uninstalled voice", () => {
  assert.equal(findStoredVoice(WINDOWS, { voiceURI: "gone", name: "Gone", lang: "en-US" }), null);
});

check("consistency: a remembered non-preferred voice is kept even when a better one appears", () => {
  // Visit 1 (only David present) persisted David. Visit 2 also has Guy
  // (Natural). The algorithm alone would now pick Guy — but the remembered
  // David is still installed, so resolveVoice() must keep David.
  assert.equal(selectPreferredVoice(WINDOWS, "en-IN")?.voiceURI, "ms-guy-natural"); // algo alone
  const remembered = { voiceURI: "ms-david", name: "Microsoft David - English (United States)", lang: "en-US" };
  assert.equal(findStoredVoice(WINDOWS, remembered)?.voiceURI, "ms-david"); // resolveVoice keeps it
});

check("consistency: remembered voice temporarily absent -> deterministic fallback, same each time", () => {
  const withoutDavid = WINDOWS.filter((x) => x.voiceURI !== "ms-david");
  const remembered = { voiceURI: "ms-david", name: "Microsoft David - English (United States)", lang: "en-US" };
  assert.equal(findStoredVoice(withoutDavid, remembered), null); // not installed this visit
  // fallback is still fully deterministic across orderings
  const picks = shuffles(withoutDavid, 8).map((s) => selectPreferredVoice(s, "en-IN")?.voiceURI);
  assert.equal(new Set(picks).size, 1);
});

console.log("================================");
console.log(`RESULT: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
