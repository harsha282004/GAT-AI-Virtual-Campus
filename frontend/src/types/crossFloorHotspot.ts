/** Raw shape returned by GET/POST /api/v1/cross-floor-hotspots.
 * A hotspot renders ONLY on the exact panorama it was authored on
 * (source_node_id) — no visibility grouping, no propagation, no inference. */
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
