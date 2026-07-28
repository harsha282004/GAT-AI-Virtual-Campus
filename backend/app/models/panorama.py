from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.node import Node


class Panorama(Base, TimestampMixin):
    __tablename__ = "panoramas"

    id: Mapped[int] = mapped_column(primary_key=True)
    node_id: Mapped[int] = mapped_column(
        ForeignKey("nodes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    image_path: Mapped[str] = mapped_column(String(255), nullable=False)
    title: Mapped[str | None] = mapped_column(String(150), nullable=True)
    is_placeholder: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Tour-viewer scene metadata (nullable — only populated for panoramas that
    # are part of a walkable sequence, e.g. the Main Building tour).
    sequence_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    initial_yaw: Mapped[float | None] = mapped_column(Float, nullable=True)
    initial_pitch: Mapped[float | None] = mapped_column(Float, nullable=True)
    hfov: Mapped[float | None] = mapped_column(Float, nullable=True, default=110.0)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    node: Mapped[Node] = relationship(back_populates="panoramas")
