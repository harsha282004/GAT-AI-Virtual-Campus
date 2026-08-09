"""Phase 2 — Hybrid retrieval: dense semantic search (ChromaDB) + BM25
lexical search, fused into a single ranked result set.

Reuses the exact Phase 1 artifacts, nothing is rebuilt or duplicated:
- data/processed/chunks.jsonl (via build_embeddings.load_chunks) is the one
  source of chunk text + metadata for BM25 indexing.
- The existing persistent ChromaDB collection ("gat_kb") is used as-is for
  dense search — no new collection is created.

Usage (as a library):
    from hybrid_retrieval import hybrid_search
    results = hybrid_search("What undergraduate programs are offered?")

Usage (smoke test):
    python scripts/ai/hybrid_retrieval.py
"""

from __future__ import annotations

import re

import chromadb
from _shared import (
    CHROMA_COLLECTION_NAME,
    CHROMA_PERSIST_DIR,
    EMBEDDING_MODEL_NAME,
    configure_logging,
)
from build_embeddings import load_chunks
from rank_bm25 import BM25Okapi
from sentence_transformers import SentenceTransformer

logger = configure_logging("hybrid_retrieval")

# Configurable fusion weights (Step 4). Change these — not the fusion logic
# below — to retune the balance between semantic understanding and exact
# keyword matching.
DENSE_WEIGHT = 0.6
BM25_WEIGHT = 0.4

DEFAULT_CANDIDATE_N = 20  # top-N pulled from EACH method before fusion
DEFAULT_TOP_K = 5


def _tokenize(text: str) -> list[str]:
    """Lowercase alphanumeric tokenizer. Deliberately simple and
    reproducible — no stemming/stopword removal, so technical terms
    (department codes, acronyms like CSE/ISE/VTU, numbers) survive intact
    rather than being altered."""
    return re.findall(r"[a-z0-9]+", text.lower())


