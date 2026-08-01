/** Raw shape returned by GET/POST /api/v1/cross-floor-hotspots. */
export interface CrossFloorHotspotDto {
  id: number;
  source_node_id: number;
  target_node_id: number;
  yaw: number;
  pitch: number;
  label: string | null;
}

export interface CrossFloorHotspotCreatePayload {
  source_node_id: number;
  target_node_id: number;
  yaw: number;
  pitch: number;
  label: string | null;
}
