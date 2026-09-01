"""Conversational / small-talk intent layer — runs BEFORE retrieval routing.

A plain "Hi", "Thanks", or "Bye" is not a campus knowledge-base question.
Sending it through hybrid retrieval / BM25 / ChromaDB / the LLM is both
wrong (the user gets "there is no relevant information") and needlessly
slow. This module decides whether a message is ordinary conversation and,
if so, answers it with a short, fixed, language-aware reply — no retrieval,
no DB call, no LLM call, matching conversation_context.py's "prefer
deterministic resolution" precedent.

Detection is PATTERN-based, not an exhaustive string list: each category
(greeting / how-are-you / capabilities / identity / nicety / gratitude /
farewell / acknowledgement) has a small regex of natural variations, and a
message counts as small talk only when — after known filler words
("there", "assistant", "please", "so much", ...) are removed — the ENTIRE
message is made of those conversational fragments. So "Hi", "Hi there",
"Hello assistant", "Thanks a lot" all match, but "Hi, where is the
library?" and "How do I bake a cake?" do NOT (a real question remains) and
fall straight through to supervisor.classify() unchanged.

`detect()` returns a category string or None. None means "not small talk"
— the caller proceeds exactly as before, so campus questions, navigation,
grounding, confidence gating and the safe refusal path are all untouched.
"""

from __future__ import annotations

import re
from typing import Any

from _shared import configure_logging
from llm_generator import RESPONSE_LANGUAGE

logger = configure_logging("smalltalk")

CONVERSATION_AGENT = "conversation_agent"
CONVERSATIONAL_STATUS = "conversational"

# A message longer than this many words is never small talk — a fast
# reject before the (more precise) full-coverage check below.
_MAX_WORDS = 8

# Runs of 3+ identical characters collapse to 2 ("hiii" -> "hii",
# "goooood" -> "good", "thanksss" -> "thankss") so enthusiastic spellings
# still match without turning "good" into "god".
_REPEAT_RUN = re.compile(r"(.)\1{2,}")


def _normalize(text: str) -> str:
    text = _REPEAT_RUN.sub(r"\1\1", text.lower().strip())
    text = re.sub(r"[^\w\s]", " ", text, flags=re.UNICODE)
    return re.sub(r"\s+", " ", text).strip()


# Words that may pad a conversational message without changing its intent.
# Removed before the full-coverage test so "hello there", "thanks a lot",
# "hi assistant", "thank you so much" still read as pure small talk.
_FILLERS = frozenset(
    "the there here now today please pls plz kindly just so very really much lot "
    "too also dear buddy bro bruh friend mate pal man sir madam "
    "maam team folks guys everyone assistant chatbot".split()
)

# Glue words that only ever appear trailing a conversational phrase — drop
# them from the leftover AFTER pattern-matching, never before (so a real
# query like "what is CSE known for" keeps enough of itself to fail the
# coverage test and route normally).
_RESIDUAL_GLUE = frozenset(
    "a an for it that this your my its help helping everything anyway though "
    "again with about and of to".split()
)

