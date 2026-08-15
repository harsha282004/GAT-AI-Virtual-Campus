from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.mixins import TimestampMixin

if TYPE_CHECKING:
    from app.models.node import Node


class CrossFloorHotspot(Base, TimestampMixin):
    """A visually-placed sightline hotspot: at (yaw, pitch) on `source_node`'s
    panorama, `target_node` is reachable. Rendering is intentionally the
    simplest possible rule — a hotspot renders ONLY on the exact panorama it
    was authored on (`source_node_id`), never anywhere else. No visibility
    grouping, no zone membership, no propagation to neighboring or
    same-floor scenes: an admin who wants a hotspot on Scene 5 places one on
    Scene 5.

    Deliberately separate from Edge/Panorama — these are not part of the
    calibrated forward/back walking sequence or the pathfinding graph, only
    an additional visual layer placed by hand via the dev-only placement
    tool.
    """

    __tablename__ = "cross_floor_hotspots"

    id: Mapped[int] = mapped_column(primary_key=True)
    source_node_id: Mapped[int] = mapped_column(
        ForeignKey("nodes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    target_node_id: Mapped[int] = mapped_column(
        ForeignKey("nodes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    yaw: Mapped[float] = mapped_column(Float, nullable=False)
    pitch: Mapped[float] = mapped_column(Float, nullable=False)
    label: Mapped[str | None] = mapped_column(String(150), nullable=True)

    source_node: Mapped[Node] = relationship(foreign_keys=[source_node_id])
    target_node: Mapped[Node] = relationship(foreign_keys=[target_node_id])
