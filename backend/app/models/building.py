from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.campus import Campus
    from app.models.floor import Floor
    from app.models.node import Node


class Building(Base, TimestampMixin):
    __tablename__ = "buildings"

    id: Mapped[int] = mapped_column(primary_key=True)
    campus_id: Mapped[int] = mapped_column(
        ForeignKey("campuses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    code: Mapped[str | None] = mapped_column(String(30), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Real, surveyed building-level GPS coordinates — nullable because no
    # building in this project has been surveyed yet (Phase 17). Left NULL
    # rather than populated with an approximation: a future phase can supply
    # real values here with no code change elsewhere (frontend building
    # markers key off "is this non-null", not off any placeholder).
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)

    campus: Mapped[Campus] = relationship(back_populates="buildings")
    floors: Mapped[list[Floor]] = relationship(
        back_populates="building", cascade="all, delete-orphan"
    )
    nodes: Mapped[list[Node]] = relationship(back_populates="building")
