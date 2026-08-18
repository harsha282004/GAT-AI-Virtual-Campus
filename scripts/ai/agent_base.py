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

PHASE 12 ADDITION — context_selection.apply_domain_boost() runs
immediately after rerank(), before select_context(): `agent_name` (already
a parameter here since Phase 5 — the Supervisor's routing decision, not a
new signal) nudges reranked scores toward the calling agent's known-domain
sources by a small fixed amount, for the one domain with an established
pattern. select_context()'s weak-chunk floor is then computed against the
boosted scores, so a borderline same-domain chunk has a slightly better
chance of surviving that floor than an equally-scored off-domain one.

FEE/ADMISSIONS PHASE ADDITION — curated-answer fallback: when
generate_answer() did NOT produce a confidently-grounded RAG answer —
generation_status other than "generated", OR confidence_level below HIGH,
OR (found via live testing) a "generated" HIGH-confidence answer whose
own text is a hedge/refusal ("does not mention...", "cannot find...";
retrieval scored the query well but the LLM still had nothing solid to
say) — this falls through to curated_answers.find_curated_answer() BEFORE
returning the existing LOW_CONFIDENCE_MESSAGE fallback. Priority is
therefore exactly: confident grounded RAG answer > curated answer >
existing fallback message — never the reverse, and a curated answer is
never returned instead of a real, non-hedging RAG answer that already
succeeded.
"""

from __future__ import annotations

import re
from typing import Any

from _shared import configure_logging
from confidence import compute_confidence
from context_selection import apply_domain_boost, select_context
from curated_answers import find_curated_answer
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
# get a reason; "generated" maps to None. Phase 14 adds exactly one new
# status (grounding_check_failed) for the same reason this comment already
# describes — everything else here is still Phase 4's original contract.
_REFUSAL_REASONS = {
    "low_confidence_refusal": (
        "Retrieval confidence was too low to generate a reliable grounded answer."
    ),
    "no_context": "No relevant official GAT context was retrieved for this query.",
    "ollama_unreachable": "The local Ollama service is unreachable.",
    "model_unavailable": "The preferred local LLM model is not available in Ollama.",
    "generation_failed": "The LLM generation call failed.",
    "grounding_check_failed": (
        "The generated answer contained a specific claim that could not be verified "
        "against the retrieved context."
    ),
}

# Phrases the LLM tends to use when retrieval scored a query well enough
# to reach generation (confidence_level HIGH) but the actual retrieved
# text didn't really answer the question — a "generated" status alone
# doesn't distinguish this from a genuinely good answer, so the answer
# text itself is checked too before deciding whether curated_answers is
# worth consulting.
_HEDGE_PATTERN = re.compile(
    r"does not (provide|contain|mention|specify)|"
    r"doesn't (provide|contain|mention|specify|have)|"
    r"cannot (find|determine|provide)|"
    r"no (specific )?information (is )?(available|provided)|"
    r"not (explicitly )?(stated|mentioned|specified) in the",
    re.IGNORECASE,
)


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
    reranked = apply_domain_boost(reranked, agent_name)
    selected_context = select_context(reranked)
    confidence = compute_confidence(selected_context, query)
    generation = generate_answer(query, selected_context, confidence, model=model)

    # Curated-answer fallback tier — only consulted when RAG itself did not
    # produce a confidently-grounded answer (see this module's docstring
    # for the exact priority order). A HIGH-confidence "generated" answer
    # is never overridden. A LOW-confidence refusal (status != "generated")
    # or a MEDIUM-confidence "generated" answer (the LLM was called but
    # confidence was already uncertain — in practice these are often
    # hedging non-answers, e.g. "the context does not mention...") both
    # fall through to the curated check, since a genuinely matching
    # curated answer (similarity >= SIMILARITY_THRESHOLD) is more useful
    # than an uncertain generated one.
    is_hedging_answer = bool(_HEDGE_PATTERN.search(generation.get("answer") or ""))
    if (
        generation["generation_status"] != "generated"
        or generation.get("confidence_level") != "HIGH"
        or is_hedging_answer
    ):
        curated = find_curated_answer(query)
        if curated is not None:
            logger.info(
                "Using curated answer for query=%r (agent=%s, matched_question=%r, similarity=%.3f)",
                query,
                agent_name,
                curated["question"],
                curated["similarity"],
            )
            generation = {
                **generation,
                "answer": curated["answer"],
                "confidence": curated["similarity"],
                "confidence_level": "HIGH",
                "generation_status": "curated_answer",
                "sources": [
                    {
                        "title": curated.get("source") or "Curated Answer (GAT Admissions Office)",
                        "source_url": None,
                        "page": None,
                    }
                ],
                "grounded": True,
            }

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
