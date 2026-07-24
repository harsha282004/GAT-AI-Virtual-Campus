from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from app.models.edge import Edge
from app.models.node import Node


@dataclass
class GraphEdge:
    neighbor_id: int
    distance: float
    edge: Edge


Graph = dict[int, list[GraphEdge]]


@dataclass
class CampusGraph:
    adjacency: Graph = field(default_factory=dict)
    nodes_by_id: dict[int, Node] = field(default_factory=dict)


def build_graph(db: Session, *, accessible_only: bool = False) -> CampusGraph:
    """Load all nodes/edges from the database and build an in-memory adjacency
    list for pathfinding. Bidirectional edges are expanded into both
    directions; unidirectional edges (e.g. a one-way fire-exit stair) are not.

    When accessible_only=True, edges flagged as not wheelchair-accessible
    (e.g. stairs) are excluded entirely, so the pathfinder can only route
    through corridors, ramps, and elevators."""
    nodes = db.query(Node).all()
    edges_query = db.query(Edge)
    if accessible_only:
        edges_query = edges_query.filter(Edge.accessible.is_(True))
    edges = edges_query.all()

    nodes_by_id = {n.id: n for n in nodes}
    adjacency: Graph = {node_id: [] for node_id in nodes_by_id}

    for edge in edges:
        adjacency.setdefault(edge.source_node_id, []).append(
            GraphEdge(neighbor_id=edge.target_node_id, distance=edge.distance, edge=edge)
        )
        if edge.is_bidirectional:
            adjacency.setdefault(edge.target_node_id, []).append(
                GraphEdge(neighbor_id=edge.source_node_id, distance=edge.distance, edge=edge)
            )

    return CampusGraph(adjacency=adjacency, nodes_by_id=nodes_by_id)
