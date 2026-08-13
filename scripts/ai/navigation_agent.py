"""Phase 6 — Navigation Agent (real tool integration).

Handles: building locations, floor locations, room locations,
panorama/tour lookups — location and spatial-lookup questions, not
routing.

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

AGENT_NAME = "navigation_agent"

_PANORAMA_FOR_PATTERN = re.compile(r"panorama\s+(?:for|of)\s+(.+)", re.IGNORECASE)
_PANORAMA_GENERIC_PATTERN = re.compile(
    r"(?:what|which) panorama should i (?:open|see|view|show)", re.IGNORECASE
)

_WHERE_IS_PATTERN = re.compile(r"where(?:'s| is)\s+(.+)", re.IGNORECASE)


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

    m = _WHERE_IS_PATTERN.search(query)
    if m:
        return {"intent": "location", "from_text": None, "to_text": _clean(m.group(1))}

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
        tool_result = resolve_location(classification["to_text"])
        if tool_result["status"] == "resolved":
            answer = _format_location_answer(tool_result["detail"], tool_result["entity_type"])
            return _tool_response(query, "campus_lookup", tool_result, answer)
        if tool_result["status"] == "ambiguous":
            return _clarification_response(query, "campus_lookup", tool_result)

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
