"""Phase 6 — Navigation Agent (real tool integration).

Handles: building locations, floor locations, room locations,
panorama/tour lookups — location and spatial-lookup questions, not
routing.

PHASE 10 ADDITION — spatial_knowledge.py (data/campus_spatial/*.json,
built in Phase 9 from real panorama signage) is now consulted FIRST for
location-intent queries, before the existing PostgreSQL
campus_tools.resolve_location(). Reason: the Phase 9 dataset is the only
source that actually covers the real main-building room numbers (201-419
etc.) — PostgreSQL's seeded Room table only has a handful of placeholder
rooms and does not contain them at all. If spatial_knowledge finds nothing,
this falls through to resolve_location() (unchanged) exactly as before, so
the legacy placeholder set (Library, Auditorium, ...) keeps working. Unlike
_tool_response() below (used for the 100%-certain deterministic DB lookups
resolve_location()/panorama_lookup() perform), spatial answers carry their
REAL evidence-derived confidence — a low-confidence or unresolved spatial
record is never reported as HIGH/1.0.

Phase 5 shipped this agent with a documented stub (`NavigationAdapter`)
because its own docstring believed scripts/ai/ could not import
backend/app/*. That belief was re-checked during Phase 6's audit and found
to be incorrect: CLAUDE.md only says the running app never imports
scripts/ (one direction), and scripts/db/seed.py already imports
backend/app/navigation/pathfinding.py directly via a plain SQLAlchemy
Session — there is no actual project rule against the reverse direction.
Phase 6 corrects this: location queries are now resolved against the
REAL backend data layer (via campus_tools.py, which wraps
backend/app/navigation/'s existing functions unmodified — see that
module's docstring for exactly which functions are called).

PHASE 9 SCOPE CHANGE — read before assuming this agent still does routing:
This agent used to also classify a "route" sub-intent ("how do I get to
X", "take me from X to Y") and call `campus_tools.navigation_tool()` for
real A* turn-by-turn directions. Phase 9 revised the project scope: this
project is a virtual campus tour + AI information assistant, not an indoor
navigation/routing system, so that classification branch, its regex
patterns, `_format_route_answer()`, and the `navigation_tool` import have
all been removed. A query that used to match the route patterns (e.g. "how
do I get to CSE Block?") now simply falls through to intent "none" below,
same as any other query neither of the two remaining tool paths can
resolve — it is answered by the ordinary grounded RAG path, never given a
fabricated route. `campus_tools.navigation_tool()` itself was deleted from
campus_tools.py (see that module's own Phase 9 docstring note); the
underlying `app.navigation` graph/pathfinding package it used to call was
NOT touched, since `resolve_location()`/`panorama_lookup()` below still
depend on parts of it.

Two paths remain, chosen deterministically per query (Phase 6's "tool
selection" requirement — don't call a tool for every question):

1. TOOL PATH — the query looks like a bare location request ("where is
   X") or a panorama request. campus_tools.resolve_location()/
   panorama_lookup() are called; on a confident single match, the tool's
   own structured data (real building/floor names, real panorama titles)
   becomes the answer directly — the LLM is not involved, so it cannot
   alter a room number or location. On an ambiguous match, a
   clarification listing the real candidates is returned — never a
   guess. Only on "not found"/error does this path fall through to (2).
2. RAG PATH — agent_base.run_specialist(), identical to every other
   agent (Phase 2-4 pipeline, unmodified), for informational
   navigation-flavored questions the tool layer can't resolve to a single
   graph node.
"""

from __future__ import annotations

import re
from typing import Any

from agent_base import run_specialist
from campus_tools import hotspot_lookup, panorama_lookup, resolve_location
from confidence import categorize as categorize_confidence
from spatial_knowledge import extract_room_number, format_spatial_answer, search_spatial

AGENT_NAME = "navigation_agent"

_PANORAMA_FOR_PATTERN = re.compile(r"panorama\s+(?:for|of)\s+(.+)", re.IGNORECASE)
_PANORAMA_GENERIC_PATTERN = re.compile(
    r"(?:what|which) panorama should i (?:open|see|view|show)", re.IGNORECASE
)

