"""Phase 3 — Reranking + confidence test harness (Steps 6-9).

Runs the same 6 GAT questions used in Phase 2 through dense-only, BM25-only,
hybrid, and now reranked retrieval, plus retrieval confidence scoring; then
runs the same set against deliberately out-of-domain questions to check
that confidence actually distinguishes strong from weak retrieval
situations. Finishes with a full-corpus source-traceability audit.
Deliberately does not call an LLM — retrieval-only, like Phase 1/2's test
scripts.

Usage: python scripts/ai/test_reranking_confidence.py
"""

from __future__ import annotations

from confidence import compute_confidence
from hybrid_retrieval import DEFAULT_CANDIDATE_N, get_retriever
from reranker import get_reranker
from test_hybrid_retrieval import (
    _preview,
    _print_bm25_only,
    _print_dense_only,
    _print_hybrid,
    run_traceability_audit,
)

RELEVANT_QUESTIONS = [
    "What undergraduate programs are offered at GAT?",
    "What departments are available at Global Academy of Technology?",
    "What is the admission process?",
    "What facilities are available on the campus?",
    "What is the official contact information?",
    "Where is the college located?",
]

# Deliberately out-of-domain (Step 8) — none of these have any business
# being answered from the GAT knowledge base. Chosen to be plausible
# natural-language questions (not gibberish), so a low confidence score
# genuinely reflects "nothing relevant was retrieved", not "the query was
# unparseable".
UNRELATED_QUESTIONS = [
    "What is the population of Bangalore?",
    "What is the capital of France?",
    "How do I bake a chocolate cake?",
]

TOP_K = 3


def _print_reranked(retriever, query: str) -> list[dict]:
    hybrid_candidates = retriever.hybrid_search(query, top_k=DEFAULT_CANDIDATE_N)
    reranked = get_reranker().rerank(query, hybrid_candidates, top_k=TOP_K)
    print(f"\n  -- RERANKED (top {TOP_K}, mode={get_reranker().mode}) --")
    for rank, r in enumerate(reranked, start=1):
        print(
            f"  [{rank}] rerank={r['rerank_score']:.4f}  hybrid={r['hybrid_score']:.4f}  "
            f"source={r['source_url']}" + (f" (page {r['page']})" if r["page"] else "")
        )
        print(f"      title: {r['source_title']}")
        print(f"      features: {r['ranking_features']}")
        print(f"      {_preview(r['text'])}")
    return reranked


def _print_confidence(query: str, reranked: list[dict]) -> dict:
    result = compute_confidence(reranked, query)
    print(
        f"\n  -- CONFIDENCE -- score={result['confidence']:.4f}  "
        f"category={result['category']}  "
        f"(intent={result['intent_component']:.4f} [{result['intent_source']}], "
        f"retrieval={result['retrieval_component']:.4f})"
    )
    return result


def run_query_suite(questions: list[str], label: str) -> list[dict]:
    retriever = get_retriever()
    summary = []

    for question in questions:
        print("\n" + "=" * 100)
        print(f"[{label}] QUERY: {question}")
        print("=" * 100)

        dense_ids = _print_dense_only(retriever, question)
        bm25_ids = _print_bm25_only(retriever, question)
        hybrid_results = _print_hybrid(retriever, question)
        reranked_results = _print_reranked(retriever, question)
        confidence_result = _print_confidence(question, reranked_results)

        hybrid_ids = [r["chunk_id"] for r in hybrid_results]
        reranked_ids = [r["chunk_id"] for r in reranked_results]
        reorder_count = sum(1 for a, b in zip(hybrid_ids, reranked_ids) if a != b)
        print(
            f"\n  -- COMPARISON -- reranking changed the top-{TOP_K} order in "
            f"{reorder_count}/{TOP_K} positions relative to hybrid-only "
            f"(honest count — 0 means reranking agreed with hybrid for this query)"
        )

        summary.append(
            {
                "query": question,
                "label": label,
                "dense_top1": dense_ids[0] if dense_ids else None,
                "bm25_top1": bm25_ids[0] if bm25_ids else None,
                "hybrid_top1": hybrid_ids[0] if hybrid_ids else None,
                "reranked_top1": reranked_ids[0] if reranked_ids else None,
                "confidence": confidence_result["confidence"],
                "category": confidence_result["category"],
                "reranked_results": reranked_results,
            }
        )

    return summary


if __name__ == "__main__":
    relevant_summary = run_query_suite(RELEVANT_QUESTIONS, "RELEVANT")
    unrelated_summary = run_query_suite(UNRELATED_QUESTIONS, "UNRELATED")

    print("\n" + "=" * 100)
    print("CONFIDENCE SUMMARY (Step 8 — does confidence distinguish strong vs. weak retrieval?)")
    print("=" * 100)
    for item in relevant_summary + unrelated_summary:
        print(
            f"  [{item['label']:9}] conf={item['confidence']:.4f}  "
            f"cat={item['category']:>6}  {item['query']}"
        )

    all_relevant_ok = all(item["category"] != "LOW" for item in relevant_summary)
    all_unrelated_low = all(item["category"] == "LOW" for item in unrelated_summary)
    print(
        f"\n  All relevant queries scored MEDIUM/HIGH (not LOW): {all_relevant_ok}\n"
        f"  All unrelated queries scored LOW: {all_unrelated_low}"
    )

    audit = run_traceability_audit()

    all_results = [
        r for item in relevant_summary + unrelated_summary for r in item["reranked_results"]
    ]
    untraceable = [
        r["chunk_id"]
        for r in all_results
        if not r.get("source_url") or not r.get("chunk_id") or not r.get("text")
    ]
    corpus_issues = (
        audit["missing_source_url"]
        + audit["missing_text"]
        + audit["missing_chunk_id"]
        + audit["duplicate_chunk_ids"]
    )
    print("\n" + "=" * 100)
    print(f"Every reranked test-query result has valid chunk_id/text/source_url: {not untraceable}")
    print(
        f"Corpus-wide traceability: {audit['total_chunks']} chunks checked, "
        f"{corpus_issues} issues found"
    )
    print("=" * 100)
