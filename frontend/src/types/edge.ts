export type EdgeType =
  | "corridor"
  | "walkway"
  | "stairs"
  | "elevator"
  | "ramp"
  | "outdoor_path";

export type EdgeDirection = "forward" | "left" | "right" | "back" | "up" | "down";

export interface CampusEdge {
  id: number;
  source_node_id: number;
  target_node_id: number;
  distance: number;
  is_bidirectional: boolean;
  edge_type: EdgeType;
  yaw: number | null;
  walking_time: number;
  direction: EdgeDirection;
  floor_transition: boolean;
  accessible: boolean;
  created_at: string;
  updated_at: string;
}
