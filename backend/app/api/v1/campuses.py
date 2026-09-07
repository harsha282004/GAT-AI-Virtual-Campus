from fastapi import Depends
from sqlalchemy.orm import Session

from app import crud
from app.api.deps import get_db
from app.api.v1.crud_router import build_crud_router
from app.core.exceptions import NotFoundError
from app.models import Building, Edge, Floor, Node, Panorama, Room
from app.schemas.campus import CampusCreate, CampusRead, CampusStats, CampusUpdate

router = build_crud_router(
    crud_obj=crud.campus,
    create_schema=CampusCreate,
    update_schema=CampusUpdate,
    read_schema=CampusRead,
    resource_name="Campus",
)


@router.get(
    "/{campus_id}/stats",
    response_model=CampusStats,
    summary="Aggregate campus counts (buildings, floors, rooms, nodes, edges, scenes)",
)
def get_campus_stats(campus_id: int, db: Session = Depends(get_db)) -> CampusStats:
    """Single lightweight read for the Campus page's "at a glance" numbers —
    replaces fetching the full nodes/edges/panoramas lists client-side just
    to count them. Reuses the existing tables only; adds no storage."""
    if crud.campus.get(db, campus_id) is None:
        raise NotFoundError(f"Campus {campus_id} not found.")

    building_ids = [
        b for (b,) in db.query(Building.id).filter(Building.campus_id == campus_id).all()
    ]
    floor_ids = (
        [f for (f,) in db.query(Floor.id).filter(Floor.building_id.in_(building_ids)).all()]
        if building_ids
        else []
    )
    node_ids = [n for (n,) in db.query(Node.id).filter(Node.campus_id == campus_id).all()]

    rooms = db.query(Room).filter(Room.floor_id.in_(floor_ids)).count() if floor_ids else 0
    edges = db.query(Edge).filter(Edge.source_node_id.in_(node_ids)).count() if node_ids else 0

    panoramas = db.query(Panorama).filter(Panorama.node_id.in_(node_ids)).count() if node_ids else 0
    tour_scenes = (
        db.query(Panorama)
        .filter(Panorama.node_id.in_(node_ids), Panorama.is_placeholder.is_(False))
        .count()
        if node_ids
        else 0
    )

    return CampusStats(
        campus_id=campus_id,
        buildings=len(building_ids),
        floors=len(floor_ids),
        rooms=rooms,
        nodes=len(node_ids),
        edges=edges,
        panoramas=panoramas,
        tour_scenes=tour_scenes,
    )
