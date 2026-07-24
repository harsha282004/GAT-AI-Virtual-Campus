from app.models.edge import EdgeType
from app.models.node import Node
from app.navigation.pathfinding import PathResult
from app.schemas.navigation import RouteStep

_EDGE_VERBS: dict[EdgeType, str] = {
    EdgeType.CORRIDOR: "Continue down the corridor",
    EdgeType.WALKWAY: "Walk along the walkway",
    EdgeType.STAIRS: "Take the stairs",
    EdgeType.ELEVATOR: "Take the elevator",
    EdgeType.RAMP: "Go up the ramp",
    EdgeType.OUTDOOR_PATH: "Walk outside along the path",
}


def format_directions(path: PathResult, nodes_by_id: dict[int, Node]) -> list[RouteStep]:
    """Turn a raw node/edge path into template-based, human-readable steps.
    No LLM involved — this is deterministic phrasing driven by edge_type."""
    if not path.node_ids:
        return []

    steps: list[RouteStep] = []
    start_node = nodes_by_id[path.node_ids[0]]
    steps.append(
        RouteStep(
            instruction=f"Start at {start_node.name}.",
            node_id=start_node.id,
            node_name=start_node.name,
            distance=0.0,
            edge_type=None,
        )
    )

    for edge, next_node_id in zip(path.edges, path.node_ids[1:], strict=True):
        next_node = nodes_by_id[next_node_id]
        verb = _EDGE_VERBS.get(edge.edge_type, "Continue")
        instruction = f"{verb} for {edge.distance:.0f}m to {next_node.name}."
        steps.append(
            RouteStep(
                instruction=instruction,
                node_id=next_node.id,
                node_name=next_node.name,
                distance=edge.distance,
                edge_type=edge.edge_type,
            )
        )

    return steps
