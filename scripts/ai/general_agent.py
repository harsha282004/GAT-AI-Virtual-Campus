"""Phase 5 — General Information Agent.

Handles: general college information, institution information, official
contact information, and queries that don't clearly belong to another
specialized agent (including this router's default fallback — see
supervisor.py — for queries that match no domain keywords at all, such as
questions unrelated to GAT entirely; the confidence gate inside the shared
pipeline is what actually keeps those safe, not the routing choice).

Runs the existing Phase 2-4 pipeline via agent_base.run_specialist() — no
retrieval/reranking/confidence/generation logic lives here.
"""

from __future__ import annotations

from typing import Any

from agent_base import run_specialist

AGENT_NAME = "general_agent"


def handle(query: str) -> dict[str, Any]:
    return run_specialist(AGENT_NAME, query)


if __name__ == "__main__":
    result = handle("What is the official contact information?")
    print(f"[{result['generation_status']}] {result['answer']}")
