"""Phase 5 — Supervisor / Router.

Decides which specialized agent should handle a query, then dispatches to
it. The Supervisor makes NO factual claims itself and calls no LLM for
routing — it only classifies and dispatches; the specialist agent it picks
is what runs the actual grounded retrieval + generation pipeline.

ROUTING MECHANISM — read before assuming otherwise:
This is a DETERMINISTIC, RULE-BASED (keyword/phrase) router. It is
explicitly NOT a trained intent classifier. No labelled query->intent
training dataset exists in this repository (consistent with Phase 3's
SVRReranker, which is real infrastructure but was never fit on fabricated
data for the same reason), and CLAUDE.md's planned LSTM intent classifier
(backend/app/intent_model/) has not been built. Building a rule-based
router honestly, rather than dressing up keyword matching as "a trained
model," is the deliberate choice here — see docs/RAG_ARCHITECTURE.md's
Phase 5 section for the full IMPLEMENTED vs. FUTURE breakdown.

The confidence gate that actually decides whether a grounded answer gets
generated lives inside the shared Phase 2-4 pipeline (agent_base.py ->
llm_generator.generate_answer), not here — the Supervisor cannot bypass
it, because the Supervisor never talks to the LLM directly at all.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

import academic_agent
import admission_agent
import facilities_agent
import general_agent
import navigation_agent
from _shared import configure_logging

logger = configure_logging("supervisor")

# Multi-word phrases checked FIRST, before keyword scoring — "where is",
# "how do I reach X" etc. are strong, unambiguous navigation signals even
# when X itself contains a word that would otherwise score for another
# agent (e.g. "Where is the CSE department?" is a location question, not
# an academic-programs question).
NAVIGATION_PHRASES = [
    "where is",
    "where's",
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
    """query -> (agent_name, human-readable reason). Deterministic and
    fully explainable: every decision traces back to a literal substring
    match, logged in the reason string."""
    q = query.lower()

    for phrase in NAVIGATION_PHRASES:
        if phrase in q:
            return "navigation_agent", f"matched navigation phrase '{phrase}'"

    scores: dict[str, list[str]] = {
        name: [kw for kw in keywords if kw in q] for name, keywords in DOMAIN_KEYWORDS.items()
    }
    best_agent = max(scores, key=lambda name: len(scores[name]))
    if not scores[best_agent]:
        return (
            "general_agent",
            "no domain keywords matched; defaulted to general_agent "
            "(the confidence gate inside the pipeline, not this routing "
            "choice, is what keeps unrelated queries safe)",
        )
    return best_agent, f"matched {best_agent} keywords {scores[best_agent]}"


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
