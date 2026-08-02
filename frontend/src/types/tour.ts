import type { EdgeDirection, EdgeType } from "./edge";

export type HotspotDirection =
  | "forward"
  | "back"
  | "left"
  | "right"
  | "opposite"
  | "upstairs"
  | "downstairs"
  | "elevator"
  | "enter_room"
  | "exit_room"
  | "cross_floor";

export interface TourHotspot {
  type: HotspotDirection;
  label: string;
  yaw: number;
  pitch: number;
  targetId: string;
  /** Camera orientation the target scene should open with when arrived at
   * via this specific hotspot (Street View style: keep facing the direction
   * of travel). Already resolved server-side (an explicit entry orientation,
   * else a forward/back guess). Undefined means "use the target scene's own
   * resting yaw/pitch" — neither applies. */
  entryYaw?: number;
  entryPitch?: number;
  /** "elevator" hotspots only — every floor reachable from here, for a
   * Select-Floor UI (Sprint 2 Step 8). Undefined for every other type. */
  floorOptions?: { sceneId: string; label: string }[];
  /** "cross_floor" only — the CrossFloorHotspot row's own database id, so
   * the dev-only edit affordance on the marker knows exactly which row to
   * open for editing. Undefined for every other type. */
  hotspotId?: number;
}

export interface TourPanorama {
  id: string;
  /** The underlying Panorama row's own id — distinct from `id` (which is the
   * node id) — needed to call PUT /panoramas/{panoramaId}/orientation. */
  panoramaId: number;
  name: string;
  building: string;
  floor: string;
  room: string | null;
  image: string;
  previewImage?: string | null;
  description?: string | null;
  sequenceIndex?: number | null;
  yaw: number;
  pitch: number;
  hfov: number;
  hotspots: TourHotspot[];
}

/** Raw shapes returned by GET /api/v1/tour/* — mapped into TourPanorama/TourHotspot
 * by useTourPanoramas so every other tour component only ever sees the shape above. */
export interface TourSceneHotspotDto {
  edge_id: number;
  target_node_id: number;
  direction: EdgeDirection;
  edge_type: EdgeType;
  yaw: number;
  pitch: number;
  label: string;
  entry_yaw: number | null;
  entry_pitch: number | null;
}

export interface TourSceneDto {
  node_id: number;
  panorama_id: number;
  name: string;
  building_id: number;
  building_name: string;
  floor_id: number;
  floor_name: string;
  sequence_index: number | null;
  image_path: string;
  preview_path: string | null;
  initial_yaw: number;
  initial_pitch: number;
  hfov: number;
  description: string | null;
  hotspots: TourSceneHotspotDto[];
}
