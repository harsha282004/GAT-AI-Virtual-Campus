"""Phase 5 — Supervisor / Router.

Decides which specialized agent should handle a query, then dispatches to
it. The Supervisor makes NO factual claims itself and calls no LLM for
routing — it only classifies and dispatches; the specialist agent it picks
is what runs the actual grounded retrieval + generation pipeline.

ROUTING MECHANISM — read before assuming otherwise:
This is PRIMARILY a DETERMINISTIC, RULE-BASED (keyword/phrase) router — see
docs/RAG_ARCHITECTURE.md's Phase 5 section for the full IMPLEMENTED vs.
FUTURE breakdown of that original design.

PHASE 10 ADDITION — backend/app/intent_model/ now has a real, trained LSTM
intent classifier (see that package's classify.py/train.py). It is used as
a FALLBACK signal only, never as the primary router: the deterministic
rules above are proven, zero-false-negative for the phrasings they cover,
and stay authoritative. The RNN is consulted only in the one case that
motivated Phase 10 — a query whose exact wording matches none of the
NAVIGATION_PHRASES or DOMAIN_KEYWORDS (e.g. "What can I study here?",
which contains no "course"/"program"/"department" keyword at all) and
would otherwise silently default to general_agent. If the RNN is
confident, its predicted intent redirects to a better-fitting agent
instead. This keeps the honest, explainable deterministic path as the
safety net while adding real coverage for paraphrases outside it.

The confidence gate that actually decides whether a grounded answer gets
generated lives inside the shared Phase 2-4 pipeline (agent_base.py ->
llm_generator.generate_answer), not here — the Supervisor cannot bypass
it, because the Supervisor never talks to the LLM directly at all.
"""

from __future__ import annotations

import re
from collections.abc import Callable
from typing import Any

import academic_agent
import admission_agent
import facilities_agent
import general_agent
import navigation_agent
from _shared import configure_logging

logger = configure_logging("supervisor")

# isort: off
# backend/ is put on sys.path by campus_tools.py's `import campus_db`
# side-effect, already triggered transitively via navigation_agent's own
# imports above by the time this module-level code runs — but importing
# app.intent_model directly here would work even without that, since
# campus_db.py's sys.path insertion already ran as part of importing
# navigation_agent (imported above). No new sys.path plumbing needed.
from app.intent_model.classify import classify_intent  # noqa: E402

# isort: on

# Below this confidence, the RNN's prediction is not trusted enough to
# redirect a query away from the deterministic default — see
# backend/app/intent_model/train.py's printed held-out accuracy for why
# this threshold is conservative (a small synthetic training set).
_RNN_CONFIDENCE_THRESHOLD = 0.6

# Fine-grained RNN intents collapse onto the existing 5 specialist agents.
# Several intents intentionally share a target agent (e.g. every *_LOCATION
# intent routes to navigation_agent, which now also does the spatial
# lookup — see navigation_agent.py's Phase 10 docstring note) rather than
# each needing its own agent.
_INTENT_TO_AGENT: dict[str, str] = {
    "ADMISSIONS": "admission_agent",
    "COURSES": "academic_agent",
    "DEPARTMENTS": "academic_agent",
    "ACADEMICS": "academic_agent",
    "FACILITIES": "facilities_agent",
    "ROOM_LOCATION": "navigation_agent",
    "DEPARTMENT_LOCATION": "navigation_agent",
    "LABORATORY_LOCATION": "navigation_agent",
    "VIRTUAL_TOUR": "navigation_agent",
    "CAMPUS_INFO": "general_agent",
    "GENERAL": "general_agent",
    "UNKNOWN": "general_agent",
}

# A bare room-number mention ("room 202", "room no. 303") is an
# unambiguous spatial-lookup signal regardless of which verb (if any)
# surrounds it — checked before falling back to keyword scoring, same as
# NAVIGATION_PHRASES below. Kept in sync with navigation_agent.py's own
# room-number patterns (duplicated rather than imported, since this one
# only needs to detect presence, not extract/normalize the number).
_ROOM_NUMBER_PATTERN = re.compile(r"\broom\s*(?:no\.?|number|#)?\s*\d{2,4}[a-z]?\b", re.IGNORECASE)

# Multi-word phrases checked FIRST, before keyword scoring — "where is",
# "how do I reach X" etc. are strong, unambiguous navigation signals even
# when X itself contains a word that would otherwise score for another
# agent (e.g. "Where is the CSE department?" is a location question, not
# an academic-programs question).
NAVIGATION_PHRASES = [
    "where is",
    "where's",
    # Phase 11: plural form ("where are the washrooms?") — without this, a
    # facility spread across multiple physical locations (washrooms, staff
    # rooms) fell through to keyword scoring instead of the spatial lookup
    # navigation_agent already knows how to do for every entity type
    # (rooms/departments/labs/facilities/landmarks — see spatial_knowledge.py).
    "where are",
    "how do i reach",
    "how can i reach",
    "how do i get to",
    "how can i get to",
    "which floor",
    "which building",
    "how to reach",
    "directions to",
    "navigate to",
    "how far is",
    # Phase 7 addition: without these, a query like "Show me the panorama
    # for the library" was caught by facilities_agent's "library" keyword
    "panorama",
    "show me the route",
    "take me to",
    # Phase 10 additions — paraphrases surfaced by the spec's own test
    # groups (Section 16) that the original list didn't cover.
    "where can i find",
    "where could i find",
    "location of",
    # Phase 11 — virtual-tour-flavored panorama lookups (see
    # navigation_agent.py's _VIRTUAL_TOUR_PATTERN); routed here rather than
    # the RNN fallback so this phrasing is deterministic, not
    # confidence-dependent.
    "in the virtual tour",
    "in the tour",
]