# Phase 10: broadened beyond the original "where is X" / "where's X" to
# cover the paraphrases users actually asked for (Phase 10 spec, Section 9)
# — "where can I find X", "tell me the location of X", "which floor is X
# on" / "X is on which floor", and a bare room-number query with no
# location verb at all ("room no 202?"). Each pattern extracts the same
# `to_text` shape as before, so classify_navigation_query()'s caller does
# not need to know which phrasing matched.
_WHERE_IS_PATTERN = re.compile(r"where(?:'s| is)\s+(.+)", re.IGNORECASE)
_WHERE_CAN_FIND_PATTERN = re.compile(r"where\s+(?:can|could|do)\s+i\s+find\s+(.+)", re.IGNORECASE)
_LOCATION_OF_PATTERN = re.compile(
    r"(?:tell me|what is|show me)\s+(?:the\s+)?location of\s+(.+)" r"|\blocation of\s+(.+)",
    re.IGNORECASE,
)
_WHICH_FLOOR_IS_X_ON_PATTERN = re.compile(
    r"which floor is\s+(.+?)\s+on\b|which floor is\s+(.+?)[\?\.!]*$", re.IGNORECASE
)
_X_IS_ON_WHICH_FLOOR_PATTERN = re.compile(r"(.+?)\s+is on which floor\b", re.IGNORECASE)
# Bare "room 202" / "room no 202?" with no surrounding location verb at
# all — only matched as a last resort (see classify_navigation_query), so
# it can't misfire on a sentence that merely mentions a room in passing.
_BARE_ROOM_PATTERN = re.compile(r"\broom\s*(?:no\.?|number|#)?\s*\d{2,4}[a-z]?\b", re.IGNORECASE)


def _clean(text: str) -> str:
    text = text.strip().rstrip("?.! ")
    text = re.sub(r"^(the|a|an)\s+", "", text.strip(), flags=re.IGNORECASE)
    return text.strip()


def classify_navigation_query(query: str) -> dict[str, Any]:
    """Deterministic sub-intent classification WITHIN the navigation
    agent — decides tool-vs-RAG, not which agent to use (that's already
    been decided by supervisor.py by the time this runs)."""
    m = _PANORAMA_FOR_PATTERN.search(query)
    if m:
        return {"intent": "panorama", "from_text": None, "to_text": _clean(m.group(1))}
    if _PANORAMA_GENERIC_PATTERN.search(query):
        return {"intent": "panorama", "from_text": None, "to_text": None}

    for pattern in (
        _WHERE_IS_PATTERN,
        _WHERE_CAN_FIND_PATTERN,
        _WHICH_FLOOR_IS_X_ON_PATTERN,
        _X_IS_ON_WHICH_FLOOR_PATTERN,
    ):
        m = pattern.search(query)
        if m:
            group = next(g for g in m.groups() if g)
            return {"intent": "location", "from_text": None, "to_text": _clean(group)}

    m = _LOCATION_OF_PATTERN.search(query)
    if m:
        group = next(g for g in m.groups() if g)
        return {"intent": "location", "from_text": None, "to_text": _clean(group)}

    # Last resort: a bare room-number mention with none of the phrasings
    # above — e.g. "room no 202?" typed with no verb at all. Still a clear,
    # unambiguous location intent (nothing else "room 202" could mean), so
    # safe to route without a strong sentence-level cue.
    if _BARE_ROOM_PATTERN.search(query):
        return {"intent": "location", "from_text": None, "to_text": _clean(query)}

    return {"intent": "none", "from_text": None, "to_text": None}


def _format_location_answer(detail: dict[str, Any], entity_type: str) -> str:
    if entity_type == "room":
        parts = [detail["name"]]
        if detail.get("room_number"):
            parts.append(f"({detail['room_number']})")
        location_bits = [b for b in (detail.get("floor_name"), detail.get("building_name")) if b]
        if location_bits:
            parts.append("is located on " + ", ".join(location_bits) + ".")
        return " ".join(parts)
    parts = [detail["name"]]
    if detail.get("code"):
        parts.append(f"({detail['code']})")
    parts.append("is one of the campus buildings.")
    return " ".join(parts)


