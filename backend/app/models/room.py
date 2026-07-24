from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.floor import Floor
    from app.models.node import Node


class Room(Base, TimestampMixin):
    __tablename__ = "rooms"

    id: Mapped[int] = mapped_column(primary_key=True)
    floor_id: Mapped[int] = mapped_column(
        ForeignKey("floors.id", ondelete="CASCADE"), nullable=False, index=True
    )
    node_id: Mapped[int | None] = mapped_column(
        ForeignKey("nodes.id", ondelete="SET NULL"), unique=True, nullable=True
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    room_number: Mapped[str | None] = mapped_column(String(30), nullable=True)
    room_type: Mapped[str] = mapped_column(String(50), nullable=False, default="classroom")
    department: Mapped[str | None] = mapped_column(String(100), nullable=True)
    capacity: Mapped[int | None] = mapped_column(Integer, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    floor: Mapped[Floor] = relationship(back_populates="rooms")
    node: Mapped[Node | None] = relationship(back_populates="room", foreign_keys=[node_id])