class HybridRetriever:
    """Loads the BM25 index, embedding model, and ChromaDB collection once;
    reuse a single instance across queries rather than rebuilding the BM25
    index (1488 chunks) on every call."""

    def __init__(self) -> None:
        self._chunks = load_chunks()
        if not self._chunks:
            raise RuntimeError(
                "No chunks found in data/processed/chunks.jsonl — run the "
                "Phase 1 pipeline (scripts/ai/run_pipeline.py) first."
            )
        self._chunks_by_id: dict[str, dict] = {c["chunk_id"]: c for c in self._chunks}

        logger.info("Building BM25 index over %d chunks ...", len(self._chunks))
        tokenized_corpus = [_tokenize(c["text"]) for c in self._chunks]
        self._bm25 = BM25Okapi(tokenized_corpus)
        # Positional index -> chunk_id, since BM25Okapi.get_scores() returns
        # a plain array aligned to the corpus order it was built with.
        self._bm25_chunk_ids = [c["chunk_id"] for c in self._chunks]

        logger.info("Loading embedding model %s ...", EMBEDDING_MODEL_NAME)
        self._model = SentenceTransformer(EMBEDDING_MODEL_NAME)

        client = chromadb.PersistentClient(path=str(CHROMA_PERSIST_DIR))
        try:
            self._collection = client.get_collection(CHROMA_COLLECTION_NAME)
        except Exception as exc:
            raise RuntimeError(
                f"ChromaDB collection '{CHROMA_COLLECTION_NAME}' not found at "
                f"{CHROMA_PERSIST_DIR} — run scripts/ai/build_embeddings.py first."
            ) from exc

    def chunk_by_id(self, chunk_id: str) -> dict | None:
        """Public lookup into the loaded chunk corpus — lets callers (e.g.
        the test harness) resolve a chunk_id from dense_search()/
        bm25_search() back to its text/metadata without reaching into a
        private attribute."""
        return self._chunks_by_id.get(chunk_id)

    # ---- Step 3: dense semantic retrieval ----
    def dense_search(self, query: str, top_n: int = DEFAULT_CANDIDATE_N) -> dict[str, float]:
        """query -> {chunk_id: semantic_score}. semantic_score is cosine
        similarity (1 - cosine distance) as returned by ChromaDB."""
        query_embedding = self._model.encode([query], normalize_embeddings=True)[0].tolist()
        response = self._collection.query(
            query_embeddings=[query_embedding],
            n_results=min(top_n, len(self._chunks)),
            include=["distances"],
        )
        ids = response["ids"][0]
        distances = response["distances"]
        assert distances is not None  # guaranteed by include=["distances"] above
        return {chunk_id: round(1 - distance, 6) for chunk_id, distance in zip(ids, distances[0])}

    # ---- Step 2: BM25 lexical retrieval ----
    def bm25_search(self, query: str, top_n: int = DEFAULT_CANDIDATE_N) -> dict[str, float]:
        """query -> {chunk_id: bm25_score}. Zero-score chunks (no lexical
        overlap at all) are excluded rather than padding the candidate set
        with meaningless matches."""
        scores = self._bm25.get_scores(_tokenize(query))
        ranked = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[:top_n]
        return {
            self._bm25_chunk_ids[i]: round(float(scores[i]), 6) for i in ranked if scores[i] > 0
        }

    # ---- Step 4: score normalization + fusion ----
    @staticmethod
    def _normalize(scores: dict[str, float]) -> dict[str, float]:
        """Min-max normalize a {chunk_id: raw_score} dict to [0, 1], scoped
        to this retrieval method's own candidate set. Dense (cosine
        similarity) and BM25 (unbounded, corpus-dependent) scores live on
        entirely different scales, so normalizing each independently is
        what makes the configurable weights meaningful."""
        if not scores:
            return {}
        values = scores.values()
        lo, hi = min(values), max(values)
        if hi == lo:
            # No spread to normalize (e.g. a single candidate) — treat it
            # as fully-scoring rather than dividing by zero.
            return {chunk_id: 1.0 for chunk_id in scores}
        return {chunk_id: (score - lo) / (hi - lo) for chunk_id, score in scores.items()}

    def hybrid_search(
        self,
        query: str,
        top_k: int = DEFAULT_TOP_K,
        candidate_n: int = DEFAULT_CANDIDATE_N,
        dense_weight: float = DENSE_WEIGHT,
        bm25_weight: float = BM25_WEIGHT,
    ) -> list[dict]:
        """query -> top_k hybrid results, fused from top candidate_n dense
        + top candidate_n BM25 candidates, sorted by hybrid_score desc."""
        dense_raw = self.dense_search(query, top_n=candidate_n)
        bm25_raw = self.bm25_search(query, top_n=candidate_n)

        dense_norm = self._normalize(dense_raw)
        bm25_norm = self._normalize(bm25_raw)

        candidate_ids = set(dense_raw) | set(bm25_raw)
        results: list[dict] = []
        for chunk_id in candidate_ids:
            chunk = self._chunks_by_id.get(chunk_id)
            if chunk is None:
                # Present in ChromaDB/BM25 but missing from the current
                # chunks.jsonl — a stale index, not something to paper over.
                logger.warning(
                    "chunk_id %s returned by retrieval but not found in chunks.jsonl", chunk_id
                )
                continue

            # Raw scores stay None when a method never retrieved this
            # candidate at all (it wasn't in that method's top candidate_n).
            # Normalized scores are explicitly 0.0 for that case per the
            # fusion rule — the two None-vs-0.0 meanings are distinct on
            # purpose: None = "not computed", 0.0 = "computed as absent".
            norm_sem = dense_norm.get(chunk_id, 0.0)
            norm_bm25 = bm25_norm.get(chunk_id, 0.0)
            hybrid_score = dense_weight * norm_sem + bm25_weight * norm_bm25

            results.append(
                {
                    "chunk_id": chunk_id,
                    "text": chunk["text"],
                    "source_url": chunk["source_url"],
                    "source_title": chunk["source_title"],
                    "page": chunk["page"],
                    "semantic_score": dense_raw.get(chunk_id),
                    "bm25_score": bm25_raw.get(chunk_id),
                    "normalized_semantic_score": round(norm_sem, 4),
                    "normalized_bm25_score": round(norm_bm25, 4),
                    "hybrid_score": round(hybrid_score, 4),
                }
            )

        results.sort(key=lambda r: r["hybrid_score"], reverse=True)
        return results[:top_k]


_singleton: HybridRetriever | None = None


def get_retriever() -> HybridRetriever:
    """Module-level singleton so scripts can call hybrid_search()/
    dense_search()/bm25_search() directly without managing an instance,
    while still only building the BM25 index / loading the model once per
    process."""
    global _singleton
    if _singleton is None:
        _singleton = HybridRetriever()
    return _singleton


def hybrid_search(query: str, **kwargs) -> list[dict]:
    return get_retriever().hybrid_search(query, **kwargs)


def dense_search(query: str, top_n: int = DEFAULT_CANDIDATE_N) -> dict[str, float]:
    return get_retriever().dense_search(query, top_n=top_n)


def bm25_search(query: str, top_n: int = DEFAULT_CANDIDATE_N) -> dict[str, float]:
    return get_retriever().bm25_search(query, top_n=top_n)


if __name__ == "__main__":
    demo_query = "What undergraduate programs are offered?"
    for result in hybrid_search(demo_query, top_k=3):
        print(
            f"[{result['hybrid_score']:.4f}] {result['source_url']} "
            f"(sem={result['semantic_score']}, bm25={result['bm25_score']})"
        )
        print(f"    {result['text'][:150]}...")
