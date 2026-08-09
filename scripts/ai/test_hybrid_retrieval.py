"""Phase 2 — Hybrid retrieval test harness (Steps 6-8).

Runs realistic GAT questions through dense-only, BM25-only, and hybrid
retrieval side by side against the actual Phase 1 knowledge base, and runs a
source-traceability audit over the full chunk corpus. Deliberately does not
call an LLM — like Phase 1's test_retrieval.py, this proves retrieval
quality in isolation.

Usage: python scripts/ai/test_hybrid_retrieval.py
"""

from __future__ import annotations

from collections import Counter

from _shared import configure_logging
from build_embeddings import load_chunks
from hybrid_retrieval import DEFAULT_CANDIDATE_N, get_retriever

logger = configure_logging("test_hybrid_retrieval")

TEST_QUESTIONS = [
    "What undergraduate programs are offered at GAT?",
    "What departments are available at Global Academy of Technology?",
    "What is the admission process?",
    "What facilities are available on the campus?",
    "What is the official contact information?",
    "Where is the college located?",
]

TOP_K = 3


def _preview(text: str, n: int = 160) -> str:
    text = text.strip().replace("\n", " ")
    return text[:n] + ("..." if len(text) > n else "")


def _print_dense_only(retriever, query: str) -> list[str]:
    dense_raw = retriever.dense_search(query, top_n=DEFAULT_CANDIDATE_N)
    ranked = sorted(dense_raw.items(), key=lambda kv: kv[1], reverse=True)[:TOP_K]
    print(f"\n  -- DENSE-ONLY (top {TOP_K}) --")
    ids = []
    for rank, (chunk_id, score) in enumerate(ranked, start=1):
        chunk = retriever.chunk_by_id(chunk_id)
        source = chunk["source_url"] if chunk else "UNKNOWN"
        text = chunk["text"] if chunk else ""
        print(f"  [{rank}] semantic={score:.4f}  source={source}")
        print(f"      {_preview(text)}")
        ids.append(chunk_id)
    return ids


def _print_bm25_only(retriever, query: str) -> list[str]:
    bm25_raw = retriever.bm25_search(query, top_n=DEFAULT_CANDIDATE_N)
    ranked = sorted(bm25_raw.items(), key=lambda kv: kv[1], reverse=True)[:TOP_K]
    print(f"\n  -- BM25-ONLY (top {TOP_K}) --")
    if not ranked:
        print("  (no lexical matches)")
        return []
    ids = []
    for rank, (chunk_id, score) in enumerate(ranked, start=1):
        chunk = retriever.chunk_by_id(chunk_id)
        source = chunk["source_url"] if chunk else "UNKNOWN"
        text = chunk["text"] if chunk else ""
        print(f"  [{rank}] bm25={score:.4f}  source={source}")
        print(f"      {_preview(text)}")
        ids.append(chunk_id)
    return ids


def _print_hybrid(retriever, query: str) -> list[dict]:
    results = retriever.hybrid_search(query, top_k=TOP_K)
    print(f"\n  -- HYBRID (top {TOP_K}) --")
    for rank, r in enumerate(results, start=1):
        print(
            f"  [{rank}] hybrid={r['hybrid_score']:.4f}  "
            f"(sem={r['semantic_score']}, norm_sem={r['normalized_semantic_score']}, "
            f"bm25={r['bm25_score']}, norm_bm25={r['normalized_bm25_score']})"
        )
        print(f"      source={r['source_url']}" + (f" (page {r['page']})" if r["page"] else ""))
        print(f"      {_preview(r['text'])}")
    return results


def run_comparison() -> dict:
    retriever = get_retriever()
    per_query_summary = []

    for question in TEST_QUESTIONS:
        print("\n" + "=" * 100)
        print(f"QUERY: {question}")
        print("=" * 100)

        dense_ids = _print_dense_only(retriever, question)
        bm25_ids = _print_bm25_only(retriever, question)
        hybrid_results = _print_hybrid(retriever, question)
        hybrid_ids = [r["chunk_id"] for r in hybrid_results]

        overlap_dense_hybrid = len(set(dense_ids[:TOP_K]) & set(hybrid_ids))
        overlap_bm25_hybrid = len(set(bm25_ids[:TOP_K]) & set(hybrid_ids))
        print(
            f"\n  -- COMPARISON --  hybrid top-{TOP_K} overlaps dense top-{TOP_K} in "
            f"{overlap_dense_hybrid}/{TOP_K}, overlaps BM25 top-{TOP_K} in "
            f"{overlap_bm25_hybrid}/{TOP_K}"
        )

        per_query_summary.append(
            {
                "query": question,
                "dense_top1": dense_ids[0] if dense_ids else None,
                "bm25_top1": bm25_ids[0] if bm25_ids else None,
                "hybrid_top1": hybrid_ids[0] if hybrid_ids else None,
                "hybrid_results": hybrid_results,
            }
        )

    return {"per_query": per_query_summary}


def run_traceability_audit() -> dict:
    """Step 8 — corpus-wide traceability audit over the full chunk set
    (not just the test-query results), reported rather than silently
    fixed or fabricated."""
    chunks = load_chunks()
    chunk_ids = [c.get("chunk_id") for c in chunks]
    id_counts = Counter(chunk_ids)

    missing_source_url = [c["chunk_id"] for c in chunks if not c.get("source_url")]
    missing_text = [c["chunk_id"] for c in chunks if not c.get("text") or not c["text"].strip()]
    missing_chunk_id = [c for c in chunks if not c.get("chunk_id")]
    duplicate_chunk_ids = [cid for cid, count in id_counts.items() if count > 1]
    missing_source_title = [c["chunk_id"] for c in chunks if not c.get("source_title")]

    report = {
        "total_chunks": len(chunks),
        "missing_source_url": len(missing_source_url),
        "missing_text": len(missing_text),
        "missing_chunk_id": len(missing_chunk_id),
        "duplicate_chunk_ids": len(duplicate_chunk_ids),
        "missing_source_title": len(missing_source_title),
    }

    print("\n" + "=" * 100)
    print("SOURCE TRACEABILITY AUDIT (Step 8, full corpus)")
    print("=" * 100)
    for key, value in report.items():
        print(f"  {key}: {value}")
    if duplicate_chunk_ids:
        print(f"  duplicate chunk_id sample: {duplicate_chunk_ids[:5]}")
    if missing_source_url:
        print(f"  missing source_url sample: {missing_source_url[:5]}")

    return report


if __name__ == "__main__":
    comparison = run_comparison()
    audit = run_traceability_audit()

    hybrid_untraceable = [
        r["chunk_id"]
        for item in comparison["per_query"]
        for r in item["hybrid_results"]
        if not r.get("source_url")
    ]
    print("\n" + "=" * 100)
    print(f"Every hybrid test-query result has a traceable source_url: {not hybrid_untraceable}")
    print("=" * 100)
