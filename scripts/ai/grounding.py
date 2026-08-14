"""Phase 14 — Post-generation grounding validation.

Complements context_selection.py (Phase 11, PRE-generation: which chunks
the LLM is shown) with a POST-generation check: does the LLM's own answer
contain a specific-looking factual claim — a phone number, a currency
figure, a room number, a year/date — that is not actually traceable back to
the retrieved context it was given? This is a deterministic, pattern-based
safety net, not a second LLM call (no extra Ollama round trip, no duplicate
confidence system) and it runs strictly AFTER confidence.py has already
gated LOW-confidence queries out of generation entirely — one more check on
the MEDIUM/HIGH-confidence answers that do reach the LLM.

Deliberately scoped to catch the concrete failure modes Phase 14 names
(unsupported room numbers, phone numbers, fees/salaries, dates/years): a
determined LLM could still invent a wrong SENTENCE with no matchable
numeric pattern, which this cannot catch — it is a safety net for the
specific, checkable case, not a general hallucination detector.

Comparison is digit-sequence-based, not literal-substring, so a real,
grounded figure quoted with different formatting than the source text
(context says "Rs. 50,000", the answer says "INR 50000") is NOT a false
positive — both reduce to the digit run "50000". Only digit runs of length
>= MIN_DIGIT_RUN_LENGTH are checked, so incidental short numbers (page
counts, list sizes) that are far more likely to coincidentally match
something unrelated in the context don't trigger a refusal.
"""

from __future__ import annotations

import re
from typing import Any

# Candidate-claim patterns — used only to find NUMBER-BEARING substrings in
# the generated answer worth checking; the actual grounding check is a
# digit-sequence comparison against the context, not a check on these
# patterns matching the context verbatim.
_PHONE_PATTERN = re.compile(r"\b(?:\+?91[-\s]?)?[6-9]\d{9}\b")
_CURRENCY_PATTERN = re.compile(r"(?:rs\.?|inr|₹)\s*[\d,]+(?:\.\d+)?", re.IGNORECASE)
_ROOM_PATTERN = re.compile(r"\broom\s*(?:no\.?|number|#)?\s*\d{2,4}[a-z]?\b", re.IGNORECASE)
_YEAR_PATTERN = re.compile(r"\b(?:19|20)\d{2}\b")

_CLAIM_PATTERNS: dict[str, re.Pattern[str]] = {
    "phone_number": _PHONE_PATTERN,
    "currency_amount": _CURRENCY_PATTERN,
    "room_number": _ROOM_PATTERN,
    "year": _YEAR_PATTERN,
}

# Digit runs shorter than this are excluded from the check — a bare "12" or
# "45" is common, generic, and not worth flagging; this focuses the check
# on genuinely distinctive numbers (phone numbers, room numbers, currency
# amounts, 4-digit years all naturally clear this bar).
MIN_DIGIT_RUN_LENGTH = 3


def _digit_runs(text: str) -> set[str]:
    """text -> the set of maximal digit runs in it, with thousand-separator
    commas stripped first (so "50,000" and "50000" are the same run) —
    everything below MIN_DIGIT_RUN_LENGTH is dropped."""
    normalized = re.sub(r"(?<=\d),(?=\d)", "", text)
    return {run for run in re.findall(r"\d+", normalized) if len(run) >= MIN_DIGIT_RUN_LENGTH}


def find_unsupported_claims(answer_text: str, context_text: str) -> dict[str, list[str]]:
    """answer_text (the LLM's generated answer) + context_text (the exact
    CONTEXT block it was given) -> {claim_type: [unsupported substrings]}.
    A claim is "unsupported" when its own digit run does not appear
    anywhere among the context's digit runs. An empty dict means every
    specific numeric/phone/room/year claim found in the answer traces back
    to the retrieved evidence."""
    context_digits = _digit_runs(context_text)
    unsupported: dict[str, list[str]] = {}

    for claim_type, pattern in _CLAIM_PATTERNS.items():
        matches = pattern.findall(answer_text)
        missing = []
        for match in matches:
            claim_digits = _digit_runs(match)
            if claim_digits and not claim_digits & context_digits:
                missing.append(match)
        if missing:
            unsupported[claim_type] = missing

    return unsupported


GROUNDING_CHECK_FAILED_MESSAGE = (
    "The generated answer contained a specific detail (such as a number, date, or contact "
    "detail) that could not be verified against the retrieved official GAT information, so it "
    "has been withheld rather than risk showing unverified information. Please check the "
    "official GAT website (https://www.gat.ac.in/) or contact the institution directly for "
    "accurate information."
)


def build_grounding_failure_result(
    query: str,
    confidence: dict[str, Any],
    sources: list[dict[str, Any]],
    model: str,
    unsupported_claims: dict[str, list[str]],
) -> dict[str, Any]:
    """Builds the same result shape llm_generator.generate_answer() already
    returns for its other refusal paths (low_confidence_refusal,
    ollama_unreachable, ...) — a new, clearly distinct generation_status
    rather than silently reusing an existing one, so callers/tests/logs can
    tell a grounding-check refusal apart from a retrieval-confidence
    refusal."""
    return {
        "question": query,
        "answer": GROUNDING_CHECK_FAILED_MESSAGE,
        "confidence": confidence["confidence"],
        "confidence_level": confidence["category"],
        "sources": sources,
        "grounded": False,
        "generation_status": "grounding_check_failed",
        "model": model,
        "unsupported_claims": unsupported_claims,
    }


if __name__ == "__main__":
    context = "GAT was established in 2001. The Administrative Office phone is 08028437805."
    grounded_answer = "GAT was established in 2001 and can be reached at 08028437805."
    fabricated_answer = "GAT was established in 1995 and its helpline is 9876543210."

    print("Grounded answer:", find_unsupported_claims(grounded_answer, context))
    print("Fabricated answer:", find_unsupported_claims(fabricated_answer, context))
