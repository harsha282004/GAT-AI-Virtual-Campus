"""Phase 5 — Admission Agent.

Handles: admission process, eligibility, application information,
admission-related documents, UG/PG admission information.

Runs the existing Phase 2-4 pipeline via agent_base.run_specialist() — no
retrieval/reranking/confidence/generation logic lives here. See
supervisor.py for how queries get routed to this agent.
"""

from __future__ import annotations

from typing import Any

from agent_base import run_specialist

AGENT_NAME = "admission_agent"


def handle(query: str) -> dict[str, Any]:
    return run_specialist(AGENT_NAME, query)


if __name__ == "__main__":
    result = handle("What is the admission process?")
    print(f"[{result['generation_status']}] {result['answer']}")