# (category, pattern) in PRIORITY order — the first match wins when a
# message mixes categories ("hi, what can you do?" -> capabilities;
# "hello, how are you" -> how_are_you; "ok thanks" -> gratitude;
# "thanks, bye" -> farewell). Within each pattern the MULTI-WORD
# alternatives come first so e.g. "thank you" is consumed whole rather than
# "thank" alone leaving a stray "you". detect() also uses these patterns
# (not a second regex) to test whole-message coverage, so this list is the
# single source of truth for what counts as a conversational fragment.
_CATEGORY_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    (
        "farewell",
        re.compile(
            r"\btalk to you later\b|\bcatch you later\b"
            r"|\bsee (?:you|ya)(?: later| soon| around| tomorrow| next time)?\b"
            r"|\bgood ?bye\b|\bgoodbye\b|\bbye+\b|\bcya\b|\bttyl\b|\btake care\b|\bfarewell\b"
            r"|\bsigning off\b|\bgood ?(?:night|nite)\b|\bgn\b"
        ),
    ),
    (
        "gratitude",
        re.compile(
            r"\bthank (?:you|u)(?: so much| very much| a lot| a ton| kindly)?\b|\bthank ?you\b"
            r"|\bthanks (?:so much|a lot|a ton|a bunch|much|man|buddy)\b|\bthanks\b|\bthank\b"
            r"|\bthx\b|\bthanx\b|\btysm\b|\bty\b|\bmuch appreciated\b|\bappreciate it\b"
            r"|\bappreciated\b|\bgrateful\b"
        ),
    ),
    (
        "capabilities",
        re.compile(
            r"\bwhat can (?:you|u) do\b|\bwhat (?:do|are) you (?:do|for)\b"
            r"|\b(?:what|how) can (?:you|u) help(?: me)?\b|\bwhat are you capable of\b"
            r"|\bwhat can you help (?:me )?with\b|\bcan (?:you|u) help(?: me)?\b|\bhelp\b"
        ),
    ),
    (
        "identity",
        re.compile(
            r"\bwho (?:are|r) (?:you|u)\b|\bwhat are you\b|\bwhat'?s your name\b|\byour name\b"
            r"|\bwho (?:made|created|built) you\b|\bare you (?:a )?(?:bot|human|real|an? ai)\b"
        ),
    ),
    (
        "how_are_you",
        re.compile(
            r"\bhow (?:are|r) (?:you|u|ya)(?: doing| today| going)?\b|\bhow (?:are|r) things\b"
            r"|\bhow'?s it going\b|\bhow is it going\b|\bhow'?s everything\b"
            r"|\bhow do you do\b|\bhru\b|\bhow have you been\b"
        ),
    ),
    (
        "nicety",
        re.compile(
            r"\bnice to meet (?:you|u)\b|\bpleasure to meet (?:you|u)\b"
            r"|\bgood to meet (?:you|u)\b|\bnice talking(?: to you)?\b|\bnice to meet\b"
        ),
    ),
    (
        "greeting_morning",
        re.compile(r"\bgood morning\b|\bmorning\b"),
    ),
    (
        "greeting_afternoon",
        re.compile(r"\bgood (?:afternoon|noon)\b"),
    ),
    (
        "greeting_evening",
        re.compile(r"\bgood evening\b"),
    ),
    (
        "greeting",
        re.compile(
            r"\bwhat'?s up\b|\bwhat is up\b|\bwass?up\b|\bhow'?dy\b|\bgood day\b"
            r"|\bhi+\b|\bhey+\b|\bhello+\b|\bhelo+\b|\bheya\b|\bhiya\b|\byo\b|\bhola\b|\bsup\b"
            r"|\bnamaste\b|\bnamaskara?\b|\bnamaskaram\b|\bgreetings\b"
        ),
    ),
    (
        "acknowledgement",
        re.compile(
            r"\bmakes sense\b|\bsounds good\b|\bfair enough\b|\ball right\b|\bgot it\b"
            r"|\bokay\b|\bokey\b|\bok\b|\bkk\b|\bk\b|\balright\b|\bunderstood\b|\bnoted\b"
            r"|\bcool\b|\bawesome\b|\bgreat\b|\bnice\b|\bfine\b|\bsure\b|\bperfect\b|\byep\b|\byeah\b"
        ),
    ),
]

# Native-script conversational phrases (exact, after _normalize) for the
# languages the project already supports — kept tiny on purpose; anything
# else in these scripts falls through to normal routing.
_NATIVE_SMALLTALK: dict[str, str] = {
    "नमस्ते": "greeting",
    "नमस्कार": "greeting",
    "नमस्ते जी": "greeting",
    "सुप्रभात": "greeting_morning",
    "शुभ प्रभात": "greeting_morning",
    "शुभ संध्या": "greeting_evening",
    "धन्यवाद": "gratitude",
    "शुक्रिया": "gratitude",
    "बहुत धन्यवाद": "gratitude",
    "अलविदा": "farewell",
    "फिर मिलेंगे": "farewell",
    "ನಮಸ್ಕಾರ": "greeting",
    "ನಮಸ್ತೆ": "greeting",
    "ಹಲೋ": "greeting",
    "ಶುಭೋದಯ": "greeting_morning",
    "ಶುಭ ಸಂಜೆ": "greeting_evening",
    "ಧನ್ಯವಾದ": "gratitude",
    "ಧನ್ಯವಾದಗಳು": "gratitude",
    "ವಂದನೆಗಳು": "gratitude",
    "ವಿದಾಯ": "farewell",
}


