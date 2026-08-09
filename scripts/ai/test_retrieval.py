"""Step 11 — Retrieval-only test.

Embeds each test question, searches the persistent ChromaDB collection, and
prints the retrieved chunks with their sources and similarity scores.
Deliberately does NOT call an LLM to generate an answer — that's Phase 3.
This proves retrieval alone works and every result is traceable to an
official source before any generation layer is built on top of it.

Usage: python scripts/ai/test_retrieval.py
"""

from __future__ import annotations

import chromadb
from sentence_transformers import SentenceTransformer

from _shared import (
    CHROMA_COLLECTION_NAME,
    CHROMA_PERSIST_DIR,
    EMBEDDING_MODEL_NAME,
    configure_logging,
)

logger = configure_logging("test_retrieval")

TEST_QUESTIONS = [
    "What undergraduate programs are offered?",
    "What departments are available?",
    "What is the admission process?",
    "What facilities are available?",
    "What information is available about the institution?",
    "Where can official contact information be found?",
]

TOP_K = 3


def run_retrieval_tests() -> list[dict]:
    client = chromadb.PersistentClient(path=str(CHROMA_PERSIST_DIR))
    try:
        collection = client.get_collection(CHROMA_COLLECTION_NAME)
    except Exception:
        logger.error(
            "Collection '%s' not found at %s — run scripts/ai/build_embeddings.py first.",
            CHROMA_COLLECTION_NAME,
            CHROMA_PERSIST_DIR,
        )
        return []

    model = SentenceTransformer(EMBEDDING_MODEL_NAME)
    results_summary = []

    for question in TEST_QUESTIONS:
        query_embedding = model.encode([question], normalize_embeddings=True)[0].tolist()
        response = collection.query(
            query_embeddings=[query_embedding],
            n_results=TOP_K,
            include=["documents", "metadatas", "distances"],
        )

        print("\n" + "=" * 100)
        print(f"QUERY: {question}")
        print("=" * 100)

        docs = response["documents"][0]
        metas = response["metadatas"][0]
        distances = response["distances"][0]

        if not docs:
            print("  (no results)")
            results_summary.append({"query": question, "results": []})
            continue

        query_results = []
        for rank, (doc, meta, distance) in enumerate(zip(docs, metas, distances), start=1):
            similarity = 1 - distance  # cosine distance -> similarity
            source = meta.get("source_url", "unknown")
            page = meta.get("page")
            page_str = f" (page {page})" if page and page != -1 else ""
            print(f"\n  [{rank}] similarity={similarity:.3f}  source={source}{page_str}")
            print(f"      section: {meta.get('section') or meta.get('document_name') or '(none)'}")
            print(f"      text: {doc[:300].strip()}{'...' if len(doc) > 300 else ''}")
            query_results.append(
                {
                    "rank": rank,
                    "similarity": round(similarity, 4),
                    "source_url": source,
                    "text_preview": doc[:300],
                }
            )
        results_summary.append({"query": question, "results": query_results})

    return results_summary


if __name__ == "__main__":
    summary = run_retrieval_tests()
    traceable = all(r["source_url"] for item in summary for r in item["results"])
    print("\n" + "=" * 100)
    print(f"Every retrieved chunk has a traceable source_url: {traceable}")
    print("=" * 100)
