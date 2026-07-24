from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.building import Building
    from app.models.document import Document
    from app.models.node import Node


class Campus(Base, TimestampMixin):
    __tablename__ = "campuses"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150), unique=True, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    address: Mapped[str | None] = mapped_column(String(255), nullable=True)

    buildings: Mapped[list[Building]] = relationship(
        back_populates="campus", cascade="all, delete-orphan"
    )
    nodes: Mapped[list[Node]] = relationship(back_populates="campus", cascade="all, delete-orphan")
    documents: Mapped[list[Document]] = relationship(back_populates="campus")
