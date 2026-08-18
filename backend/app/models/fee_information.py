from __future__ import annotations

import datetime

from sqlalchemy import Date, Float, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.mixins import TimestampMixin


class FeeInformation(Base, TimestampMixin):
    """Structured, officially-sourced fee facts — the authoritative record
    the RAG chunks (data/processed/chunks.jsonl) describing fees are
    *generated from*, not a competing source of truth. Amounts are
    deliberately nullable: a program/fee_type combination with no verified
    amount is recorded as unavailable (amount=None, notes explaining why),
    never fabricated (see scripts/db/seed_fee_data.py's sourcing notes)."""

    __tablename__ = "fee_information"

    id: Mapped[int] = mapped_column(primary_key=True)
    program: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    department: Mapped[str | None] = mapped_column(String(150), nullable=True, index=True)
    fee_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    currency: Mapped[str] = mapped_column(String(10), nullable=False, default="INR")
    academic_year: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    quota_category: Mapped[str | None] = mapped_column(String(50), nullable=True)
    unit: Mapped[str | None] = mapped_column(String(30), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    source_document: Mapped[str | None] = mapped_column(String(200), nullable=True)
    last_verified: Mapped[datetime.date | None] = mapped_column(Date, nullable=True)
