import type { EdgeType } from "@/types/edge";

/** Mirrors backend/app/schemas/navigation.py's RouteStep exactly. */
export interface RouteStep {
  instruction: string;
  node_id: number;
  node_name: string;
  distance: number;
  edge_type: EdgeType | null;
}

/** Mirrors backend/app/schemas/navigation.py's RouteResponse exactly —
 * this is the same schema Phase 5's navigation engine has always
 * produced, now reachable again via GET /api/v1/navigate (Phase 19). */
export interface Route {
  path_node_ids: number[];
  path_node_names: string[];
  total_distance: number;
  estimated_walk_time_minutes: number;
  is_accessible: boolean;
  turn_by_turn: RouteStep[];
}
