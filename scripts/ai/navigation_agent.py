"""Phase 5 — Navigation Agent.

Handles: building locations, floor locations, room locations, campus
navigation requests, indoor navigation-related questions.

Two distinct things happen for a navigation query, and they are kept
deliberately separate:

1. The existing Phase 2-4 RAG pipeline still runs (via
   agent_base.run_specialist()), same as every other agent — the official
   GAT knowledge base does contain some location-flavored text (e.g. the
   campus address in official PDFs), so a grounded, source-traceable
   answer is attempted exactly like any other query.
2. `NavigationAdapter.resolve()` — a clean, documented INTEGRATION POINT
   for the existing indoor navigation engine (backend/app/navigation/:
   pathfinding.py, building_search.py, room_search.py, nearby.py — and the
   /api/v1/navigate-family endpoints built on top of them). This adapter
   does NOT call, import, wrap, or reimplement any of that code — Phase 5
   explicitly forbids rewriting A*, the navigation graph, or touching
   hotspot/panorama navigation. `scripts/ai/` is also, by this project's
   own established convention (see Phase 1's audit notes and CLAUDE.md's
   "scripts/ never imported by the running application"), not allowed to
   import backend/app/* directly. `resolve()` therefore returns a typed
   "not yet integrated" status and documents exactly what a real
   integration would call, rather than faking a working connection.
"""

from __future__ import annotations

from typing import Any

from agent_base import run_specialist

AGENT_NAME = "navigation_agent"


class NavigationAdapter:
    """Future integration point only — see module docstring. Every method
    here is a documented stub, not a working call into
    backend/app/navigation/."""

    @staticmethod
    def resolve(query: str) -> dict[str, Any]:
        return {
            "status": "not_yet_integrated",
            "query": query,
            "note": (
                "Phase 5 provides this adapter interface only. A real integration "
                "would call the existing backend/app/navigation/ pathfinding, "
                "building_search, or room_search modules (or the deployed "
                "/api/v1/navigate-family HTTP endpoints) from here — none of that "
                "code is invoked, modified, or duplicated by this stub."
            ),
        }


def handle(query: str) -> dict[str, Any]:
    result = run_specialist(AGENT_NAME, query)
    result["navigation_hint"] = NavigationAdapter.resolve(query)
    return result


if __name__ == "__main__":
    result = handle("Where is the main building?")
    print(f"[{result['generation_status']}] {result['answer']}")
    print(f"navigation_hint: {result['navigation_hint']}")
