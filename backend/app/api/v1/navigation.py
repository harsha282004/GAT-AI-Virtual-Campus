import logging

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.exceptions import BadRequestError, NotFoundError
from app.crud.building import building as crud_building
from app.crud.room import room as crud_room
from app.models.room import Room
from app.navigation import (
    build_graph,
    find_nearby_rooms,
    find_nearest_panorama,
    find_shortest_path,
    format_directions,
    resolve_building_entrance_node,
    search_buildings,
    search_rooms,
)
from app.schemas.navigation import (
    BuildingMatch,
    BuildingNavigationResponse,
    NearbyRoomMatch,
    NearbyRoomsResponse,
    NearestPanoramaResponse,
    RoomMatch,
    RoomNavigationResponse,
    RouteResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()


def _build_route_response(
    db: Session, start_id: int, goal_id: int, *, accessible: bool = False
) -> RouteResponse:
    graph = build_graph(db, accessible_only=accessible)
    path = find_shortest_path(graph, start_id, goal_id)
    steps = format_directions(path, graph.nodes_by_id)
    return RouteResponse(
        path_node_ids=path.node_ids,
        path_node_names=[graph.nodes_by_id[nid].name for nid in path.node_ids],
        total_distance=round(path.total_distance, 1),
        estimated_walk_time_minutes=path.estimated_walk_time_minutes,
        is_accessible=path.is_accessible,
        turn_by_turn=steps,
    )


def _room_match(room: Room) -> RoomMatch:
    return RoomMatch(
        id=room.id,
        name=room.name,
        room_number=room.room_number,
        room_type=room.room_type,
        department=room.department,
        floor_id=room.floor_id,
        floor_name=room.floor.name,
        building_id=room.floor.building_id,
        building_name=room.floor.building.name,
        node_id=room.node_id,
    )


@router.get("", response_model=RouteResponse, summary="Shortest path between two nodes")
def navigate(
    from_node_id: int = Query(..., description="Starting node ID"),
    to_node_id: int = Query(..., description="Destination node ID"),
    accessible: bool = Query(
        False, description="Wheelchair-accessible routing only (avoids stairs)"
    ),
    db: Session = Depends(get_db),
) -> RouteResponse:
    logger.info(
        "Navigation request: node %s -> node %s (accessible=%s)",
        from_node_id,
        to_node_id,
        accessible,
    )
    return _build_route_response(db, from_node_id, to_node_id, accessible=accessible)


@router.get(
    "/room",
    response_model=RoomNavigationResponse,
    summary="Search for a room, and optionally route to it",
)
def navigate_to_room(
    q: str | None = Query(None, description="Room name/number search text"),
    room_id: int | None = Query(None, description="Exact room ID to navigate to"),
    from_node_id: int | None = Query(
        None, description="Starting node ID — if omitted, only search results are returned"
    ),
    accessible: bool = Query(
        False, description="Wheelchair-accessible routing only (avoids stairs)"
    ),
    db: Session = Depends(get_db),
) -> RoomNavigationResponse:
    if room_id is not None:
        matched_room = crud_room.get(db, room_id)
        if matched_room is None:
            raise NotFoundError(f"Room {room_id} not found.")
        matched_rooms = [matched_room]
    elif q:
        matched_rooms = search_rooms(db, q)
    else:
        raise BadRequestError("Provide either `room_id` or `q`.")

    matches = [_room_match(r) for r in matched_rooms]

    route = None
    if from_node_id is not None and len(matches) == 1 and matches[0].node_id is not None:
        logger.info("Navigation request: node %s -> room %s", from_node_id, matches[0].id)
        route = _build_route_response(db, from_node_id, matches[0].node_id, accessible=accessible)

    return RoomNavigationResponse(matches=matches, route=route)


@router.get(
    "/building",
    response_model=BuildingNavigationResponse,
    summary="Search for a building, and optionally route to its entrance",
)
def navigate_to_building(
    q: str | None = Query(None, description="Building name/code search text"),
    building_id: int | None = Query(None, description="Exact building ID to navigate to"),
    from_node_id: int | None = Query(
        None, description="Starting node ID — if omitted, only search results are returned"
    ),
    accessible: bool = Query(
        False, description="Wheelchair-accessible routing only (avoids stairs)"
    ),
    db: Session = Depends(get_db),
) -> BuildingNavigationResponse:
    if building_id is not None:
        matched_building = crud_building.get(db, building_id)
        if matched_building is None:
            raise NotFoundError(f"Building {building_id} not found.")
        matched_buildings = [matched_building]
    elif q:
        matched_buildings = search_buildings(db, q)
    else:
        raise BadRequestError("Provide either `building_id` or `q`.")

    matches = []
    for b in matched_buildings:
        entrance = resolve_building_entrance_node(db, b)
        matches.append(
            BuildingMatch(
                id=b.id,
                name=b.name,
                code=b.code,
                campus_id=b.campus_id,
                entrance_node_id=entrance.id if entrance is not None else None,
            )
        )

    route = None
    if from_node_id is not None and len(matches) == 1 and matches[0].entrance_node_id is not None:
        logger.info("Navigation request: node %s -> building %s", from_node_id, matches[0].id)
        route = _build_route_response(
            db, from_node_id, matches[0].entrance_node_id, accessible=accessible
        )

    return BuildingNavigationResponse(matches=matches, route=route)


@router.get(
    "/nearby",
    response_model=NearbyRoomsResponse,
    summary="Rooms nearest to a given node, walking-distance order",
)
def nearby_rooms(
    node_id: int = Query(..., description="Node ID to search outward from"),
    limit: int = Query(5, ge=1, le=25, description="Maximum number of rooms to return"),
    db: Session = Depends(get_db),
) -> NearbyRoomsResponse:
    graph = build_graph(db)
    if node_id not in graph.nodes_by_id:
        raise NotFoundError(f"Node {node_id} not found.")

    results = find_nearby_rooms(db, graph, node_id, limit=limit)
    rooms = [
        NearbyRoomMatch(
            id=room.id,
            name=room.name,
            room_number=room.room_number,
            building_name=room.floor.building.name,
            floor_name=room.floor.name,
            distance=round(distance, 1),
            walking_time_minutes=round(distance / 1.2 / 60, 1),
        )
        for room, distance in results
    ]
    return NearbyRoomsResponse(origin_node_id=node_id, rooms=rooms)


@router.get(
    "/nearest-panorama",
    response_model=NearestPanoramaResponse,
    summary="Nearest available panorama to a given node",
)
def nearest_panorama(
    node_id: int = Query(..., description="Node ID to search outward from"),
    db: Session = Depends(get_db),
) -> NearestPanoramaResponse:
    graph = build_graph(db)
    if node_id not in graph.nodes_by_id:
        raise NotFoundError(f"Node {node_id} not found.")

    result = find_nearest_panorama(db, graph, node_id)
    if result is None:
        return NearestPanoramaResponse(
            origin_node_id=node_id,
            panorama_id=None,
            panorama_node_id=None,
            panorama_title=None,
            image_path=None,
            distance=None,
        )

    panorama, distance = result
    return NearestPanoramaResponse(
        origin_node_id=node_id,
        panorama_id=panorama.id,
        panorama_node_id=panorama.node_id,
        panorama_title=panorama.title,
        image_path=panorama.image_path,
        distance=round(distance, 1),
    )
