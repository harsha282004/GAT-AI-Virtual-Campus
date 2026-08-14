"""Phase 5 — Shared specialist-agent pipeline runner.

Every specialist agent (admission_agent.py, academic_agent.py,
facilities_agent.py, navigation_agent.py, general_agent.py) calls
`run_specialist()` rather than each re-implementing retrieval, reranking,
confidence, or generation — the Phase 1-4 pipeline is called from exactly
one place, per the Phase 5 instruction not to duplicate it inside every
agent. This module contains no domain-specific logic (no keywords, no
routing) — that belongs to supervisor.py.

Reuses, unmodified: hybrid_retrieval.hybrid_search (Phase 2),
reranker.rerank (Phase 3), confidence.compute_confidence (Phase 3),
llm_generator.generate_answer (Phase 4) — including Phase 4's own
LOW-confidence short-circuit and Ollama-failure handling, which this
module does not re-implement or bypass.

PHASE 11 ADDITION — context_selection.select_context() runs between
rerank() and compute_confidence()/generate_answer(): it drops near-duplicate
chunks and chunks scoring far below the top result (see that module's
docstring), so confidence scoring and the LLM prompt both see the same,
already-cleaned context set instead of the raw top-k reranked list. This is
a filter only — it never reorders or fabricates content, and reranker.py's
own scoring is untouched.
"""

from __future__ import annotations

from typing import Any

from _shared import configure_logging
from confidence import compute_confidence
from context_selection import select_context
from hybrid_retrieval import DEFAULT_CANDIDATE_N, hybrid_search
from llm_generator import generate_answer
from reranker import DEFAULT_TOP_K, rerank

logger = configure_logging("agent_base")

# Matches Phase 4's own preferred-model default. Deliberately NOT imported
# from llm_generator.OLLAMA_MODEL: this project's pre-existing .env sets
# OLLAMA_MODEL=llama3 (a legacy value that predates Phase 4), which would
# silently shadow llama3.2 — the model Phase 4/5 actually target and the
# one confirmed pulled (`ollama list` -> llama3.2:latest). See Phase 4's
# test_llm_generation.py for the same fix applied the same way.
DEFAULT_AGENT_MODEL = "llama3.2"

# Maps Phase 4's existing generation_status values to a human-readable
# refusal reason. Only statuses that represent "no answer was generated"
# get a reason; "generated" maps to None. No new statuses are invented —
# this is purely a presentation layer over Phase 4's existing contract.
_REFUSAL_REASONS = {
    "low_confidence_refusal": (
        "Retrieval confidence was too low to generate a reliable grounded answer."
    ),
    "no_context": "No relevant official GAT context was retrieved for this query.",
    "ollama_unreachable": "The local Ollama service is unreachable.",
    "model_unavailable": "The preferred local LLM model is not available in Ollama.",
    "generation_failed": "The LLM generation call failed.",
}


def run_specialist(
    agent_name: str, query: str, top_k: int = DEFAULT_TOP_K, model: str = DEFAULT_AGENT_MODEL
) -> dict[str, Any]:
    """Runs the full existing Phase 2-4 pipeline for `query` and wraps the
    result in the Phase 5 Agent Response Contract. `agent_name` is a label
    only — every specialist agent runs the identical pipeline; what
    differs between agents is which queries the Supervisor routes to them,
    not how they answer once routed.
    """
    candidates = hybrid_search(query, top_k=DEFAULT_CANDIDATE_N)
    reranked = rerank(query, candidates, top_k=top_k)
    selected_context = select_context(reranked)
    confidence = compute_confidence(selected_context, query)
    generation = generate_answer(query, selected_context, confidence, model=model)

    retrieved_context = [
        {
            "chunk_id": r["chunk_id"],
            "source_title": r["source_title"],
            "source_url": r["source_url"],
            "page": r["page"],
            "hybrid_score": r["hybrid_score"],
            "rerank_score": r["rerank_score"],
        }
        for r in selected_context
    ]
    source_urls = [s["source_url"] for s in generation["sources"] if s.get("source_url")]

    return {
        "original_query": query,
        "selected_agent": agent_name,
        "retrieved_context": retrieved_context,
        "confidence_score": generation["confidence"],
        "confidence_level": generation["confidence_level"],
        "generation_status": generation["generation_status"],
        "answer": generation["answer"],
        "sources": generation["sources"],
        "source_urls": source_urls,
        "refusal_reason": _REFUSAL_REASONS.get(generation["generation_status"]),
        "grounded": generation["grounded"],
        "model": generation.get("model"),
        "rerank_mode": reranked[0]["rerank_mode"] if reranked else None,
        "context_chunks_considered": len(reranked),
        "context_chunks_used": len(selected_context),
    }
