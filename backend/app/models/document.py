from __future__ import annotations

import enum
from typing import TYPE_CHECKING

from sqlalchemy import Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.campus import Campus


class DocumentDomain(enum.StrEnum):
    ADMISSIONS = "admissions"
    ACADEMICS = "academics"
    FACILITIES = "facilities"
    NAVIGATION = "navigation"
    GENERAL = "general"


class Document(Base, TimestampMixin):
    """Plain relational content store (title/body/domain). No embedding or
    retrieval logic lives here — that is out of scope for this phase."""

    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(primary_key=True)
    campus_id: Mapped[int | None] = mapped_column(
        ForeignKey("campuses.id", ondelete="SET NULL"), nullable=True, index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    domain: Mapped[DocumentDomain] = mapped_column(
        Enum(DocumentDomain, name="document_domain"), nullable=False, default=DocumentDomain.GENERAL
    )
    source: Mapped[str | None] = mapped_column(String(150), nullable=True)

    campus: Mapped[Campus | None] = relationship(back_populates="documents")