def _format_panorama_answer(tool_result: dict[str, Any]) -> str:
    panorama = tool_result["panorama"]
    title = panorama.get("title") or f"scene at node #{panorama['node_id']}"
    if tool_result["status"] == "panorama_found":
        return f"The panorama for this location is: {title}."
    return (
        f"There's no panorama directly at that location — the nearest one is: "
        f"{title} ({tool_result['distance']:.0f}m away)."
    )


def _format_clarification(candidates: list[dict[str, Any]]) -> str:
    names = ", ".join(c["name"] for c in candidates)
    return (
        f"That could refer to more than one place on campus: {names}. "
        "Could you clarify which one you mean?"
    )


def _tool_response(
    query: str, tool_name: str, tool_result: dict[str, Any], answer: str
) -> dict[str, Any]:
    """Mirrors agent_base's Agent Response Contract, but for a
    tool-resolved (not RAG-generated) answer — confidence is 1.0 because
    this is a direct, deterministic database lookup, not a probabilistic
    retrieval score. sources/source_urls stay empty on purpose (no GAT
    website/PDF was involved); tool_used/tool_result carry the real
    provenance instead, per Phase 6's source-traceability requirement."""
    return {
        "original_query": query,
        "selected_agent": AGENT_NAME,
        "retrieved_context": [],
        "confidence_score": 1.0,
        "confidence_level": "HIGH",
        "generation_status": "tool_resolved",
        "answer": answer,
        "sources": [],
        "source_urls": [],
        "refusal_reason": None,
        "grounded": True,
        "tool_used": tool_name,
        "tool_result": tool_result,
    }


def _spatial_response(query: str, spatial_result: dict[str, Any]) -> dict[str, Any]:
    """Builds the Agent Response Contract for a spatial_knowledge.py lookup.
    Unlike _tool_response() (used for the 100%-certain PostgreSQL lookups),
    confidence here is the REAL evidence-derived value from Phase 9 — never
    hardcoded to 1.0/HIGH, per Phase 10's explicit "do not force confidence
    to 1.0" requirement. A not_found/not_found_confirmed result is honestly
    reported as ungrounded (no fabricated location), matching the same
    refusal shape the rest of the pipeline already uses."""
    answer, confidence, status = format_spatial_answer(spatial_result)
    grounded = status in ("resolved", "low_confidence", "ambiguous")
    generation_status = {
        "resolved": "tool_resolved",
        "low_confidence": "tool_resolved_low_confidence",
        "ambiguous": "clarification_needed",
        "not_found": "no_context",
        "not_found_confirmed": "no_context",
    }[status]
    return {
        "original_query": query,
        "selected_agent": AGENT_NAME,
        "retrieved_context": [],
        "confidence_score": confidence,
        "confidence_level": categorize_confidence(confidence),
        "generation_status": generation_status,
        "answer": answer,
        "sources": [],
        "source_urls": [],
        "refusal_reason": None if grounded else "No verified spatial record matched this query.",
        "grounded": grounded,
        "tool_used": "spatial_knowledge",
        "tool_result": spatial_result,
    }


def _clarification_response(
    query: str, tool_name: str, tool_result: dict[str, Any]
) -> dict[str, Any]:
    return {
        "original_query": query,
        "selected_agent": AGENT_NAME,
        "retrieved_context": [],
        "confidence_score": 1.0,
        "confidence_level": "HIGH",
        "generation_status": "clarification_needed",
        "answer": _format_clarification(tool_result["candidates"]),
        "sources": [],
        "source_urls": [],
        "refusal_reason": "The location query matched more than one real campus location.",
        "grounded": True,
        "tool_used": tool_name,
        "tool_result": tool_result,
    }


