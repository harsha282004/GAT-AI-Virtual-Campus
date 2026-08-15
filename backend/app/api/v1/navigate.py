"""Phase 19 — GET /api/v1/navigate.

Reuses the existing A* campus graph engine (app.navigation: build_graph,
find_shortest_path, format_directions) exactly as-is — no pathfinding
algorithm, graph structure, or response shape is reimplemented here. That
engine has been fully intact and tested since Phase 5; Phase 9 only
removed its natural-language chat entry point (scripts/ai/campus_tools.py's
old navigation_tool — see that module's own docstring), not the engine
itself, and explicitly left it available for exactly this kind of
structured reuse. This router is the first thing to call
find_shortest_path/format_directions again since Phase 9.

GET (not POST) with query params, matching this codebase's actual
existing convention for stateless read/compute endpoints — see
backend/app/api/v1/tour.py's `/scenes?building_id=...`, not
CLAUDE.md's older POST-with-{from,to}-body sketch (written before
node-ID-based GPS integration existed; see root CLAUDE.md's own preamble
that actual code wins when the two disagree).

Takes start_node_id/destination_node_id — plain campus graph node IDs,
never raw GPS coordinates. Resolving a GPS position to a node ID is a
client-side concern (Phase 19's useCampusNavigation.ts +
findNearestCampusNode.ts), per the explicit "prefer client-side location
handling" instruction — this endpoint never sees a latitude/longitude.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.navigation import build_graph, find_shortest_path, format_directions
from app.schemas.navigation import RouteResponse

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get(
    "",
    response_model=RouteResponse,
    summary="Shortest walking route between two campus graph nodes",
)
def get_route(
    start_node_id: int = Query(..., description="Route start node ID"),
    destination_node_id: int = Query(..., description="Route destination node ID"),
    accessible_only: bool = Query(
        False, description="Restrict routing to wheelchair-accessible edges only"
    ),
    db: Session = Depends(get_db),
) -> RouteResponse:
    graph = build_graph(db, accessible_only=accessible_only)
    path = find_shortest_path(graph, start_node_id, destination_node_id)
    turn_by_turn = format_directions(path, graph.nodes_by_id)

    logger.info(
        "Route computed: start_node_id=%s destination_node_id=%s distance=%.1fm accessible_only=%s",
        start_node_id,
        destination_node_id,
        path.total_distance,
        accessible_only,
    )

    return RouteResponse(
        path_node_ids=path.node_ids,
        path_node_names=[graph.nodes_by_id[node_id].name for node_id in path.node_ids],
        total_distance=path.total_distance,
        estimated_walk_time_minutes=path.estimated_walk_time_minutes,
        is_accessible=path.is_accessible,
        turn_by_turn=turn_by_turn,
    )
