import logging

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.exceptions import NotFoundError
from app.models.edge import Edge, EdgeDirection
from app.models.floor import Floor
from app.models.node import Node
from app.models.panorama import Panorama
from app.schemas.floor import FloorRead
from app.schemas.tour import SceneHotspot, SceneRead

logger = logging.getLogger(__name__)

router = APIRouter()


def _preview_path(image_path: str) -> str | None:
    if not image_path.lower().endswith(".jpg"):
        return None
    return f"{image_path[: -len('.jpg')]}-preview.jpg"


def _direction_label(edge: Edge) -> str:
    if edge.label_override:
        return edge.label_override
    return edge.direction.value.replace("_", " ").title()


# Fallback used only when an edge has no explicit entry_yaw set — a
# reasonable guess for a walked sequence, not a claim about the true
# geometry. Curves/turns/courtyards/staircases need a real value; this just
# keeps an unset transition from opening at a jarring random angle.
_DIRECTION_FALLBACK_YAW: dict[EdgeDirection, float] = {
    EdgeDirection.FORWARD: 0.0,
    EdgeDirection.BACK: 180.0,
}


def _effective_entry_orientation(edge: Edge) -> tuple[float | None, float | None]:
    """Returns (yaw, pitch). Both are None when there's no explicit entry
    orientation and no directional fallback either — callers should then use
    the target scene's own resting initial_yaw/initial_pitch instead."""
    if edge.entry_yaw is not None:
        return edge.entry_yaw, edge.entry_pitch or 0.0
    fallback_yaw = _DIRECTION_FALLBACK_YAW.get(edge.direction)
    if fallback_yaw is not None:
        return fallback_yaw, 0.0
    return None, None


def _hotspots_for_node(node: Node) -> list[SceneHotspot]:
    hotspots: list[SceneHotspot] = []
    for edge in node.outgoing_edges:
        entry_yaw, entry_pitch = _effective_entry_orientation(edge)
        hotspots.append(
            SceneHotspot(
                edge_id=edge.id,
                target_node_id=edge.target_node_id,
                direction=edge.direction,
                edge_type=edge.edge_type,
                yaw=edge.yaw or 0.0,
                pitch=edge.hotspot_pitch or 0.0,
                label=_direction_label(edge),
                entry_yaw=entry_yaw,
                entry_pitch=entry_pitch,
            )
        )
    return hotspots


def _build_scene(node: Node, panorama: Panorama) -> SceneRead:
    # Guaranteed by callers: list_scenes filters on a concrete building_id and
    # excludes null floor_id; _node_with_panorama rejects nodes missing either.
    # A tour scene without a floor isn't meaningful — narrows the type for
    # SceneRead below, which (unlike Node) treats these as required.
    assert node.building_id is not None
    assert node.floor_id is not None
    return SceneRead(
        node_id=node.id,
        panorama_id=panorama.id,
        name=node.name,
        building_id=node.building_id,
        building_name=node.building.name if node.building else "",
        floor_id=node.floor_id,
        floor_name=node.floor.name if node.floor else "",
        sequence_index=panorama.sequence_index,
        image_path=panorama.image_path,
        preview_path=_preview_path(panorama.image_path),
        initial_yaw=panorama.initial_yaw or 0.0,
        initial_pitch=panorama.initial_pitch or 0.0,
        hfov=panorama.hfov or 110.0,
        description=panorama.description,
        hotspots=_hotspots_for_node(node),
    )


def _node_with_panorama(db: Session, node_id: int) -> tuple[Node, Panorama]:
    node = db.query(Node).filter(Node.id == node_id).first()
    if node is None:
        raise NotFoundError(f"Scene (node) {node_id} not found.")
    if not node.panoramas:
        raise NotFoundError(f"Node {node_id} has no panorama — it is not a tour scene.")
    if node.building_id is None or node.floor_id is None:
        raise NotFoundError(f"Node {node_id} is not part of a floor-based tour sequence.")
    return node, node.panoramas[0]


@router.get("/floors", response_model=list[FloorRead], summary="Floors for a building, in order")
def list_floors(
    building_id: int = Query(..., description="Building ID to list floors for"),
    db: Session = Depends(get_db),
) -> list[Floor]:
    return db.query(Floor).filter(Floor.building_id == building_id).order_by(Floor.level).all()


@router.get("/scenes", response_model=list[SceneRead], summary="Tour scenes, in walking order")
def list_scenes(
    building_id: int = Query(..., description="Building ID to list scenes for"),
    floor_id: int | None = Query(None, description="Restrict to a single floor"),
    db: Session = Depends(get_db),
) -> list[SceneRead]:
    query = (
        db.query(Node, Panorama)
        .join(Panorama, Panorama.node_id == Node.id)
        .filter(Node.building_id == building_id, Node.floor_id.isnot(None))
    )
    if floor_id is not None:
        query = query.filter(Node.floor_id == floor_id)
    query = query.order_by(Node.floor_id, Panorama.sequence_index)

    logger.info("Tour scenes request: building_id=%s floor_id=%s", building_id, floor_id)
    return [_build_scene(node, panorama) for node, panorama in query.all()]


@router.get("/scenes/{node_id}", response_model=SceneRead, summary="A single tour scene")
def get_scene(node_id: int, db: Session = Depends(get_db)) -> SceneRead:
    node, panorama = _node_with_panorama(db, node_id)
    logger.info("Tour scene request: node_id=%s", node_id)
    return _build_scene(node, panorama)


@router.get(
    "/neighbors/{node_id}",
    response_model=list[SceneHotspot],
    summary="Outgoing hotspots for a scene (used for prefetching neighbors)",
)
def get_neighbors(node_id: int, db: Session = Depends(get_db)) -> list[SceneHotspot]:
    node, _ = _node_with_panorama(db, node_id)
    return _hotspots_for_node(node)
