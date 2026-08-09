"""Phase 3 — Retrieval confidence scoring.

Estimates how reliable a set of retrieved-and-reranked chunks is, BEFORE
any LLM generation happens. Entirely retrieval-side: no LLM call, no
generation, independent of Phase 3's reranker only in the sense that it
consumes reranked results rather than computing anything itself from raw
text.

Confidence = INTENT_WEIGHT * intent_component + RETRIEVAL_WEIGHT * retrieval_component

    INTENT_WEIGHT = 0.4
    RETRIEVAL_WEIGHT = 0.6

`intent_component` is meant to be P(intent) from the LSTM intent classifier
described in CLAUDE.md's Phase 3 (backend/app/intent_model/) — which does
not exist yet in this repository. This module does NOT fabricate that
probability. `compute_confidence()` accepts `intent_probability: float |
None` as an explicit interface for that future classifier; when it is
`None` (today, always), a documented fallback is used instead — see
`_intent_component()` below — and every result is tagged with
`intent_source` so callers always know which path was used.

Usage:
    from confidence import compute_confidence
    result = compute_confidence(reranked_results, query="...")
"""

from __future__ import annotations

from typing import Any

# ---- Fusion weights, per the project's specified formula ----
INTENT_WEIGHT = 0.4
RETRIEVAL_WEIGHT = 0.6
assert abs(INTENT_WEIGHT + RETRIEVAL_WEIGHT - 1.0) < 1e-9

# ---- Confidence category thresholds ----
# Derived empirically, not chosen a priori: computed confidence for the 6
# in-domain GAT test questions plus 3 deliberately out-of-domain questions
# ("What is the population of Bangalore?", "What is the capital of
# France?", "How do I bake a chocolate cake?") and inspected the actual
# resulting values (see docs/RAG_ARCHITECTURE.md's Phase 3 section for the
# full table). Observed:
#   - all 3 out-of-domain queries: 0.4392-0.4687
#   - all 6 in-domain queries:     0.4824-0.6907
# MEDIUM_CONFIDENCE_THRESHOLD (0.48) sits in the gap between those two
# clusters, so every out-of-domain query in this run falls to LOW and every
# in-domain query falls to MEDIUM or higher. Within the in-domain cluster
# there's a second gap between 0.5159 and 0.6410 — HIGH_CONFIDENCE_THRESHOLD
# (0.58) sits there, separating "strong single supporting chunk" queries
# from "relevant but comparatively thin evidence" queries (e.g. "What
# departments are available?", "What is the official contact
# information?", both 0.48-0.52 — real content exists but is spread across
# many similar-scoring chunks rather than one clearly best match).
# These are thresholds fitted to one 9-query sample, not a validated
# statistical boundary — expect to revisit them once real user queries or a
# labelled eval set (Phase 7-style) are available.
HIGH_CONFIDENCE_THRESHOLD = 0.58
MEDIUM_CONFIDENCE_THRESHOLD = 0.48


def categorize(confidence: float) -> str:
    if confidence >= HIGH_CONFIDENCE_THRESHOLD:
        return "HIGH"
    if confidence >= MEDIUM_CONFIDENCE_THRESHOLD:
        return "MEDIUM"
    return "LOW"


def _retrieval_component(results: list[dict[str, Any]]) -> float:
    """Retrieval-quality component, in [0, 1].

    Built from the reranked top result(s) rather than raw retrieval scores,
    since rerank_score already folds in hybrid_score (normalized semantic +
    BM25 fusion) plus lexical-precision signals (query_term_coverage,
    exact_phrase_match) — see reranker.py. Two deterministic signals:

    1. top1_score: the best result's rerank_score — "how good is our
       single best piece of evidence".
    2. agreement: how far the 2nd/3rd results trail the top result. Small
       gaps mean multiple chunks corroborate the same answer (more
       reliable); a lone high-scoring result surrounded by much weaker
       ones is treated as slightly less reliable than the same top1_score
       backed by close runners-up.

    If there are no results at all, confidence is 0 — there is nothing to
    be confident about.
    """
    if not results:
        return 0.0

    scores = [r["rerank_score"] for r in results[:3]]
    top1 = scores[0]
    if len(scores) == 1:
        agreement = top1  # no runner-up to compare against — neutral, don't penalize
    else:
        # Mean absolute gap between top1 and the runners-up, expressed as a
        # fraction of top1's own scale (bounded to [0, 1]).
        gaps = [max(0.0, top1 - s) for s in scores[1:]]
        avg_gap = sum(gaps) / len(gaps)
        agreement = max(0.0, top1 - avg_gap)

    return max(0.0, min(1.0, 0.7 * top1 + 0.3 * agreement))


def _intent_component(query: str, retrieval_component: float) -> tuple[float, str]:
    """Documented placeholder for P(intent) (Step 5). No LSTM intent
    classifier exists in this codebase yet (see CLAUDE.md's Phase 3 —
    backend/app/intent_model/, not implemented). Returning a fabricated
    probability here would silently misrepresent an unbuilt component as a
    real signal, which Phase 3 explicitly forbids.

    Fallback (used only because no classifier exists): reuse the retrieval
    component itself as a stand-in for "does this look like a query our
    domain can answer" — a query that retrieves nothing relevant also has
    no clear matching intent. This is a deliberately conservative,
    transparent substitute, not a claim of real intent classification, and
    is always reported via `intent_source` so it is never confused with a
    real P(intent) once backend/app/intent_model/ exists.
    """
    del query  # unused by the fallback; kept in the signature for the future classifier
    return retrieval_component, "retrieval_fallback (no intent classifier implemented yet)"


def compute_confidence(
    results: list[dict[str, Any]],
    query: str,
    intent_probability: float | None = None,
) -> dict[str, Any]:
    """results: reranker.rerank() output (or hybrid_search() output — only
    `rerank_score` is required per item; falls back gracefully if absent).
    intent_probability: real P(intent) from a future classifier, in [0, 1].
    None (today's only valid value) triggers the documented fallback."""
    retrieval_component = _retrieval_component(results)

    if intent_probability is not None:
        if not 0.0 <= intent_probability <= 1.0:
            raise ValueError("intent_probability must be in [0, 1]")
        intent_component = intent_probability
        intent_source = "classifier"
    else:
        intent_component, intent_source = _intent_component(query, retrieval_component)

    confidence = INTENT_WEIGHT * intent_component + RETRIEVAL_WEIGHT * retrieval_component
    confidence = max(0.0, min(1.0, confidence))

    return {
        "confidence": round(confidence, 4),
        "category": categorize(confidence),
        "intent_component": round(intent_component, 4),
        "intent_source": intent_source,
        "retrieval_component": round(retrieval_component, 4),
        "top1_rerank_score": results[0]["rerank_score"] if results else None,
        "num_results": len(results),
    }


if __name__ == "__main__":
    from hybrid_retrieval import hybrid_search
    from reranker import rerank

    for demo_query in [
        "What undergraduate programs are offered?",
        "What is the population of Bangalore?",
    ]:
        candidates = hybrid_search(demo_query, top_k=10)
        reranked = rerank(demo_query, candidates, top_k=5)
        result = compute_confidence(reranked, demo_query)
        print(f"{demo_query!r} -> {result}")
