export type NodeType =
  | "entrance"
  | "junction"
  | "room"
  | "staircase"
  | "elevator"
  | "landmark"
  | "outdoor";

export interface CampusNode {
  id: number;
  campus_id: number;
  building_id: number | null;
  floor_id: number | null;
  name: string;
  node_type: NodeType;
  pos_x: number | null;
  pos_y: number | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  updated_at: string;
}
