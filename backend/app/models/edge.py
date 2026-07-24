from __future__ import annotations

import enum
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Enum, Float, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.node import Node


class EdgeType(enum.StrEnum):
    CORRIDOR = "corridor"
    WALKWAY = "walkway"
    STAIRS = "stairs"
    ELEVATOR = "elevator"
    RAMP = "ramp"
    OUTDOOR_PATH = "outdoor_path"


class EdgeDirection(enum.StrEnum):
    """Relative turn direction a pedestrian takes when arriving from the
    source node and continuing onto this edge — drives turn-by-turn phrasing."""

    FORWARD = "forward"
    LEFT = "left"
    RIGHT = "right"
    BACK = "back"
    UP = "up"
    DOWN = "down"


# Edge types that a wheelchair user cannot traverse.
NON_ACCESSIBLE_EDGE_TYPES = {EdgeType.STAIRS}


class Edge(Base, TimestampMixin):
    """A directed connection used by the pathfinder; is_bidirectional=True means
    the graph builder also treats it as traversable target->source."""

    __tablename__ = "edges"

    id: Mapped[int] = mapped_column(primary_key=True)
    source_node_id: Mapped[int] = mapped_column(
        ForeignKey("nodes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    target_node_id: Mapped[int] = mapped_column(
        ForeignKey("nodes.id", ondelete="CASCADE"), nullable=False, index=True
    )

    distance: Mapped[float] = mapped_column(Float, nullable=False)
    is_bidirectional: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    edge_type: Mapped[EdgeType] = mapped_column(
        Enum(EdgeType, name="edge_type"), nullable=False, default=EdgeType.CORRIDOR
    )
    yaw: Mapped[float | None] = mapped_column(Float, nullable=True)

    walking_time: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    direction: Mapped[EdgeDirection] = mapped_column(
        Enum(EdgeDirection, name="edge_direction"), nullable=False, default=EdgeDirection.FORWARD
    )
    floor_transition: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    accessible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    source_node: Mapped[Node] = relationship(
        back_populates="outgoing_edges", foreign_keys=[source_node_id]
    )
    target_node: Mapped[Node] = relationship(
        back_populates="incoming_edges", foreign_keys=[target_node_id]
    )
