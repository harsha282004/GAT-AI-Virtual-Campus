"""Phase 3 — Retrieval reranking.

Reranks Phase 2 hybrid_search() candidates using explainable, deterministic
features (Step 2). An SVR-based reranker (Step 3) is implemented as
documented infrastructure — `SVRReranker.fit()`/`.predict()`/`.save()`/
`.load()` all work — but it is **not trained**: no labelled query-relevance
dataset exists anywhere in this repository, and Phase 3 explicitly forbids
fabricating training labels or claiming trained-model accuracy without real
training/evaluation data.

Until a labelled dataset exists and `SVRReranker.fit()` is actually called
(e.g. from a future offline training script, saving to
data/models/reranker_svr.joblib), `Reranker.rerank()` uses a deterministic,
hand-authored weighted-feature formula — the "heuristic fallback". Every
result is tagged with `rerank_mode` so callers always know which path
produced the score. See docs/RAG_ARCHITECTURE.md's Phase 3 section for the
full IMPLEMENTED vs. FUTURE TRAINING breakdown.

Usage (as a library):
    from reranker import rerank
    from hybrid_retrieval import hybrid_search
    candidates = hybrid_search(query, top_k=20)
    results = rerank(query, candidates, top_k=5)
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import joblib
from _shared import DATA_DIR, configure_logging
from hybrid_retrieval import _tokenize
from sklearn.svm import SVR

logger = configure_logging("reranker")

FEATURE_NAMES = [
    "hybrid_score",
    "semantic_score",
    "bm25_score",
    "lexical_overlap",
    "query_term_coverage",
    "length_score",
    "exact_phrase_match",
]

# A chunk around this many characters is considered to carry enough
# standalone content to be a useful answer passage (Phase 1's chunker
# targets ~800 chars with 120 overlap, so a chunk under half that is
# usually a fragment). Capped at 1.0 — longer is not automatically better.
TARGET_LENGTH_CHARS = 400.0

# Deterministic fallback formula weights (Step 3's "no fabricated
# training" path). hybrid_score already blends normalized semantic + BM25
# signal (see hybrid_retrieval.py), so it anchors the score; the remaining
# weight goes to precision signals hybrid_score doesn't capture on its own
# (does the passage actually contain the query's terms verbatim). Weights
# sum to 1.0 so the result stays bounded in [0, 1] like every input
# feature. Change these constants — not the formula — to retune.
HEURISTIC_WEIGHTS = {
    "hybrid_score": 0.55,
    "query_term_coverage": 0.25,
    "exact_phrase_match": 0.10,
    "length_score": 0.10,
}
assert abs(sum(HEURISTIC_WEIGHTS.values()) - 1.0) < 1e-9

DEFAULT_TOP_K = 5

SVR_MODEL_PATH = DATA_DIR / "models" / "reranker_svr.joblib"


def _normalize_for_phrase_match(text: str) -> str:
    return " ".join(_tokenize(text))


def extract_features(query: str, candidate: dict[str, Any]) -> dict[str, float]:
    """Deterministic, explainable per-candidate features (Step 2). Every
    value is read straight from the Phase 2 candidate dict or computed by a
    plain, inspectable rule — nothing here is learned or fabricated."""
    text = candidate.get("text") or ""
    query_tokens = set(_tokenize(query))
    doc_tokens = set(_tokenize(text))
    overlap = query_tokens & doc_tokens

    lexical_overlap = float(len(overlap))
    query_term_coverage = len(overlap) / len(query_tokens) if query_tokens else 0.0
    length_score = min(1.0, len(text) / TARGET_LENGTH_CHARS)
    exact_phrase_match = (
        1.0 if _normalize_for_phrase_match(query) in _normalize_for_phrase_match(text) else 0.0
    )

    return {
        "hybrid_score": float(candidate.get("hybrid_score") or 0.0),
        "semantic_score": float(candidate.get("semantic_score") or 0.0),
        "bm25_score": float(candidate.get("bm25_score") or 0.0),
        "lexical_overlap": lexical_overlap,
        "query_term_coverage": round(query_term_coverage, 4),
        "length_score": round(length_score, 4),
        "exact_phrase_match": exact_phrase_match,
    }


def heuristic_rerank_score(features: dict[str, float]) -> float:
    """The actual scoring path used today (Step 3's documented fallback).
    A plain weighted sum over already-[0,1]-bounded features — deliberately
    NOT using raw semantic_score/bm25_score/lexical_overlap here, since
    those live on different unnormalized scales (the same reason Phase 2
    normalizes them before fusion); hybrid_score and query_term_coverage
    are their already-normalized counterparts."""
    return sum(HEURISTIC_WEIGHTS[name] * features[name] for name in HEURISTIC_WEIGHTS)


class SVRReranker:
    """Reranking-infrastructure wrapper around sklearn.svm.SVR (Step 3).

    Implemented and fully functional, but never trained in this repository:
    doing so would require a labelled dataset of (query, chunk) -> human
    relevance judgments, which does not exist here and which Phase 3
    explicitly forbids fabricating. `is_fitted` stays False until a future
    offline process calls `.fit()` with real labelled data and `.save()`s
    the result — at which point `Reranker` picks it up automatically via
    `SVR_MODEL_PATH`.
    """

    def __init__(self) -> None:
        self.model: SVR | None = None
        self.is_fitted = False

    def _to_matrix(self, feature_dicts: list[dict[str, float]]) -> list[list[float]]:
        return [[f[name] for name in FEATURE_NAMES] for f in feature_dicts]

    def fit(self, feature_dicts: list[dict[str, float]], relevance_labels: list[float]) -> None:
        """relevance_labels: real human/eval-derived relevance scores, one
        per feature_dict. Raises rather than silently accepting a
        suspiciously small or fabricated-looking dataset."""
        if len(feature_dicts) != len(relevance_labels):
            raise ValueError("feature_dicts and relevance_labels must be the same length")
        if len(feature_dicts) < 10:
            raise ValueError(
                "Refusing to fit an SVR reranker on fewer than 10 labelled examples — "
                "this is almost certainly not a real labelled dataset."
            )
        self.model = SVR(kernel="rbf")
        self.model.fit(self._to_matrix(feature_dicts), relevance_labels)
        self.is_fitted = True
        logger.info("SVRReranker fitted on %d labelled examples", len(feature_dicts))

    def predict(self, feature_dicts: list[dict[str, float]]) -> list[float]:
        if not self.is_fitted or self.model is None:
            raise RuntimeError(
                "SVRReranker has not been trained — no labelled relevance data exists yet. "
                "Use the heuristic fallback (Reranker with no SVR model loaded) instead."
            )
        return list(self.model.predict(self._to_matrix(feature_dicts)))

    def save(self, path: Path = SVR_MODEL_PATH) -> None:
        if not self.is_fitted:
            raise RuntimeError("Refusing to save an untrained SVRReranker.")
        path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(self.model, path)
        logger.info("Saved trained SVRReranker to %s", path)

    def load(self, path: Path = SVR_MODEL_PATH) -> bool:
        """Returns False (not an error) if no trained model file exists —
        that's the expected state until real labelled data is collected."""
        if not path.exists():
            return False
        self.model = joblib.load(path)
        self.is_fitted = True
        logger.info("Loaded trained SVRReranker from %s", path)
        return True


class Reranker:
    """Orchestrates feature extraction + scoring (SVR if a trained model is
    available on disk, heuristic fallback otherwise) over Phase 2 hybrid
    candidates, preserving every source-traceability field."""

    def __init__(self, svr_model_path: Path = SVR_MODEL_PATH) -> None:
        self._svr = SVRReranker()
        self._svr.load(svr_model_path)
        if not self._svr.is_fitted:
            logger.info(
                "No trained SVR reranker found at %s — using the deterministic "
                "heuristic fallback (see reranker.py module docstring).",
                svr_model_path,
            )

    @property
    def mode(self) -> str:
        return "svr_trained" if self._svr.is_fitted else "heuristic_fallback"

    def rerank(
        self, query: str, candidates: list[dict[str, Any]], top_k: int = DEFAULT_TOP_K
    ) -> list[dict[str, Any]]:
        if not candidates:
            return []

        features_list = [extract_features(query, c) for c in candidates]
        if self._svr.is_fitted:
            scores = self._svr.predict(features_list)
        else:
            scores = [heuristic_rerank_score(f) for f in features_list]

        results = []
        for candidate, features, score in zip(candidates, features_list, scores):
            results.append(
                {
                    **candidate,  # chunk_id, text, source_url, source_title, page,
                    # semantic_score, bm25_score, hybrid_score, normalized_* — untouched
                    "rerank_score": round(float(score), 4),
                    "rerank_mode": self.mode,
                    "ranking_features": features,
                }
            )

        results.sort(key=lambda r: r["rerank_score"], reverse=True)
        return results[:top_k]


_singleton: Reranker | None = None


def get_reranker() -> Reranker:
    global _singleton
    if _singleton is None:
        _singleton = Reranker()
    return _singleton


def rerank(query: str, candidates: list[dict[str, Any]], top_k: int = DEFAULT_TOP_K) -> list[dict]:
    return get_reranker().rerank(query, candidates, top_k=top_k)


if __name__ == "__main__":
    from hybrid_retrieval import hybrid_search

    demo_query = "What undergraduate programs are offered?"
    candidates = hybrid_search(demo_query, top_k=10)
    print(f"Reranker mode: {get_reranker().mode}")
    for r in rerank(demo_query, candidates, top_k=3):
        print(f"[rerank={r['rerank_score']:.4f}, hybrid={r['hybrid_score']:.4f}] {r['source_url']}")
        print(f"    features: {r['ranking_features']}")
