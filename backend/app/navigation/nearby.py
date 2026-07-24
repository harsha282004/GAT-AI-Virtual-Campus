from sqlalchemy.orm import Session

from app.models.panorama import Panorama
from app.models.room import Room
from app.navigation.graph_builder import CampusGraph
from app.navigation.pathfinding import single_source_distances


def find_nearby_rooms(
    db: Session, graph: CampusGraph, start_id: int, *, limit: int = 5
) -> list[tuple[Room, float]]:
    """Rooms reachable from start_id, nearest first (by walking distance),
    excluding the room the start node itself anchors, if any."""
    distances = single_source_distances(graph, start_id)
    rooms_by_node_id = {r.node_id: r for r in db.query(Room).filter(Room.node_id.isnot(None)).all()}

    candidates = [
        (rooms_by_node_id[node_id], distance)
        for node_id, distance in distances.items()
        if node_id in rooms_by_node_id and node_id != start_id
    ]
    candidates.sort(key=lambda pair: pair[1])
    return candidates[:limit]


def find_nearest_panorama(
    db: Session, graph: CampusGraph, start_id: int
) -> tuple[Panorama, float] | None:
    """The panorama at start_id if one exists there already (distance 0), else
    the nearest reachable node (campus-wide) that has one."""
    direct = db.query(Panorama).filter(Panorama.node_id == start_id).first()
    if direct is not None:
        return (direct, 0.0)

    distances = single_source_distances(graph, start_id)
    panoramas_by_node_id = {p.node_id: p for p in db.query(Panorama).all()}

    candidates = [
        (panoramas_by_node_id[node_id], distance)
        for node_id, distance in distances.items()
        if node_id in panoramas_by_node_id
    ]
    if not candidates:
        return None
    candidates.sort(key=lambda pair: pair[1])
    return candidates[0]
