"""Phase 11 — Context validation / selection.

Sits between reranking (Phase 3, reranker.py) and confidence/generation
(Phase 3/4, confidence.py + llm_generator.py): filters the reranked
candidate set down to what is actually worth handing to the LLM, without
touching reranker.py's scoring itself or hybrid_retrieval.py's fusion.
Two deterministic, explainable rules only — no learned model, no new
fabricated behaviour, nothing here ever adds or rewrites chunk text:

1. Near-duplicate collapse. Phase 1's chunker uses ~800-char chunks with a
   120-char overlap (see build_embeddings.py), so two adjacent chunks from
   the same source page can carry substantially the same sentence twice.
   For any two chunks whose token sets overlap heavily (Jaccard >=
   DUPLICATE_JACCARD_THRESHOLD), only the higher-ranked one is kept.
2. Weak-chunk floor. A chunk scoring far below the top result adds noise
   rather than corroboration — "a weak irrelevant chunk should not dilute
   or override a strong verified record". Any chunk scoring below
   RELATIVE_SCORE_FLOOR * top1's rerank_score is dropped, EXCEPT the top1
   result itself, which is never dropped (a lone-result answer never loses
   its only evidence).

Called from agent_base.run_specialist() immediately after rerank() and
before compute_confidence()/generate_answer(), so the confidence score and
the LLM's context reflect the exact same chunk set — not two slightly
different views of retrieval.

PHASE 12 ADDITION — apply_domain_boost(): Phase 10's intent-driven routing
already tells us which specialist agent is answering a query (e.g.
academic_agent for a COURSES/DEPARTMENTS intent); this is a small, optional
signal used to nudge — never override — reranking for the one domain where
a reliable URL-pattern signal already exists (kept in sync with
academic_agent.py's own _DEPARTMENT_PAGE_PATTERN, duplicated rather than
imported for the same reason supervisor.py duplicates
navigation_agent.py's room-number pattern instead of importing it — a
small, self-contained regex is cheaper to keep in sync than to add a new
cross-module dependency for). A same-domain chunk gets a small fixed bonus;
everything else is untouched. This runs AFTER reranker.py's own scoring and
BEFORE select_context() above, so the weak-chunk floor is computed against
the boosted (final) scores.
"""

from __future__ import annotations

import re
from typing import Any

from hybrid_retrieval import _tokenize

# Two chunks this similar (by token Jaccard) are treated as saying the same
# thing — keeping both would just repeat the same sentence in the prompt
# without adding corroborating information.
DUPLICATE_JACCARD_THRESHOLD = 0.75

# A chunk scoring below this fraction of the top result's rerank_score is
# dropped as noise. Chosen conservatively (0.35) so it only removes chunks
# that are clearly much weaker than the best evidence, not merely
# second-best — see reranker.py's HEURISTIC_WEIGHTS for the [0, 1] scale
# this is measured against.
RELATIVE_SCORE_FLOOR = 0.35


def _jaccard(a: set[str], b: set[str]) -> float:
    if not a and not b:
        return 0.0
    union = a | b
    if not union:
        return 0.0
    return len(a & b) / len(union)


# Phase 12 — one entry per specialist agent we have a reliable,
# already-established URL-pattern signal for. Deliberately small: a wrong
# or over-eager boost pattern would bias retrieval toward the wrong
# evidence, so only academic_agent's proven-in-Phase-11 department/program
# page pattern is included, not a guessed pattern for every agent.
_DOMAIN_SOURCE_PATTERNS: dict[str, re.Pattern[str]] = {
    "academic_agent": re.compile(r"gat\.ac\.in/[^/]*engineering[^/]*\.html$", re.IGNORECASE),
}

# A small, fixed nudge (not a ranking override) — see this module's
# docstring. reranker.py's own heuristic score is already in [0, 1]; this
# can move a same-domain chunk up by at most this much.
DOMAIN_BOOST = 0.05


def apply_domain_boost(
    reranked: list[dict[str, Any]], agent_name: str | None
) -> list[dict[str, Any]]:
    """reranked (reranker.rerank() output) -> the same list, with a small
    score bonus applied to chunks whose source_url matches the calling
    agent's known domain pattern, re-sorted by the resulting score. A no-op
    (returns the input unchanged) when no pattern is registered for
    agent_name — the common case for every agent except academic_agent
    today."""
    pattern = _DOMAIN_SOURCE_PATTERNS.get(agent_name or "")
    if pattern is None or not reranked:
        return reranked

    boosted = []
    for r in reranked:
        score = r["rerank_score"]
        if pattern.search(r.get("source_url") or ""):
            score = round(min(1.0, score + DOMAIN_BOOST), 4)
        boosted.append({**r, "rerank_score": score})

    boosted.sort(key=lambda r: r["rerank_score"], reverse=True)
    return boosted


def select_context(reranked: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """reranker.rerank() output (already sorted by rerank_score desc) -> a
    filtered subset safe to hand to confidence scoring + the LLM. Never
    reorders and never fabricates a field, only removes entries. Always
    keeps at least the top-ranked chunk when the input is non-empty, so an
    answer can never lose its single best piece of evidence."""
    if not reranked:
        return []

    top_score = reranked[0]["rerank_score"]
    kept: list[dict[str, Any]] = []
    kept_token_sets: list[set[str]] = []

    for i, chunk in enumerate(reranked):
        if i > 0 and top_score > 0 and chunk["rerank_score"] < RELATIVE_SCORE_FLOOR * top_score:
            continue

        tokens = set(_tokenize(chunk.get("text") or ""))
        if any(
            _jaccard(tokens, existing) >= DUPLICATE_JACCARD_THRESHOLD
            for existing in kept_token_sets
        ):
            continue

        kept.append(chunk)
        kept_token_sets.append(tokens)

    return kept if kept else reranked[:1]


if __name__ == "__main__":
    from hybrid_retrieval import DEFAULT_CANDIDATE_N, hybrid_search
    from reranker import rerank

    for demo_query in [
        "What undergraduate programs are offered?",
        "What facilities are available on campus?",
    ]:
        candidates = hybrid_search(demo_query, top_k=DEFAULT_CANDIDATE_N)
        reranked = rerank(demo_query, candidates, top_k=5)
        selected = select_context(reranked)
        print(f"\n[{demo_query}] reranked={len(reranked)} -> selected={len(selected)}")
        for r in selected:
            print(f"  [{r['rerank_score']:.4f}] {r['source_url']}")
