"""Phase 5/6 — Campus Facilities Agent.

Handles: laboratories, classrooms, auditorium, library, hostel, canteen,
transportation, sports/indoor gym, other officially documented campus
facilities.

The RAG pipeline (agent_base.run_specialist(), Phase 2-4, unmodified)
remains the primary answer source — it already handles listing-style
facilities questions well ("What facilities are available?", "Is there an
indoor gym?"), which a single-entity DB lookup tool cannot answer (there's
no "list all facilities" query, only "find this one named place").

Phase 6 addition: when the query happens to name one specific, real,
navigable campus entity (e.g. "Where is the library?" routed here instead
of navigation_agent, or "Tell me about the CSE Block"), a supplementary
`resolved_location` field is attached from campus_tools.resolve_location()
— real building/room data from the database, not invented, and never
overriding the RAG answer. Most facilities queries are informational
listings and won't resolve to a single entity; `resolved_location` is
simply `None` in that case, which is expected and correct, not an error.
"""

from __future__ import annotations

from typing import Any

from agent_base import run_specialist
from campus_tools import resolve_location

AGENT_NAME = "facilities_agent"


def handle(query: str) -> dict[str, Any]:
    result = run_specialist(AGENT_NAME, query)
    location_hint = resolve_location(query)
    result["resolved_location"] = location_hint if location_hint["status"] == "resolved" else None
    return result


if __name__ == "__main__":
    for demo_query in ["What facilities are available on campus?", "Tell me about the library"]:
        result = handle(demo_query)
        print(f"\n[{demo_query}] -> status={result['generation_status']}")
        print(f"  answer: {result['answer']}")
        print(f"  resolved_location: {result['resolved_location']}")
