import type { CampusNode } from "@/types";

/**
 * Phase 19 — picks the campus graph node a building selection should
 * route to. Mirrors backend/app/navigation/resolvers.py's
 * resolve_building_entrance_node() exactly (same preference order: an
 * explicit building-level ENTRANCE-type node first, else any
 * building-level node) so the frontend's destination-node choice always
 * agrees with what the backend's own campus_tools.py already resolves
 * for the same building. Not a duplicate implementation of navigation
 * logic — this only selects which existing Node object represents a
 * Building for routing; find_shortest_path/format_directions themselves
 * are never reimplemented here (see useCampusNavigation.ts, which calls
 * the real backend route endpoint instead).
 */
export function resolveDestinationNode(
  buildingId: number,
  nodes: CampusNode[],
): CampusNode | null {
  const buildingNodes = nodes.filter(
    (n) => n.building_id === buildingId && n.floor_id === null,
  );

  const entrance = buildingNodes.find((n) => n.node_type === "entrance");
  if (entrance) return entrance;

  return buildingNodes[0] ?? null;
}
