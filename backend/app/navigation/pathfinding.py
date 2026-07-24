import heapq
import math
from dataclasses import dataclass

from app.core.exceptions import NoPathFoundError
from app.models.edge import Edge
from app.models.node import Node
from app.navigation.graph_builder import CampusGraph

AVERAGE_WALK_SPEED_MPS = 1.2


def _heuristic(a: Node, b: Node) -> float:
    """Straight-line distance estimate used by A*. Falls back to 0 (making the
    search behave exactly like Dijkstra, which is still correct/admissible)
    whenever the two nodes don't share a coordinate frame — e.g. one is an
    indoor floor-plan point and the other only has outdoor GPS coordinates."""
    if a.pos_x is not None and a.pos_y is not None and b.pos_x is not None and b.pos_y is not None:
        return math.hypot(a.pos_x - b.pos_x, a.pos_y - b.pos_y)

    if (
        a.latitude is not None
        and a.longitude is not None
        and b.latitude is not None
        and b.longitude is not None
    ):
        # Small-scale planar approximation — adequate at campus scale.
        mean_lat_rad = math.radians((a.latitude + b.latitude) / 2)
        dx = (a.longitude - b.longitude) * 111_320 * math.cos(mean_lat_rad)
        dy = (a.latitude - b.latitude) * 110_540
        return math.hypot(dx, dy)

    return 0.0


@dataclass
class PathResult:
    node_ids: list[int]
    edges: list[Edge]
    total_distance: float

    @property
    def estimated_walk_time_minutes(self) -> float:
        if not self.edges:
            return round(self.total_distance / AVERAGE_WALK_SPEED_MPS / 60, 1)
        return round(sum(edge.walking_time for edge in self.edges), 1)

    @property
    def is_accessible(self) -> bool:
        """Whether every edge on this path is wheelchair-passable — independent
        of whether accessible-only routing was actually requested."""
        return all(edge.accessible for edge in self.edges)


def find_shortest_path(graph: CampusGraph, start_id: int, goal_id: int) -> PathResult:
    """A* shortest path over the in-memory campus graph. Degrades to Dijkstra
    automatically whenever no coordinate-based heuristic is available between
    two nodes (see _heuristic) — the search logic is identical either way,
    only the priority estimate changes, so no separate Dijkstra code path is
    needed to satisfy that fallback."""
    if start_id not in graph.nodes_by_id:
        raise NoPathFoundError(f"Start node {start_id} does not exist.")
    if goal_id not in graph.nodes_by_id:
        raise NoPathFoundError(f"Destination node {goal_id} does not exist.")

    if start_id == goal_id:
        return PathResult(node_ids=[start_id], edges=[], total_distance=0.0)

    goal_node = graph.nodes_by_id[goal_id]

    open_heap: list[tuple[float, int]] = [(0.0, start_id)]
    came_from: dict[int, tuple[int, Edge]] = {}
    g_score: dict[int, float] = {start_id: 0.0}
    visited: set[int] = set()

    while open_heap:
        _, current = heapq.heappop(open_heap)
        if current in visited:
            continue
        visited.add(current)

        if current == goal_id:
            return _reconstruct_path(came_from, start_id, goal_id, g_score[goal_id])

        for graph_edge in graph.adjacency.get(current, []):
            tentative_g = g_score[current] + graph_edge.distance
            if tentative_g < g_score.get(graph_edge.neighbor_id, math.inf):
                g_score[graph_edge.neighbor_id] = tentative_g
                came_from[graph_edge.neighbor_id] = (current, graph_edge.edge)
                f_score = tentative_g + _heuristic(
                    graph.nodes_by_id[graph_edge.neighbor_id], goal_node
                )
                heapq.heappush(open_heap, (f_score, graph_edge.neighbor_id))

    raise NoPathFoundError(f"No path exists between node {start_id} and node {goal_id}.")


def _reconstruct_path(
    came_from: dict[int, tuple[int, Edge]], start_id: int, goal_id: int, total_distance: float
) -> PathResult:
    node_ids = [goal_id]
    edges: list[Edge] = []
    current = goal_id
    while current != start_id:
        prev, edge = came_from[current]
        edges.append(edge)
        node_ids.append(prev)
        current = prev
    node_ids.reverse()
    edges.reverse()
    return PathResult(node_ids=node_ids, edges=edges, total_distance=total_distance)


def single_source_distances(graph: CampusGraph, start_id: int) -> dict[int, float]:
    """Plain Dijkstra from start_id to every reachable node. Used for
    nearest-neighbor queries (nearby rooms, nearest panorama) where there's no
    single fixed destination for A*'s heuristic to aim at, so Dijkstra is the
    directly appropriate — not merely a fallback — algorithm here."""
    if start_id not in graph.nodes_by_id:
        raise NoPathFoundError(f"Start node {start_id} does not exist.")

    distances: dict[int, float] = {start_id: 0.0}
    visited: set[int] = set()
    heap: list[tuple[float, int]] = [(0.0, start_id)]

    while heap:
        dist, current = heapq.heappop(heap)
        if current in visited:
            continue
        visited.add(current)

        for graph_edge in graph.adjacency.get(current, []):
            tentative = dist + graph_edge.distance
            if tentative < distances.get(graph_edge.neighbor_id, math.inf):
                distances[graph_edge.neighbor_id] = tentative
                heapq.heappush(heap, (tentative, graph_edge.neighbor_id))

    return distances