# Single-domain keyword sets used for scoring once no navigation phrase
# matched. Each list reflects that domain's own natural vocabulary — none
# of these were hand-picked to force a specific test question into a
# specific bucket (see docs/RAG_ARCHITECTURE.md's Phase 5 section for an
# honest note on one test question that lands in a different agent than
# its label in the spec might suggest).
DOMAIN_KEYWORDS: dict[str, list[str]] = {
    "admission_agent": [
        "admission",
        "admit",
        "eligibility",
        "apply",
        "application",
        "entrance exam",
        "kcet",
        "comedk",
        "pgcet",
        "kmat",
        "counselling",
        "counseling",
        "cutoff",
        "seat matrix",
        "how to join",
    ],
    "academic_agent": [
        "department",
        "course",
        "program",
        "curriculum",
        "syllabus",
        "academic",
        "degree",
        "b.e.",
        "m.tech",
        "mba",
        "faculty",
        "semester",
        "branch",
        "specialization",
    ],
    "facilities_agent": [
        "facility",
        "facilities",
        "laboratory",
        "lab",
        "classroom",
        "auditorium",
        "library",
        "hostel",
        "canteen",
        "transport",
        "bus",
        "gym",
        "sports",
        "wifi",
        "infrastructure",
        "amenities",
    ],
    "general_agent": [
        "global academy",
        "what is gat",
        "about gat",
        "contact",
        "phone",
        "email",
        "address",
        "established",
        "history",
        "accreditation",
        "naac",
        "vision",
        "mission",
    ],
}

AGENTS: dict[str, Callable[[str], dict[str, Any]]] = {
    "admission_agent": admission_agent.handle,
    "academic_agent": academic_agent.handle,
    "facilities_agent": facilities_agent.handle,
    "navigation_agent": navigation_agent.handle,
    "general_agent": general_agent.handle,
}


def classify(query: str) -> tuple[str, str]:
    """query -> (agent_name, human-readable reason). Primarily
    deterministic and fully explainable: every decision traces back to a
    literal substring/regex match, logged in the reason string. Falls back
    to the RNN intent classifier (Phase 10) ONLY when no deterministic
    rule matched at all — see this module's docstring."""
    q = query.lower()

    for phrase in NAVIGATION_PHRASES:
        if phrase in q:
            return "navigation_agent", f"matched navigation phrase '{phrase}'"

    if _ROOM_NUMBER_PATTERN.search(query):
        return "navigation_agent", "matched a bare room-number mention"

    scores: dict[str, list[str]] = {
        name: [kw for kw in keywords if kw in q] for name, keywords in DOMAIN_KEYWORDS.items()
    }
    best_agent = max(scores, key=lambda name: len(scores[name]))
    if scores[best_agent]:
        return best_agent, f"matched {best_agent} keywords {scores[best_agent]}"

    rnn_result = classify_intent(query)
    rnn_intent = rnn_result["intent"]
    rnn_confidence = rnn_result["confidence"]
    if rnn_intent is not None and rnn_confidence >= _RNN_CONFIDENCE_THRESHOLD:
        agent = _INTENT_TO_AGENT.get(rnn_intent, "general_agent")
        return (
            agent,
            f"no domain keywords matched; RNN intent classifier predicted "
            f"{rnn_intent} (confidence={rnn_confidence:.2f}) -> {agent}",
        )

    return (
        "general_agent",
        "no domain keywords matched and the RNN intent classifier was not "
        f"confident enough (intent={rnn_intent}, confidence={rnn_confidence:.2f}); "
        "defaulted to general_agent (the confidence gate inside the "
        "pipeline, not this routing choice, is what keeps unrelated "
        "queries safe)",
    )


def route(query: str) -> dict[str, Any]:
    """The Supervisor's only real job: classify, dispatch, and annotate
    the result with routing metadata. It never touches retrieved_context,
    confidence, or the answer itself — those come back from the chosen
    specialist untouched."""
    agent_name, reason = classify(query)
    logger.info("Routing decision: query=%r -> agent=%s (%s)", query, agent_name, reason)

    handler = AGENTS[agent_name]
    result = handler(query)
    result["agent_reason"] = reason
    return result


if __name__ == "__main__":
    for demo_query in [
        "What is the admission process?",
        "Where is the main building?",
        "What is the capital of France?",
    ]:
        result = route(demo_query)
        print(
            f"[{result['selected_agent']}] ({result['agent_reason']}) "
            f"status={result['generation_status']}"
        )
