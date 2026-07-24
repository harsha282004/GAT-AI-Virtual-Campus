from sqlalchemy.orm import Session

from app.models.building import Building
from app.models.node import Node, NodeType


def resolve_building_entrance_node(db: Session, building: Building) -> Node | None:
    """Pick the node used as a building's navigation target: prefer an explicit
    ENTRANCE-type node scoped to the building (floor_id is null), falling back
    to any building-level node if no entrance is configured yet."""
    entrance = (
        db.query(Node)
        .filter(
            Node.building_id == building.id,
            Node.floor_id.is_(None),
            Node.node_type == NodeType.ENTRANCE,
        )
        .order_by(Node.id)
        .first()
    )
    if entrance is not None:
        return entrance

    return (
        db.query(Node)
        .filter(Node.building_id == building.id, Node.floor_id.is_(None))
        .order_by(Node.id)
        .first()
    )
