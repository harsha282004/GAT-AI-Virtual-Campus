import type { EdgeType } from "./edge";

export interface RouteStep {
  instruction: string;
  node_id: number;
  node_name: string;
  distance: number;
  edge_type: EdgeType | null;
}

export interface RouteResponse {
  path_node_ids: number[];
  path_node_names: string[];
  total_distance: number;
  estimated_walk_time_minutes: number;
  turn_by_turn: RouteStep[];
}

export interface RoomMatch {
  id: number;
  name: string;
  room_number: string | null;
  floor_id: number;
  floor_name: string;
  building_id: number;
  building_name: string;
  node_id: number | null;
}

export interface RoomNavigationResponse {
  matches: RoomMatch[];
  route: RouteResponse | null;
}

export interface BuildingMatch {
  id: number;
  name: string;
  code: string | null;
  campus_id: number;
  entrance_node_id: number | null;
}

export interface BuildingNavigationResponse {
  matches: BuildingMatch[];
  route: RouteResponse | null;
}
