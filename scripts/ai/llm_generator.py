"""Phase 4 — Grounded LLM answer generation.

Wires the full pipeline together: hybrid retrieval (Phase 2,
hybrid_retrieval.py) -> reranking (Phase 3, reranker.py) -> confidence
scoring (Phase 3, confidence.py) -> grounded LLM generation (this module)
-> a source-traceable answer. No Phase 1-3 code is modified; this module
only imports and calls it.

LLM runtime: Ollama, called via LangChain (`langchain_ollama.ChatOllama`)
— per the project's approved stack (CLAUDE.md: "LLM ... called via
LangChain — local, no external API key"). No OpenAI or other paid/external
API is ever used. Preferred model for this phase is **llama3.2** (this
phase's explicit instruction); overridable via the existing OLLAMA_MODEL
env var already used by backend/app/core/config.py, so one .env value can
drive both. If Ollama itself is unreachable, or the preferred model isn't
pulled, this is reported as a typed status — never silently substituted
for a different model, and never papered over with a fabricated answer.

Usage:
    from llm_generator import answer_question
    result = answer_question("What undergraduate programs are offered?")
"""

from __future__ import annotations

import os
from typing import Any

import ollama
from _shared import configure_logging
from confidence import compute_confidence
from hybrid_retrieval import DEFAULT_CANDIDATE_N, hybrid_search
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_ollama import ChatOllama
from reranker import DEFAULT_TOP_K, rerank

logger = configure_logging("llm_generator")

OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
# This phase's explicitly preferred model (not config.py's "llama3"
# default) — but still reads the same OLLAMA_MODEL env var backend/app/
# core/config.py uses, so a project .env can override both consistently.
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.2")
REQUEST_TIMEOUT_S = 60

SYSTEM_PROMPT = """You are the GAT Virtual Campus Assistant, answering questions about \
Global Academy of Technology (GAT) using ONLY the official GAT context supplied to you below.

Rules you must follow exactly:
- Answer only using the supplied CONTEXT. Do not invent GAT facts.
- Do not assume information that is not present in the CONTEXT.
- Do not use general knowledge, prior training data, or assumptions about colleges in \
general to fill in missing GAT-specific information.
- If the CONTEXT does not contain enough information to answer confidently, say so \
explicitly — state that the available official GAT information does not provide a \
reliable answer to this specific question, rather than guessing.
- Never invent faculty names, phone numbers, departments, fees, timings, locations, \
rules, courses, or facilities that are not explicitly stated in the CONTEXT.
- Be concise and useful. Preserve important factual details (numbers, names, dates) \
exactly as given in the CONTEXT.
- If multiple context passages provide information, combine them carefully without \
contradicting each other; if they conflict, note the discrepancy rather than picking \
one arbitrarily.
- Do not mention chunk IDs, retrieval scores, or internal system implementation \
details in your answer — write for a prospective student or visitor, not a developer."""

MEDIUM_CONFIDENCE_ADDENDUM = (
    "\n\nThe retrieved context for this question is only moderately relevant. "
    "If you are not fully certain the context actually answers the question, say so "
    "explicitly rather than guessing, and describe only what the context does support."
)

LOW_CONFIDENCE_MESSAGE = (
    "The available official GAT information does not provide a reliable answer to this "
    "question. Please check the official GAT website (https://www.gat.ac.in/) or contact "
    "the institution directly for accurate information."
)


def check_ollama_availability(model: str = OLLAMA_MODEL) -> dict[str, Any]:
    """Probes the local Ollama service directly (cheaper and clearer than
    instantiating a ChatOllama and sending a full chat request just to test
    reachability). Never raises — always returns a status dict so callers
    can degrade gracefully instead of crashing."""
    try:
        response = ollama.Client(host=OLLAMA_BASE_URL).list()
    except Exception as exc:
        return {
            "reachable": False,
            "model_available": False,
            "available_models": [],
            "error": f"{type(exc).__name__}: {exc}",
        }

    available_models = [m.model for m in response.models if m.model]
    # Match ignoring tag (":latest" etc.) so "llama3.2" matches "llama3.2:latest".
    model_available = any(name.split(":")[0] == model.split(":")[0] for name in available_models)
    return {
        "reachable": True,
        "model_available": model_available,
        "available_models": available_models,
        "error": None if model_available else f"model '{model}' not found in `ollama list`",
    }


def _build_context_block(context_chunks: list[dict[str, Any]]) -> str:
    parts = []
    for i, chunk in enumerate(context_chunks, start=1):
        title = chunk.get("source_title") or chunk.get("source_url") or "unknown source"
        parts.append(f"[{i}] (Source: {title})\n{chunk.get('text', '')}")
    return "\n\n".join(parts)


