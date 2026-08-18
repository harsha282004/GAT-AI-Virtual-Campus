"""Curated-answer semantic fallback.

Checked ONLY when the RAG pipeline itself (agent_base.run_specialist)
did not produce a grounded answer — priority is RAG first, curated
answers second, existing fallback message last (Requirement 9). Reuses
the SAME embedding model hybrid_retrieval.py already loaded (via
HybridRetriever.embed()) for cosine-similarity matching against stored
curated questions — no second model instance, no extra LLM call, no new
vector store.
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))

from _shared import configure_logging  # noqa: E402
from hybrid_retrieval import get_retriever  # noqa: E402

from app.models.curated_answer import CuratedAnswer  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402

logger = configure_logging("curated_answers")

# Cosine similarity threshold for accepting a curated-answer match — kept
# conservative on purpose (Requirement 10: "do NOT blindly return a
# pretrained answer for every vaguely similar query"). Below this, no
# curated answer is returned and the caller's existing fallback stands.
SIMILARITY_THRESHOLD = 0.55

_cache: dict[str, Any] | None = None


def _load_cache() -> dict[str, Any]:
    global _cache
    if _cache is not None:
        return _cache

    db = SessionLocal()
    try:
        rows = db.query(CuratedAnswer).filter(CuratedAnswer.active.is_(True)).all()
        records = [
            {
                "id": r.id,
                "question": r.question,
                "answer": r.answer,
                "category": r.category,
                "source": r.source,
            }
            for r in rows
        ]
    finally:
        db.close()

    if not records:
        _cache = {"records": [], "embeddings": None}
        return _cache

    embeddings = np.array(get_retriever().embed([r["question"] for r in records]))
    _cache = {"records": records, "embeddings": embeddings}
    logger.info("Loaded %d active curated answers into the in-memory match cache.", len(records))
    return _cache


def invalidate_cache() -> None:
    """The CLI/seed scripts run as separate one-shot processes, so they
    never need this — provided for any future long-lived process that
    edits curated answers without restarting."""
    global _cache
    _cache = None


def find_curated_answer(query: str) -> dict[str, Any] | None:
    """Best matching curated answer if its cosine similarity to `query`
    clears SIMILARITY_THRESHOLD, else None. Never raises on an empty/
    misconfigured table — a caller failure here must degrade to the
    existing fallback, not break the request."""
    try:
        cache = _load_cache()
        if not cache["records"]:
            return None

        query_embedding = np.array(get_retriever().embed([query])[0])
        # Both sides are L2-normalized (normalize_embeddings=True in
        # HybridRetriever.embed()), so the dot product IS cosine similarity.
        similarities = cache["embeddings"] @ query_embedding
        best_idx = int(np.argmax(similarities))
        best_score = float(similarities[best_idx])

        if best_score < SIMILARITY_THRESHOLD:
            return None

        record = cache["records"][best_idx]
        logger.info(
            "Curated answer match: query=%r -> stored_question=%r (similarity=%.3f)",
            query,
            record["question"],
            best_score,
        )
        return {**record, "similarity": round(best_score, 4)}
    except Exception:  # noqa: BLE001 — a curated-answer lookup failure must
        # never break the chat request; the caller's existing fallback
        # (LOW_CONFIDENCE_MESSAGE) still applies.
        logger.exception("Curated-answer lookup failed; falling through to existing fallback.")
        return None
