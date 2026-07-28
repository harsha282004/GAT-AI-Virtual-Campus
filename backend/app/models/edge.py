from __future__ import annotations

import enum
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Enum, Float, ForeignKey, String
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

    # Tour-viewer hotspot placement (nullable — only meaningful for edges
    # between two panorama-bearing nodes; yaw above already covers the
    # horizontal angle, this adds the vertical one plus an optional label
    # that overrides the direction-derived default, e.g. "Lift to 2nd Floor").
    hotspot_pitch: Mapped[float | None] = mapped_column(Float, nullable=True, default=0.0)
    label_override: Mapped[str | None] = mapped_column(String(150), nullable=True)

    # Orientation calibration: the camera angle the *target* panorama should
    # open with when a user arrives specifically via this edge (Street View
    # style — continue facing the direction of travel). Distinct from yaw/
    # hotspot_pitch above, which place the hotspot arrow in the *source*
    # scene. Null means "use the target panorama's own resting initial_yaw/
    # initial_pitch instead" (e.g. when jumping in via the sidebar, not by
    # walking through a hotspot).
    entry_yaw: Mapped[float | None] = mapped_column(Float, nullable=True)
    entry_pitch: Mapped[float | None] = mapped_column(Float, nullable=True)

    source_node: Mapped[Node] = relationship(
        back_populates="outgoing_edges", foreign_keys=[source_node_id]
    )
    target_node: Mapped[Node] = relationship(
        back_populates="incoming_edges", foreign_keys=[target_node_id]
    )
