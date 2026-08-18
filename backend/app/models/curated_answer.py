from __future__ import annotations

from sqlalchemy import Boolean, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import TimestampMixin


class CuratedAnswer(Base, TimestampMixin):
    """Manually-authored question/answer records ("verified FAQ answers") —
    NOT model training data. Used as a fallback tier below the RAG pipeline
    (see scripts/ai/agent_base.py's run_specialist()): only consulted when
    RAG itself reports low confidence/no context, and only returned when a
    stored question is semantically close enough to the live query (cosine
    similarity over the same SentenceTransformer embeddings the RAG
    pipeline already uses — no separate embedding model, no extra LLM
    call). `keywords` is a plain comma-separated string, not a new ARRAY
    type, to keep this table simple to inspect/edit by hand if needed."""

    __tablename__ = "curated_answers"

    id: Mapped[int] = mapped_column(primary_key=True)
    question: Mapped[str] = mapped_column(Text, nullable=False)
    answer: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    keywords: Mapped[str | None] = mapped_column(String(300), nullable=True)
    source: Mapped[str | None] = mapped_column(String(200), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
