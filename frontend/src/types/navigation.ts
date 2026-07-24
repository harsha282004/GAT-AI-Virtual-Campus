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
  is_accessible: boolean;
  turn_by_turn: RouteStep[];
}

export interface RoomMatch {
  id: number;
  name: string;
  room_number: string | null;
  room_type: string;
  department: string | null;
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

export interface NearbyRoomMatch {
  id: number;
  name: string;
  room_number: string | null;
  building_name: string;
  floor_name: string;
  distance: number;
  walking_time_minutes: number;
}

export interface NearbyRoomsResponse {
  origin_node_id: number;
  rooms: NearbyRoomMatch[];
}

export interface NearestPanoramaResponse {
  origin_node_id: number;
  panorama_id: number | null;
  panorama_node_id: number | null;
  panorama_title: string | null;
  image_path: string | null;
  distance: number | null;
}