def handle(query: str) -> dict[str, Any]:
    classification = classify_navigation_query(query)

    if classification["intent"] == "panorama":
        if not classification["to_text"]:
            # "What panorama should I open next?" with no named location and
            # no session/current-location concept in this stateless pipeline
            # (see docs/RAG_ARCHITECTURE.md's Phase 6 limitations) — honestly
            # reported rather than guessed at.
            return {
                "original_query": query,
                "selected_agent": AGENT_NAME,
                "retrieved_context": [],
                "confidence_score": 1.0,
                "confidence_level": "HIGH",
                "generation_status": "clarification_needed",
                "answer": (
                    "I don't have a way to know your current location in the tour "
                    'yet — please name a specific place (e.g. "panorama for the '
                    'library").'
                ),
                "sources": [],
                "source_urls": [],
                "refusal_reason": (
                    "No current-location/session context is available to this pipeline."
                ),
                "grounded": True,
                "tool_used": "panorama_lookup",
                "tool_result": None,
            }

        tool_result = panorama_lookup(classification["to_text"])
        if tool_result["status"] in ("panorama_found", "nearest_panorama_found"):
            tool_result["hotspots"] = hotspot_lookup(tool_result["panorama"]["node_id"])["matches"]
            return _tool_response(
                query, "panorama_lookup", tool_result, _format_panorama_answer(tool_result)
            )
        if tool_result["status"] == "ambiguous":
            return _clarification_response(query, "panorama_lookup", tool_result)

        result = run_specialist(AGENT_NAME, query)
        result["navigation_tool_result"] = tool_result
        return result

    if classification["intent"] == "location" and classification["to_text"]:
        # Phase 10: spatial_knowledge.py (Phase 9's panorama-derived JSON)
        # is consulted first — it's the only source that covers the real
        # main-building room numbers. IMPORTANT distinction preserved here:
        # "not_found" (Phase 9 has no data on this number at all — most
        # possible room numbers were never asked about) falls through to
        # the legacy campus_tools.resolve_location()/RAG path exactly as
        # before Phase 10, so numbers only the older placeholder data knows
        # about (e.g. "Room 101") keep working. "not_found_confirmed" (one
        # of the 6 numbers Phase 9 explicitly searched the ENTIRE panorama
        # set for and did not find, e.g. Room 301) is a real, deliberate
        # answer in its own right and is returned directly — that is
        # Section 13's hallucination-prevention requirement, not a gap.
        spatial_result = search_spatial(classification["to_text"])
        if spatial_result["status"] in (
            "resolved",
            "low_confidence",
            "ambiguous",
            "not_found_confirmed",
        ):
            return _spatial_response(query, spatial_result)

        tool_result = resolve_location(classification["to_text"])
        if tool_result["status"] == "resolved":
            answer = _format_location_answer(tool_result["detail"], tool_result["entity_type"])
            return _tool_response(query, "campus_lookup", tool_result, answer)
        if tool_result["status"] == "ambiguous":
            return _clarification_response(query, "campus_lookup", tool_result)

        # Phase 10 performance fix: a query that is UNAMBIGUOUSLY asking
        # about a specific room number (extract_room_number matched) and
        # was checked against BOTH structured sources (Phase 9 spatial data
        # and PostgreSQL) with no match in either — answering this via the
        # full RAG pipeline anyway costs a real 8-18s LLM round trip (see
        # this phase's timeout investigation) just to arrive at the exact
        # same honest "no information" conclusion the retrieved GAT
        # documents were never going to contain in the first place (they
        # describe policy/regulations, not a per-room directory). Skip the
        # expensive, low-value RAG call and answer immediately — still
        # completely honest, just fast.
        if extract_room_number(classification["to_text"]):
            return _spatial_response(query, spatial_result)

        result = run_specialist(AGENT_NAME, query)
        result["navigation_tool_result"] = tool_result
        return result

    result = run_specialist(AGENT_NAME, query)
    result["navigation_tool_result"] = None
    return result


if __name__ == "__main__":
    for demo_query in [
        "Where is the library?",
        "How do I get to Room 101?",
        "Where is the auditorium?",
        "How can I reach the second floor?",
        "Show me the panorama for the library",
    ]:
        result = handle(demo_query)
        print(f"\n[{demo_query}] -> status={result['generation_status']}")
        print(f"  answer: {result['answer']}")