def detect(message: str) -> str | None:
    """`message` -> conversational category, or None if it is not ordinary
    small talk (in which case the caller must route it normally).

    A message qualifies only when, after filler words are removed, EVERY
    remaining token is part of a conversational fragment — so a greeting or
    thanks bundled with a real question ("hi, where is the library?") does
    NOT qualify and reaches the campus pipeline intact.
    """
    raw = (message or "").strip()
    if not raw:
        return None

    if raw in _NATIVE_SMALLTALK:
        return _NATIVE_SMALLTALK[raw]

    norm = _normalize(raw)
    if not norm:
        return None
    if norm in _NATIVE_SMALLTALK:
        return _NATIVE_SMALLTALK[norm]

    tokens = norm.split()
    if len(tokens) > _MAX_WORDS:
        return None

    core = " ".join(t for t in tokens if t not in _FILLERS).strip()
    if not core:
        return None

    # Full-coverage test: strip every category's matches from the message,
    # then drop the small set of glue words that only ever trail a
    # conversational phrase ("thanks FOR the help", "thanks ANYWAY"). If
    # anything real is still left (a noun, a question), this is not pure
    # small talk and must route normally.
    residual = core
    for _, pattern in _CATEGORY_PATTERNS:
        residual = pattern.sub(" ", residual)
    residual = " ".join(t for t in residual.split() if t not in _RESIDUAL_GLUE)
    if residual.strip():
        return None

    for category, pattern in _CATEGORY_PATTERNS:
        if pattern.search(core):
            return category
    return None


# Fixed replies per category per language. English is the fallback for any
# language without an entry, matching llm_generator._LANGUAGE_INSTRUCTIONS'
# own en-default behaviour. Proper nouns (GAT, Global Academy of Technology)
# are kept untranslated, exactly as the RAG language prompt already
# requires.
_RESPONSES: dict[str, dict[str, str]] = {
    "en": {
        "greeting": "Hi! How can I help you today?",
        "greeting_morning": "Good morning! How can I help you?",
        "greeting_afternoon": "Good afternoon! How can I help you?",
        "greeting_evening": "Good evening! How can I help you?",
        "how_are_you": "I'm doing well, thank you! How can I help you with the campus?",
        "capabilities": (
            "I'm the GAT Virtual Campus Assistant. I can help with admissions, academics, "
            "departments, campus facilities, and finding your way around campus. "
            "What would you like to know?"
        ),
        "identity": (
            "I'm the GAT Virtual Campus Assistant, here to help you with information about "
            "Global Academy of Technology. How can I help?"
        ),
        "nicety": "Nice to meet you too! How can I help you with the campus?",
        "gratitude": "You're welcome! I'm happy to help.",
        "farewell": "Goodbye! Feel free to ask me whenever you need help with the campus.",
        "acknowledgement": (
            "Alright! Let me know if there's anything else you'd like to know about the campus."
        ),
    },
    "hi": {
        "greeting": "नमस्ते! मैं आज आपकी किस प्रकार सहायता कर सकता हूँ?",
        "greeting_morning": "सुप्रभात! मैं आपकी किस प्रकार सहायता कर सकता हूँ?",
        "greeting_afternoon": "नमस्कार! मैं आपकी किस प्रकार सहायता कर सकता हूँ?",
        "greeting_evening": "शुभ संध्या! मैं आपकी किस प्रकार सहायता कर सकता हूँ?",
        "how_are_you": "मैं ठीक हूँ, धन्यवाद! मैं कैंपस के बारे में आपकी कैसे मदद कर सकता हूँ?",
        "capabilities": (
            "मैं GAT वर्चुअल कैंपस असिस्टेंट हूँ। मैं प्रवेश, शिक्षा, विभागों, कैंपस सुविधाओं और "
            "कैंपस में रास्ता खोजने में आपकी मदद कर सकता हूँ। आप क्या जानना चाहेंगे?"
        ),
        "identity": (
            "मैं GAT वर्चुअल कैंपस असिस्टेंट हूँ, जो Global Academy of Technology के बारे में "
            "जानकारी देने के लिए यहाँ है। मैं आपकी कैसे मदद कर सकता हूँ?"
        ),
        "nicety": "आपसे मिलकर अच्छा लगा! मैं कैंपस के बारे में आपकी कैसे मदद कर सकता हूँ?",
        "gratitude": "आपका स्वागत है! मुझे सहायता करके खुशी हुई।",
        "farewell": "अलविदा! कैंपस से जुड़ी किसी भी मदद के लिए मुझसे कभी भी पूछ सकते हैं।",
        "acknowledgement": "ठीक है! कैंपस के बारे में कुछ और जानना हो तो बताइए।",
    },
    "kn": {
        "greeting": "ನಮಸ್ಕಾರ! ನಾನು ಇಂದು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು?",
        "greeting_morning": "ಶುಭೋದಯ! ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು?",
        "greeting_afternoon": "ನಮಸ್ಕಾರ! ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು?",
        "greeting_evening": "ಶುಭ ಸಂಜೆ! ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು?",
        "how_are_you": "ನಾನು ಚೆನ್ನಾಗಿದ್ದೇನೆ, ಧನ್ಯವಾದಗಳು! ಕ್ಯಾಂಪಸ್ ಬಗ್ಗೆ ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು?",
        "capabilities": (
            "ನಾನು GAT ವರ್ಚುವಲ್ ಕ್ಯಾಂಪಸ್ ಅಸಿಸ್ಟೆಂಟ್. ಪ್ರವೇಶ, ಶಿಕ್ಷಣ, ವಿಭಾಗಗಳು, ಕ್ಯಾಂಪಸ್ ಸೌಲಭ್ಯಗಳು "
            "ಮತ್ತು ಕ್ಯಾಂಪಸ್‌ನಲ್ಲಿ ದಾರಿ ಹುಡುಕುವಲ್ಲಿ ನಾನು ಸಹಾಯ ಮಾಡಬಲ್ಲೆ. ನೀವು ಏನು ತಿಳಿಯಲು ಬಯಸುತ್ತೀರಿ?"
        ),
        "identity": (
            "ನಾನು GAT ವರ್ಚುವಲ್ ಕ್ಯಾಂಪಸ್ ಅಸಿಸ್ಟೆಂಟ್, Global Academy of Technology ಬಗ್ಗೆ ಮಾಹಿತಿ "
            "ನೀಡಲು ಇಲ್ಲಿದ್ದೇನೆ. ನಾನು ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ?"
        ),
        "nicety": "ನಿಮ್ಮನ್ನು ಭೇಟಿಯಾಗಿ ಸಂತೋಷವಾಯಿತು! ಕ್ಯಾಂಪಸ್ ಬಗ್ಗೆ ನಾನು ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ?",
        "gratitude": "ಪರವಾಗಿಲ್ಲ! ಸಹಾಯ ಮಾಡಲು ಸಂತೋಷ.",
        "farewell": "ವಿದಾಯ! ಕ್ಯಾಂಪಸ್ ಕುರಿತು ಸಹಾಯ ಬೇಕಾದಾಗ ಯಾವಾಗ ಬೇಕಾದರೂ ಕೇಳಿ.",
        "acknowledgement": "ಸರಿ! ಕ್ಯಾಂಪಸ್ ಬಗ್ಗೆ ಇನ್ನೇನಾದರೂ ತಿಳಿಯಬೇಕಿದ್ದರೆ ಹೇಳಿ.",
    },
}


