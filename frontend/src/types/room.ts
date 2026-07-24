export interface Room {
  id: number;
  floor_id: number;
  node_id: number | null;
  name: string;
  room_number: string | null;
  room_type: string;
  capacity: number | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}
