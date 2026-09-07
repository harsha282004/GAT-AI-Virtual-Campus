/**
 * Deterministic Text-to-Speech voice selection.
 *
 * PROBLEM this solves: the Web Speech API's `SpeechSynthesisVoice` has no
 * `gender` field, `speechSynthesis.getVoices()` returns voices in an order
 * that is NOT stable across page loads / browser restarts / OS voice-pack
 * changes, and the list is populated asynchronously (cloud "Natural"/
 * "Online" voices arrive a beat after the local ones). Picking "the most
 * natural-sounding English voice" from that list — which is what the old
 * `scoreVoice()` did — therefore lands on a different voice, often flipping
 * male <-> female, between visits.
 *
 * FIX: a fixed priority hierarchy evaluated as a PURE FUNCTION of the voice
 * SET (never its order), with every tie broken by a stable lexical sort. A
 * curated male/female name-token table stands in for the missing `gender`
 * metadata (heuristic, never load-bearing — see KNOWN LIMITATIONS below).
 * The hook on top of this (`useSpeechSynthesis.ts`) additionally persists
 * the winner in `localStorage` and re-validates it against the live list,
 * so the exact same voice is restored on every later visit while it still
 * exists on that machine.
 *
 * No paid / cloud TTS service is involved — this stays 100% on the
 * browser's built-in `speechSynthesis`, matching the STT hook's decision.
 *
 * KNOWN BROWSER/OS LIMITATIONS
 * - The set of voices is provided by the OS + browser; a web app cannot
 *   guarantee a specific voice exists everywhere. Hence "preferred named
 *   voice -> deterministic fallback hierarchy" rather than a hard-coded
 *   name. On a machine with only one generic English voice, that voice is
 *   used (consistently) even if its gender is unknown.
 * - There is no standard gender API. The name-token heuristic below covers
 *   the common Windows/macOS/ChromeOS/Android/Linux voices; an unusual
 *   third-party voice may be classified "unknown" and fall to a later tier.
 * - iOS Safari only exposes local voices and only after a user gesture;
 *   the async loader in the hook waits for them.
 */

/** Structural subset of `SpeechSynthesisVoice` actually needed for
 * selection — lets this module be unit-tested with plain objects, and a
 * real `SpeechSynthesisVoice` satisfies it. */
export interface VoiceLike {
  readonly name: string;
  readonly lang: string;
  readonly voiceURI: string;
  readonly localService: boolean;
  readonly default: boolean;
}

/** name -> lowercase, alphanumerics only, single-spaced. */
function normName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Whole-word (or exact-phrase) presence check against a normalized name,
 * so "tom" does not match "custom" and "male" does not match "female". */
function hasToken(normalized: string, token: string): boolean {
  return token.includes(" ")
    ? normalized.includes(token)
    : normalized.split(" ").includes(token);
}

// Known-good MALE en-US voices across Windows (SAPI + Edge "Online
// (Natural)"), macOS/iOS, ChromeOS/Android — checked in THIS order, the
// first one present wins. Matched as a normalized substring so e.g.
// "Microsoft David Desktop - English (United States)" still matches
// "microsoft david".
export const PREFERRED_MALE_EN_US: readonly string[] = [
  "microsoft guy online natural", // Edge en-US natural male — best available
  "microsoft christopher online natural",
  "microsoft eric online natural",
  "microsoft roger online natural",
  "microsoft steffan online natural",
  "microsoft david", // classic Windows SAPI male, en-US
  "microsoft mark", // Windows SAPI male, en-US
  "google us english male", // ChromeOS/Android explicit male
  "alex", // macOS en-US, high-quality male
  "aaron",
  "fred",
  "reed",
  "eddy",
  "rocko",
  "chrome os us english male",
  "english united states male",
];

// First-name / token heuristics. `SpeechSynthesisVoice` exposes no gender,
// so this is the only available signal. FEMALE wins ties: speaking in a
// wrongly-guessed female voice is the failure we are fixing, so we would
// rather drop a mis-guessed male to a later tier than risk it.
const FEMALE_TOKENS: readonly string[] = [
  "female",
  "zira",
  "aria",
  "jenny",
  "michelle",
  "ana",
  "clara",
  "hazel",
  "susan",
  "catherine",
  "linda",
  "heera",
  "kalpana",
  "swara",
  "sonia",
  "samantha",
  "victoria",
  "karen",
  "moira",
  "tessa",
  "fiona",
  "serena",
  "allison",
  "ava",
  "nicky",
  "zoe",
  "google us english", // Chrome's "Google US English" is a female voice
  "google uk english female",
];

const MALE_TOKENS: readonly string[] = [
  "male",
  "david",
  "mark",
  "guy",
  "christopher",
  "eric",
  "roger",
  "steffan",
  "ryan",
  "thomas",
  "william",
  "george",
  "brian",
  "james",
  "richard",
  "prabhat",
  "hemant",
  "madhur",
  "alex",
  "fred",
  "aaron",
  "tom",
  "daniel",
  "arthur",
  "reed",
  "rocko",
  "gordon",
  "nathan",
  "oliver",
  "rishi",
  "eddy",
  "junior",
  "google uk english male",
];

/** Heuristic gender from the voice name. "unknown" when neither list
 * matches — such a voice is still usable, just at a later tier. */
export function classifyGender(voice: VoiceLike): "male" | "female" | "unknown" {
  const n = normName(voice.name);
  if (FEMALE_TOKENS.some((t) => hasToken(n, t))) return "female";
  if (MALE_TOKENS.some((t) => hasToken(n, t))) return "male";
  return "unknown";
}

/** Cloud / "Natural" / "Neural" voices sound markedly less robotic than
 * local SAPI voices — used only as the FIRST tie-break key, never to
 * accept or reject a voice. */
