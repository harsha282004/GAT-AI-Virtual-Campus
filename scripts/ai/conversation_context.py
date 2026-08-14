"""Phase 15 — Deterministic contextual follow-up detection and query
reformulation.

Pure, DB-independent logic: given the current message and a small set of
"active entities" carried forward from recent conversation turns (supplied
by the caller — backend/app/api/v1/chat.py, which owns the actual
session/DB access via app.session.store, exactly as it already did for
Phase 7/8/11's narrower follow-up handling), this module decides whether
the message is a follow-up that depends on prior context, and if so,
either:

- reformulates it into a self-contained query (exactly one plausible
  active entity), or
- reports that clarification is needed (2+ plausible entities — NEVER
  guesses between them, per this phase's core behavioral rule), or
- reports there is no reference cue at all (an ordinary, independent
  query — the common case, left completely untouched), or
- reports a reference cue exists but no active entity is available to
  resolve it against (falls through to the ordinary pipeline unresolved,
  same "fall through rather than guess" precedent Phase 8/11 already
  established in chat.py).

No LLM call anywhere in this module — every decision is a plain regex
match or list operation. This keeps context resolution fast and
deterministic, per this phase's explicit "avoid unnecessary LLM calls,
prefer deterministic resolution" requirement.

Called from TWO places by design, matching every other scripts/ai/
module's dual-usage pattern: standalone (this file's own tests /
test_phase15_contextual_conversation.py) and from the backend
(backend/app/api/v1/chat.py). It has no knowledge of ChatSession /
ChatMessageRecord / SQLAlchemy — those stay in
backend/app/session/store.py exactly as Phase 8 built them; this module
only ever sees plain strings in and a typed result out.

The reformulated query then goes through the EXACT SAME supervisor
routing -> retrieval -> reranking -> confidence -> generation -> grounding
pipeline as any other query (Phase 5/12/13/14, unmodified) — this module
only ever changes what TEXT enters that pipeline, never bypasses any stage
of it.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

# ---------------------------------------------------------------------------
# Reference-cue detection
# ---------------------------------------------------------------------------

# Bare pronouns/demonstratives standing in for a previously mentioned
# entity as the subject/object of the sentence ("Which floor is IT on?",
# "Tell me about THAT one") — substituted directly with the entity name.
_BARE_REFERENT_PATTERN = re.compile(
    r"\b(it|that|this|they|them|these|those|here|there)\b", re.IGNORECASE
)

# Possessive references ("what are ITS timings?", "what are THEIR fees?")
# — substituted with "the {entity}'s".
_POSSESSIVE_PATTERN = re.compile(r"\b(its|their)\b", re.IGNORECASE)

# "What about X" / "how about X" / "and (the) X" — the query names a NEW
# sub-topic but omits which parent entity/domain it continues from.
_TOPIC_CONTINUATION_PATTERN = re.compile(
    r"^(?:what|how) about\b|^and\s+(?:the\s+)?\w+", re.IGNORECASE
)

# An explicit request to continue the same subject with no new specifics
# at all.
_TELL_ME_MORE_PATTERN = re.compile(
    r"\btell me more\b|\bmore (?:info|information|details)\b", re.IGNORECASE
)

# Bare "which/what floor?" / "which/what building?" with no named subject
# at all — Phase 11 already had a narrower version of this check directly
# in chat.py (_FOLLOWUP_FLOOR_PATTERN); kept here too, broadened slightly
# (what/which, floor/building), so this module is a complete, reusable
# reference-detection surface rather than splitting the logic across files.
_BARE_ADJUNCT_PATTERN = re.compile(
    r"^(?:and\s+)?(?:which|what) (floor|building)(?:\s+is\s+(?:it|that|this))?\s*\??$",
    re.IGNORECASE,
)


def has_reference_cue(message: str) -> bool:
    """True if `message` contains any reference pattern this module knows
    how to resolve — the gate deciding whether context resolution should
    be attempted at all. A message with no reference cue is always treated
    as independent regardless of conversation history: this is how Section
    9's topic-decay requirement is satisfied by construction — a genuinely
    new-topic query ("What are the admission requirements?") contains none
    of these cues and is never touched."""
    stripped = message.strip()
    return bool(
        _BARE_REFERENT_PATTERN.search(message)
        or _POSSESSIVE_PATTERN.search(message)
        or _TOPIC_CONTINUATION_PATTERN.search(message)
        or _TELL_ME_MORE_PATTERN.search(message)
        or _BARE_ADJUNCT_PATTERN.match(stripped)
    )


# ---------------------------------------------------------------------------
# Reformulation
# ---------------------------------------------------------------------------


@dataclass
class ResolutionResult:
    """status is one of:
    - "independent": no reference cue found; `message` needs no resolution
      at all (the common case).
    - "no_context": a reference cue WAS found but no active entity exists
      to resolve it against — caller should fall through to its own
      best-effort strategy (e.g. prepending the raw previous question,
      Phase 8's proven mechanism) rather than guess.
    - "ambiguous": 2+ distinct candidate entities are equally recent and
      plausible — caller must ask for clarification, never guess.
    - "resolved": exactly one candidate; `resolved_query` is ready to route
      through the normal pipeline.
    """

    status: str
    resolved_query: str | None = None
    entity_used: str | None = None
    candidates: list[str] = field(default_factory=list)


def resolve_reference(message: str, active_entities: list[str]) -> ResolutionResult:
    """message: the raw follow-up text, exactly as the user typed it.
    active_entities: distinct entity names from recent conversation turns,
    most-recent-first, already deduplicated and freshness/TTL-filtered by
    the caller (app.session.store.get_recent_active_entities) — this
    function makes no assumptions about recency itself, it only counts
    distinct candidates."""
    if not has_reference_cue(message):
        return ResolutionResult(status="independent")

    distinct = list(dict.fromkeys(e for e in active_entities if e))
    if not distinct:
        return ResolutionResult(status="no_context")
    if len(distinct) > 1:
        return ResolutionResult(status="ambiguous", candidates=distinct)

    entity = distinct[0]
    return ResolutionResult(
        status="resolved",
        resolved_query=_reformulate(message, entity),
        entity_used=entity,
    )


def _reformulate(message: str, entity: str) -> str:
    """Deterministic, pattern-based reformulation — never an LLM call.
    Each branch handles one reference-cue family; the possessive/
    bare-referent checks are mutually exclusive by construction (a
    sentence uses one grammatical slot or the other for a given
    reference), checked in a fixed, most-specific-first order."""
    if _POSSESSIVE_PATTERN.search(message):
        return _POSSESSIVE_PATTERN.sub(f"the {entity}'s", message, count=1)

    if _BARE_REFERENT_PATTERN.search(message):
        return _BARE_REFERENT_PATTERN.sub(entity, message, count=1)

    if _BARE_ADJUNCT_PATTERN.match(message.strip()):
        return f"Which floor is {entity} on?"

    if _TELL_ME_MORE_PATTERN.search(message):
        return f"Tell me more about {entity}."

    if _TOPIC_CONTINUATION_PATTERN.search(message):
        stripped = message.rstrip("?. ").strip()
        return f"{stripped} in {entity}?"

    # Unreachable given has_reference_cue() already gated on one of the
    # patterns above — kept only so this function is total, not partial.
    return f"{entity}: {message}"  # pragma: no cover


def format_clarification_question(candidates: list[str]) -> str:
    """candidates -> a plain clarifying question, never a guess. Mirrors
    the phrasing style of navigation_agent.py's existing
    _format_clarification() for a real-entity ambiguity, applied here to a
    conversational-reference ambiguity instead."""
    if len(candidates) == 2:
        options = f"{candidates[0]} or {candidates[1]}"
    else:
        options = ", ".join(candidates[:-1]) + f", or {candidates[-1]}"
    return f"I can help with that. Do you mean {options}?"


if __name__ == "__main__":
    demo_cases: list[tuple[str, list[str]]] = [
        ("Which floor is it on?", ["CSE department"]),
        ("What are its timings?", ["Library"]),
        ("What floor is that on?", ["Classroom 202"]),
        ("What about the AI course?", []),
        ("Where is it?", ["CSE department", "Library"]),
        ("What are the admission requirements?", ["CSE department"]),
    ]
    for message, entities in demo_cases:
        result = resolve_reference(message, entities)
        print(f"{message!r} + entities={entities} -> {result}")
