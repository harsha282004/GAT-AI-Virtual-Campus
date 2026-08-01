import { apiClient } from "@/api/client";
import type {
  EdgeDirection,
  EdgeType,
  Floor,
  HotspotDirection,
  TourHotspot,
  TourPanorama,
  TourSceneDto,
} from "@/types";

function mapHotspotType(direction: EdgeDirection, edgeType: EdgeType): HotspotDirection {
  switch (direction) {
    case "forward":
      return "forward";
    case "back":
      return "back";
    case "left":
      return "left";
    case "right":
      return "right";
    case "up":
      return edgeType === "elevator" ? "elevator" : "upstairs";
    case "down":
      return edgeType === "elevator" ? "elevator" : "downstairs";
    default:
      return "forward";
  }
}

function mapHotspot(dto: TourSceneDto["hotspots"][number]): TourHotspot {
  return {
    type: mapHotspotType(dto.direction, dto.edge_type),
    label: dto.label,
    yaw: dto.yaw,
    pitch: dto.pitch,
    targetId: String(dto.target_node_id),
    entryYaw: dto.entry_yaw ?? undefined,
    entryPitch: dto.entry_pitch ?? undefined,
  };
}

/**
 * Maps a backend scene to the TourPanorama shape every existing tour
 * component (PanoramaViewer, TourSidebar, TourControls, TourTopBar) already
 * consumes — this is the only place that needs to know the backend's field
 * names, so those components need no changes to move off the static JSON.
 *
 * `room` is left null: these scenes are corridor/entrance steps in a
 * walkthrough sequence, not named destinations. TourSidebar falls back to
 * the scene's name when room is null, so the full sequence is still listed.
 */
export function sceneToTourPanorama(scene: TourSceneDto): TourPanorama {
  return {
    id: String(scene.node_id),
    panoramaId: scene.panorama_id,
    name: scene.name,
    building: scene.building_name,
    floor: scene.floor_name,
    room: null,
    image: scene.image_path,
    previewImage: scene.preview_path,
    description: scene.description,
    sequenceIndex: scene.sequence_index,
    yaw: scene.initial_yaw,
    pitch: scene.initial_pitch,
    hfov: scene.hfov,
    hotspots: scene.hotspots.map(mapHotspot),
  };
}

export const tourApi = {
  listFloors: async (buildingId: number): Promise<Floor[]> => {
    const { data } = await apiClient.get<Floor[]>("/tour/floors", {
      params: { building_id: buildingId },
    });
    return data;
  },

  listScenes: async (buildingId: number, floorId?: number): Promise<TourPanorama[]> => {
    const { data } = await apiClient.get<TourSceneDto[]>("/tour/scenes", {
      params: { building_id: buildingId, floor_id: floorId },
    });
    return data.map(sceneToTourPanorama);
  },

  getScene: async (nodeId: number): Promise<TourPanorama> => {
    const { data } = await apiClient.get<TourSceneDto>(`/tour/scenes/${nodeId}`);
    return sceneToTourPanorama(data);
  },
};
