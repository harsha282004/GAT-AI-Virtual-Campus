from __future__ import annotations

import enum
from typing import TYPE_CHECKING

from sqlalchemy import Enum, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.building import Building
    from app.models.campus import Campus
    from app.models.edge import Edge
    from app.models.floor import Floor
    from app.models.panorama import Panorama
    from app.models.room import Room


class NodeType(enum.StrEnum):
    ENTRANCE = "entrance"
    JUNCTION = "junction"
    CORRIDOR = "corridor"
    ROOM = "room"
    STAIRCASE = "staircase"
    ELEVATOR = "elevator"
    LANDMARK = "landmark"
    OUTDOOR = "outdoor"
    CLASSROOM = "classroom"
    LAB = "lab"
    OFFICE = "office"
    LIBRARY = "library"
    CAFETERIA = "cafeteria"


class Node(Base, TimestampMixin):
    """A navigable point in the campus graph. campus_id is always set; building_id
    and floor_id are set only when the node is that specific (e.g. an outdoor
    campus landmark has neither; a building entrance has building_id only; an
    indoor node has both)."""

    __tablename__ = "nodes"

    id: Mapped[int] = mapped_column(primary_key=True)
    campus_id: Mapped[int] = mapped_column(
        ForeignKey("campuses.id", ondelete="CASCADE"), nullable=False, index=True
    )
    building_id: Mapped[int | None] = mapped_column(
        ForeignKey("buildings.id", ondelete="CASCADE"), nullable=True, index=True
    )
    floor_id: Mapped[int | None] = mapped_column(
        ForeignKey("floors.id", ondelete="CASCADE"), nullable=True, index=True
    )

    name: Mapped[str] = mapped_column(String(150), nullable=False)
    node_type: Mapped[NodeType] = mapped_column(
        Enum(NodeType, name="node_type"), nullable=False, default=NodeType.JUNCTION
    )

    pos_x: Mapped[float | None] = mapped_column(Float, nullable=True)
    pos_y: Mapped[float | None] = mapped_column(Float, nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)

    campus: Mapped[Campus] = relationship(back_populates="nodes")
    building: Mapped[Building | None] = relationship(back_populates="nodes")
    floor: Mapped[Floor | None] = relationship(back_populates="nodes")
    room: Mapped[Room | None] = relationship(back_populates="node", uselist=False)
    panoramas: Mapped[list[Panorama]] = relationship(
        back_populates="node", cascade="all, delete-orphan"
    )

    outgoing_edges: Mapped[list[Edge]] = relationship(
        back_populates="source_node",
        foreign_keys="Edge.source_node_id",
        cascade="all, delete-orphan",
    )
    incoming_edges: Mapped[list[Edge]] = relationship(
        back_populates="target_node",
        foreign_keys="Edge.target_node_id",
        cascade="all, delete-orphan",
    )
