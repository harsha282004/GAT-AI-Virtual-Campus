export interface Campus {
  id: number;
  name: string;
  description: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
}

/** GET /api/v1/campuses/{id}/stats — aggregate counts for "Campus at a Glance". */
export interface CampusStats {
  campus_id: number;
  buildings: number;
  floors: number;
  rooms: number;
  nodes: number;
  edges: number;
  panoramas: number;
  tour_scenes: number;
}

/** GET /api/v1/navigate — one turn on the computed A* walking route. */
export interface CampusRouteStep {
  instruction: string;
  node_id: number;
  node_name: string;
  distance: number;
  edge_type: string | null;
}

/** GET /api/v1/navigate — the full computed route. */
export interface CampusRoute {
  path_node_ids: number[];
  path_node_names: string[];
  total_distance: number;
  estimated_walk_time_minutes: number;
  is_accessible: boolean;
  turn_by_turn: CampusRouteStep[];
}