def _build_sources(context_chunks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Sources are assembled from the retrieved chunks' own metadata only —
    never parsed out of the LLM's generated text — so a citation can never
    exist unless it traces back to an actual retrieved chunk."""
    sources = []
    for chunk in context_chunks:
        sources.append(
            {
                "title": chunk.get("source_title"),
                "source_url": chunk.get("source_url"),
                "page": chunk.get("page"),
            }
        )
    return sources


def _validate_inputs(
    query: str, context_chunks: list[dict[str, Any]], confidence: dict[str, Any]
) -> None:
    if not query or not query.strip():
        raise ValueError("query must be a non-empty string")
    if not isinstance(context_chunks, list):
        raise ValueError("context_chunks must be a list")
    if "category" not in confidence or "confidence" not in confidence:
        raise ValueError("confidence must be a confidence.compute_confidence() result")


def generate_answer(
    query: str,
    retrieved_context: list[dict[str, Any]],
    confidence: dict[str, Any],
    model: str = OLLAMA_MODEL,
) -> dict[str, Any]:
    """query -> grounded, source-traceable answer.

    retrieved_context: reranker.rerank() output (chunk_id/text/source_url/
    source_title/page/... per chunk).
    confidence: confidence.compute_confidence() output for this same
    retrieved_context — reused as-is, no new confidence math here.
    """
    _validate_inputs(query, retrieved_context, confidence)
    category = confidence["category"]
    sources = _build_sources(retrieved_context)

    if not retrieved_context:
        return {
            "question": query,
            "answer": LOW_CONFIDENCE_MESSAGE,
            "confidence": confidence["confidence"],
            "confidence_level": category,
            "sources": [],
            "grounded": False,
            "generation_status": "no_context",
            "model": None,
        }

    # Step 5 — confidence-aware generation: LOW confidence skips the LLM
    # entirely and returns a fixed safe response. This is deliberate, not
    # a fallback-of-convenience — low confidence means retrieval itself
    # already signaled the evidence is too weak to trust, so asking the
    # LLM to "try anyway" would just move the risk of an unsupported
    # answer from retrieval into generation instead of removing it.
    if category == "LOW":
        return {
            "question": query,
            "answer": LOW_CONFIDENCE_MESSAGE,
            "confidence": confidence["confidence"],
            "confidence_level": category,
            "sources": sources,
            "grounded": False,
            "generation_status": "low_confidence_refusal",
            "model": None,
        }

    availability = check_ollama_availability(model)
    if not availability["reachable"]:
        logger.warning("Ollama unreachable: %s", availability["error"])
        return {
            "question": query,
            "answer": None,
            "confidence": confidence["confidence"],
            "confidence_level": category,
            "sources": sources,
            "grounded": False,
            "generation_status": "ollama_unreachable",
            "model": None,
            "error": availability["error"],
        }
    if not availability["model_available"]:
        logger.warning(
            "Preferred model '%s' not available in Ollama (have: %s)",
            model,
            availability["available_models"],
        )
        return {
            "question": query,
            "answer": None,
            "confidence": confidence["confidence"],
            "confidence_level": category,
            "sources": sources,
            "grounded": False,
            "generation_status": "model_unavailable",
            "model": model,
            "error": availability["error"],
        }

    system_prompt = SYSTEM_PROMPT
    if category == "MEDIUM":
        system_prompt += MEDIUM_CONFIDENCE_ADDENDUM

    context_block = _build_context_block(retrieved_context)
    user_prompt = (
        f"CONTEXT:\n{context_block}\n\nQUESTION: {query}\n\nAnswer using only the CONTEXT above."
    )

    try:
        llm = ChatOllama(
            base_url=OLLAMA_BASE_URL,
            model=model,
            client_kwargs={"timeout": REQUEST_TIMEOUT_S},
        )
        response = llm.invoke(
            [SystemMessage(content=system_prompt), HumanMessage(content=user_prompt)]
        )
        answer_text = (
            response.content if isinstance(response.content, str) else str(response.content)
        )
    except Exception as exc:  # noqa: BLE001 — any Ollama/LangChain failure degrades, never crashes
        logger.error("Ollama generation failed: %s: %s", type(exc).__name__, exc)
        return {
            "question": query,
            "answer": None,
            "confidence": confidence["confidence"],
            "confidence_level": category,
            "sources": sources,
            "grounded": False,
            "generation_status": "generation_failed",
            "model": model,
            "error": f"{type(exc).__name__}: {exc}",
        }

    return {
        "question": query,
        "answer": answer_text.strip(),
        "confidence": confidence["confidence"],
        "confidence_level": category,
        "sources": sources,
        "grounded": True,
        "generation_status": "generated",
        "model": model,
    }


def answer_question(
    query: str, top_k: int = DEFAULT_TOP_K, model: str = OLLAMA_MODEL
) -> dict[str, Any]:
    """Full pipeline convenience function: hybrid retrieval -> reranking ->
    confidence -> grounded generation, exactly matching this phase's
    diagram. Reuses Phase 2/3 code as-is (hybrid_search, rerank,
    compute_confidence) — no retrieval/reranking/confidence logic is
    duplicated here."""
    candidates = hybrid_search(query, top_k=DEFAULT_CANDIDATE_N)
    reranked = rerank(query, candidates, top_k=top_k)
    confidence = compute_confidence(reranked, query)
    return generate_answer(query, reranked, confidence, model=model)


if __name__ == "__main__":
    demo_query = "What undergraduate programs are offered at GAT?"
    availability = check_ollama_availability()
    print(f"Ollama availability: {availability}")
    result = answer_question(demo_query)
    print(f"\nQuestion: {result['question']}")
    print(
        f"Status: {result['generation_status']}  "
        f"(confidence={result['confidence']}, {result['confidence_level']})"
    )
    print(f"Answer: {result['answer']}")
    print(f"Sources: {result['sources']}")
