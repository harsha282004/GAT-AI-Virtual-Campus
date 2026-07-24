import logging

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.exceptions import BadRequestError, NotFoundError
from app.crud.building import building as crud_building
from app.crud.room import room as crud_room
from app.navigation import (
    build_graph,
    find_shortest_path,
    format_directions,
    resolve_building_entrance_node,
    search_buildings,
    search_rooms,
)
from app.schemas.navigation import (
    BuildingMatch,
    BuildingNavigationResponse,
    RoomMatch,
    RoomNavigationResponse,
    RouteResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()


def _build_route_response(db: Session, start_id: int, goal_id: int) -> RouteResponse:
    graph = build_graph(db)
    path = find_shortest_path(graph, start_id, goal_id)
    steps = format_directions(path, graph.nodes_by_id)
    return RouteResponse(
        path_node_ids=path.node_ids,
        path_node_names=[graph.nodes_by_id[nid].name for nid in path.node_ids],
        total_distance=round(path.total_distance, 1),
        estimated_walk_time_minutes=path.estimated_walk_time_minutes,
        turn_by_turn=steps,
    )


@router.get("", response_model=RouteResponse, summary="Shortest path between two nodes")
def navigate(
    from_node_id: int = Query(..., description="Starting node ID"),
    to_node_id: int = Query(..., description="Destination node ID"),
    db: Session = Depends(get_db),
) -> RouteResponse:
    logger.info("Navigation request: node %s -> node %s", from_node_id, to_node_id)
    return _build_route_response(db, from_node_id, to_node_id)


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

    matches = [
        RoomMatch(
            id=r.id,
            name=r.name,
            room_number=r.room_number,
            floor_id=r.floor_id,
            floor_name=r.floor.name,
            building_id=r.floor.building_id,
            building_name=r.floor.building.name,
            node_id=r.node_id,
        )
        for r in matched_rooms
    ]

    route = None
    if from_node_id is not None and len(matches) == 1 and matches[0].node_id is not None:
        logger.info("Navigation request: node %s -> room %s", from_node_id, matches[0].id)
        route = _build_route_response(db, from_node_id, matches[0].node_id)

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
        route = _build_route_response(db, from_node_id, matches[0].entrance_node_id)

    return BuildingNavigationResponse(matches=matches, route=route)