def _reply_text(category: str, language: str) -> str:
    table = _RESPONSES.get(language, _RESPONSES["en"])
    return table.get(category) or _RESPONSES["en"].get(category) or _RESPONSES["en"]["greeting"]


def build_response(query: str, category: str) -> dict[str, Any]:
    """Full Agent Response Contract for a conversational reply — same shape
    every specialist agent returns (so backend/app/api/v1/chat.py needs no
    special-casing), with `generation_status="conversational"` and a fixed
    reply in the request's selected language (RESPONSE_LANGUAGE, the same
    ContextVar the RAG generator already reads). No retrieval, no sources,
    no LLM call — `grounded` is True in the sense that the reply asserts no
    campus fact that could be wrong."""
    language = RESPONSE_LANGUAGE.get()
    answer = _reply_text(category, language)
    return {
        "original_query": query,
        "selected_agent": CONVERSATION_AGENT,
        "retrieved_context": [],
        "confidence_score": 1.0,
        "confidence_level": "HIGH",
        "generation_status": CONVERSATIONAL_STATUS,
        "answer": answer,
        "sources": [],
        "source_urls": [],
        "refusal_reason": None,
        "grounded": True,
        "model": None,
        "tool_used": None,
        "conversational_category": category,
    }


if __name__ == "__main__":
    for demo in [
        "Hi",
        "Hello there",
        "Hey!",
        "Good morning",
        "How are you?",
        "What can you do?",
        "Thanks a lot",
        "Bye",
        "ok",
        "Hi, where is the library?",
        "How do I bake a chocolate cake?",
        "Who is the CSE HOD?",
    ]:
        cat = detect(demo)
        print(f"{demo!r:40} -> {cat}")
