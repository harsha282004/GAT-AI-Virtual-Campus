/** Raw shape returned by GET/POST /api/v1/cross-floor-hotspots.
 * visible_from_node_ids is the sole rendering rule (see backend
 * CrossFloorHotspot model docstring) — a hotspot only ever renders on a
 * panorama whose node id appears in this list. */
export interface CrossFloorHotspotDto {
  id: number;
  source_node_id: number;
  target_node_id: number;
  yaw: number;
  pitch: number;
  label: string | null;
  visible_from_node_ids: number[];
}

export interface CrossFloorHotspotCreatePayload {
  source_node_id: number;
  target_node_id: number;
  yaw: number;
  pitch: number;
  label: string | null;
  visible_from_node_ids: number[];
}
