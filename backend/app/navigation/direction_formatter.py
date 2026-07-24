from app.models.edge import Edge, EdgeDirection, EdgeType
from app.models.node import Node
from app.navigation.pathfinding import PathResult
from app.schemas.navigation import RouteStep

_MOVEMENT_VERBS: dict[EdgeType, str] = {
    EdgeType.CORRIDOR: "Walk through the corridor",
    EdgeType.WALKWAY: "Walk forward",
    EdgeType.STAIRS: "Take the stairs",
    EdgeType.ELEVATOR: "Take the elevator",
    EdgeType.RAMP: "Go up the ramp",
    EdgeType.OUTDOOR_PATH: "Walk forward",
}

_TURN_PHRASES: dict[EdgeDirection, str] = {
    EdgeDirection.LEFT: "Turn left.",
    EdgeDirection.RIGHT: "Turn right.",
    EdgeDirection.BACK: "Turn around.",
}

_SIDE_PHRASES: dict[EdgeDirection, str] = {
    EdgeDirection.LEFT: "on your left",
    EdgeDirection.RIGHT: "on your right",
}


def _movement_phrase(edge: Edge, next_node: Node) -> str:
    verb = _MOVEMENT_VERBS.get(edge.edge_type, "Continue")

    if edge.floor_transition and edge.edge_type in (EdgeType.STAIRS, EdgeType.ELEVATOR):
        floor_name = next_node.floor.name if next_node.floor is not None else "the next floor"
        return f"{verb} to {floor_name}."

    return f"{verb} for {edge.distance:.0f}m."


def format_directions(path: PathResult, nodes_by_id: dict[int, Node]) -> list[RouteStep]:
    """Turn a raw node/edge path into template-based, human-readable steps —
    deterministic phrasing driven by edge_type/direction/floor_transition, no
    LLM involved. Each step's `instruction` may combine a turn cue, the
    movement itself, and — on the final step, if arriving at a room — a
    "Room X is on your left/right" cue, matching real wayfinding phrasing."""
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

    last_index = len(path.edges) - 1
    for index, (edge, next_node_id) in enumerate(zip(path.edges, path.node_ids[1:], strict=True)):
        next_node = nodes_by_id[next_node_id]
        sentences: list[str] = []

        turn_phrase = _TURN_PHRASES.get(edge.direction)
        if turn_phrase:
            sentences.append(turn_phrase)

        sentences.append(_movement_phrase(edge, next_node))

        is_final_step = index == last_index
        if is_final_step and next_node.room is not None:
            side = _SIDE_PHRASES.get(edge.direction, "ahead")
            sentences.append(f"{next_node.room.name} is {side}.")

        steps.append(
            RouteStep(
                instruction=" ".join(sentences),
                node_id=next_node.id,
                node_name=next_node.name,
                distance=edge.distance,
                edge_type=edge.edge_type,
            )
        )

    return steps
