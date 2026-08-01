import type { HotspotDirection, TourHotspot, TourPanorama } from "@/types";

import type { PanoramaNode } from "./PanoramaNode";

export type ManualTourHotspotKind =
  | "forward"
  | "back"
  | "opposite"
  | "floor_up"
  | "floor_down"
  | "lift"
  | "enter_room"
  | "return_to_corridor";

export interface ManualTourFloorOption {
  sceneId: string;
  label: string;
}

/** One Manual Tour hotspot, derived entirely from a PanoramaNode's own
 * links/crossReferences (Sprint 2 Step 1/9) — never a hardcoded array.
 * yaw/pitch/entry* still come from the node's calibrated source imagery
 * data (that positioning is a physical-camera fact, not something a graph
 * pointer can invent) — what's dynamic here is *whether* a hotspot exists
 * and *where it goes*, both driven by the node graph alone. */
export interface ManualTourHotspot {
  kind: ManualTourHotspotKind;
  targetSceneId: string;
  label: string;
  yaw: number;
  pitch: number;
  entryYaw?: number;
  entryPitch?: number;
  /** "lift" only — every reachable floor from here, for a floor-select UI. */
  floorOptions?: ManualTourFloorOption[];
}

function findRaw(
  node: PanoramaNode,
  type: HotspotDirection,
  targetId: string,
): TourHotspot | undefined {
  return node.hotspots.find((h) => h.type === type && h.targetId === targetId);
}

/**
 * Builds every navigable hotspot for a scene purely from its PanoramaNode
 * state (next/previous/crossReferences) — Sprint 2's Hotspot Engine.
 * A capability with no corresponding node reference produces no hotspot;
 * there is no manual enable/disable switch anywhere in this function
 * (Step 9: visibility must always follow the node, never be hardcoded).
 */
export function buildManualTourHotspots(node: PanoramaNode): ManualTourHotspot[] {
  const hotspots: ManualTourHotspot[] = [];
  const refs = node.crossReferences;

  if (node.next) {
    const raw = findRaw(node, "forward", node.next.node.sceneId);
    if (raw) {
      hotspots.push({
        kind: "forward",
        targetSceneId: node.next.node.sceneId,
        label: raw.label,
        yaw: raw.yaw,
        pitch: raw.pitch,
        entryYaw: node.next.entryYaw ?? undefined,
        entryPitch: node.next.entryPitch ?? undefined,
      });
    }
  }

  if (node.previous) {
    const raw = findRaw(node, "back", node.previous.node.sceneId);
    if (raw) {
      hotspots.push({
        kind: "back",
        targetSceneId: node.previous.node.sceneId,
        label: raw.label,
        yaw: raw.yaw,
        pitch: raw.pitch,
        entryYaw: node.previous.entryYaw ?? undefined,
        entryPitch: node.previous.entryPitch ?? undefined,
      });
    }
  }

  if (refs.oppositeCorridor) {
    const target = refs.oppositeCorridor;
    const raw =
      findRaw(node, "left", target.sceneId) ?? findRaw(node, "right", target.sceneId);
    if (raw) {
      hotspots.push({
        kind: "opposite",
        targetSceneId: target.sceneId,
        label: "Go To Opposite Corridor",
        yaw: raw.yaw,
        pitch: raw.pitch,
        entryYaw: raw.entryYaw ?? undefined,
        entryPitch: raw.entryPitch ?? undefined,
      });
    }
  }

  if (refs.floorUp) {
    const target = refs.floorUp;
    const raw = findRaw(node, "upstairs", target.sceneId);
    if (raw) {
      hotspots.push({
        kind: "floor_up",
        targetSceneId: target.sceneId,
        label: `Move Up · ${target.floor}`,
        yaw: raw.yaw,
        pitch: raw.pitch,
        entryYaw: raw.entryYaw ?? undefined,
        entryPitch: raw.entryPitch ?? undefined,
      });
    }
  }

  if (refs.floorDown) {
    const target = refs.floorDown;
    const raw = findRaw(node, "downstairs", target.sceneId);
    if (raw) {
      hotspots.push({
        kind: "floor_down",
        targetSceneId: target.sceneId,
        label: `Move Down · ${target.floor}`,
        yaw: raw.yaw,
        pitch: raw.pitch,
        entryYaw: raw.entryYaw ?? undefined,
        entryPitch: raw.entryPitch ?? undefined,
      });
    }
  }

  if (refs.lift && refs.lift.length > 0) {
    const [primary] = refs.lift;
    const raw = findRaw(node, "elevator", primary.sceneId);
    if (raw) {
      hotspots.push({
        kind: "lift",
        targetSceneId: primary.sceneId,
        label: "Lift",
        yaw: raw.yaw,
        pitch: raw.pitch,
        entryYaw: raw.entryYaw ?? undefined,
        entryPitch: raw.entryPitch ?? undefined,
        floorOptions: refs.lift.map((n) => ({ sceneId: n.sceneId, label: n.floor })),
      });
    }
  }

  if (refs.roomEntry) {
    const target = refs.roomEntry;
    const raw = findRaw(node, "enter_room", target.sceneId);
    if (raw) {
      hotspots.push({
        kind: "enter_room",
        targetSceneId: target.sceneId,
        label: "Enter Room",
        yaw: raw.yaw,
        pitch: raw.pitch,
        entryYaw: raw.entryYaw ?? undefined,
        entryPitch: raw.entryPitch ?? undefined,
      });
    }
  }

  if (refs.returnTo) {
    const target = refs.returnTo;
    const raw = findRaw(node, "exit_room", target.sceneId);
    if (raw) {
      hotspots.push({
        kind: "return_to_corridor",
        targetSceneId: target.sceneId,
        label: "Return To Corridor",
        yaw: raw.yaw,
        pitch: raw.pitch,
        entryYaw: raw.entryYaw ?? undefined,
        entryPitch: raw.entryPitch ?? undefined,
      });
    }
  }

  return hotspots;
}

const KIND_TO_DIRECTION: Record<ManualTourHotspotKind, HotspotDirection> = {
  forward: "forward",
  back: "back",
  opposite: "opposite",
  floor_up: "upstairs",
  floor_down: "downstairs",
  lift: "elevator",
  enter_room: "enter_room",
  return_to_corridor: "exit_room",
};

function toTourHotspot(hotspot: ManualTourHotspot): TourHotspot {
  return {
    type: KIND_TO_DIRECTION[hotspot.kind],
    label: hotspot.label,
    yaw: hotspot.yaw,
    pitch: hotspot.pitch,
    targetId: hotspot.targetSceneId,
    entryYaw: hotspot.entryYaw,
    entryPitch: hotspot.entryPitch,
    floorOptions: hotspot.floorOptions,
  };
}

/** The Manual Tour Engine's public entry point: a full TourPanorama (the
 * shape every existing tour component already renders) whose `.hotspots`
 * are generated fresh from the node graph on every call — never passed
 * through from raw backend data. */
export function toManualTourPanorama(node: PanoramaNode): TourPanorama {
  return {
    ...node.toTourPanorama(),
    hotspots: buildManualTourHotspots(node).map(toTourHotspot),
  };
}