function isNatural(v: VoiceLike): boolean {
  return (
    v.localService === false ||
    /natural|neural|online|wavenet|premium|enhanced/i.test(v.name)
  );
}

/** Total order for deterministic tie-breaking: natural/cloud first, then
 * lexical by `voiceURI` then `name`. A pure function of the voice's own
 * fields — completely independent of `getVoices()` order. */
function stableCompare(a: VoiceLike, b: VoiceLike): number {
  const na = isNatural(a) ? 0 : 1;
  const nb = isNatural(b) ? 0 : 1;
  if (na !== nb) return na - nb;
  if (a.voiceURI !== b.voiceURI) return a.voiceURI < b.voiceURI ? -1 : 1;
  if (a.name !== b.name) return a.name < b.name ? -1 : 1;
  return a.lang < b.lang ? -1 : a.lang > b.lang ? 1 : 0;
}

const isEnglish = (v: VoiceLike) => v.lang.toLowerCase().startsWith("en");
const isEnUS = (v: VoiceLike) => v.lang.toLowerCase() === "en-us";
const isEnGB = (v: VoiceLike) => v.lang.toLowerCase() === "en-gb";

/** The deterministic English priority hierarchy (see file header). */
function selectEnglishVoice(voices: VoiceLike[]): VoiceLike | null {
  const english = voices.filter(isEnglish);
  if (!english.length) return null;
  // Sort ONCE, up front — every `.find()` below then walks a stable,
  // order-independent list, so ties always resolve the same way.
  const sorted = [...english].sort(stableCompare);

  // Tier 1 — a known-good male en-US voice, in fixed preference order.
  for (const wanted of PREFERRED_MALE_EN_US) {
    const enUsHit = sorted.find((v) => isEnUS(v) && normName(v.name).includes(wanted));
    if (enUsHit) return enUsHit;
    // The same named voice at any English locale (e.g. macOS "Alex" is
    // reported as en-US, but be tolerant of locale drift between OSes).
    const anyLocaleHit = sorted.find((v) => normName(v.name).includes(wanted));
    if (anyLocaleHit) return anyLocaleHit;
  }

  // Tier 2 — any en-US voice the heuristic marks male.
  const enUsMale = sorted.find((v) => isEnUS(v) && classifyGender(v) === "male");
  if (enUsMale) return enUsMale;

  // Tier 3 — any English voice the heuristic marks male (en-GB "Daniel", …).
  const enMale = sorted.find((v) => classifyGender(v) === "male");
  if (enMale) return enMale;

  // Tier 4 — any en-US voice (gender unknown/female — US pronunciation
  // still fits an assistant; consistency matters more than gender here).
  const enUs = sorted.find(isEnUS);
  if (enUs) return enUs;

  // Tier 5 — en-GB, then any other English locale.
  const enGb = sorted.find(isEnGB);
  if (enGb) return enGb;
  return sorted[0] ?? null;
}

const REGIONAL_PREFERENCE: Record<string, readonly string[]> = {
  hi: ["hi-in"],
  kn: ["kn-in"],
};

/** Non-English (Kannada / Hindi): keep the previous locale-based ranking
 * — no male heuristic (the user's request is specifically an English male
 * voice) — but make the tie-break deterministic. */
function selectNonEnglishVoice(voices: VoiceLike[], targetLang: string): VoiceLike | null {
  const base = targetLang.split("-")[0]?.toLowerCase() ?? targetLang.toLowerCase();
  const candidates = voices.filter((v) => v.lang.toLowerCase().startsWith(base));
  if (!candidates.length) return null;
  const preference = REGIONAL_PREFERENCE[base] ?? [];
  const score = (v: VoiceLike): number => {
    let s = 0;
    if (v.lang.toLowerCase() === targetLang.toLowerCase()) s += 100;
    const rank = preference.indexOf(v.lang.toLowerCase());
    if (rank !== -1) s += 30 - rank * 5;
    if (isNatural(v)) s += 20;
    if (v.default) s += 5;
    return s;
  };
  return (
    [...candidates].sort((a, b) => {
      const diff = score(b) - score(a);
      return diff !== 0 ? diff : stableCompare(a, b);
    })[0] ?? null
  );
}

/**
 * Deterministically pick the preferred voice for `targetLang` from `voices`.
 * Pure: the result depends only on the SET of voices and the target
 * language, never on the array order. Returns `null` only when `voices` is
 * empty (caller then leaves `utterance.voice` unset -> browser default).
 */
export function selectPreferredVoice(voices: VoiceLike[], targetLang: string): VoiceLike | null {
  if (!voices.length) return null;
  const base = targetLang.split("-")[0]?.toLowerCase() ?? "en";
  if (base === "en") return selectEnglishVoice(voices);
  // Non-English: prefer a matching-language voice, else fall back to the
  // English male voice rather than going silent / random.
  return selectNonEnglishVoice(voices, targetLang) ?? selectEnglishVoice(voices);
}

export interface StoredVoiceRef {
  voiceURI: string;
  name: string;
  lang: string;
}

/**
 * Re-find a previously chosen (persisted) voice in the current live list.
 * Matches on `voiceURI` first (stable + unique within a session), then on
 * `name` + `lang` (some browsers change `voiceURI` for the same logical
 * voice between versions). Returns `null` if that voice is no longer
 * installed — caller then re-runs `selectPreferredVoice`.
 */
export function findStoredVoice(
  voices: VoiceLike[],
  stored: StoredVoiceRef | null | undefined,
): VoiceLike | null {
  if (!stored) return null;
  return (
    voices.find((v) => v.voiceURI === stored.voiceURI) ??
    voices.find((v) => v.name === stored.name && v.lang === stored.lang) ??
    null
  );
}
