import type { TourPanorama } from "@/types";

import { PanoramaLinkedList } from "./PanoramaLinkedList";
import { PanoramaNode } from "./PanoramaNode";

const FLOOR_CROSS_REF_KEY: Record<string, "groundFloor" | "firstFloor" | "secondFloor" | "thirdFloor"> = {
  "Ground Floor": "groundFloor",
  "First Floor": "firstFloor",
  "Second Floor": "secondFloor",
  "Third Floor": "thirdFloor",
};

/** Holds one PanoramaLinkedList per floor/route (Entrance, Ground Floor,
 * First Floor, Second Floor, Third Floor today; Annex Route, Back Door
 * Route, Auditorium Entrance Route are supported by the same structure the
 * moment scene data for them exists — nothing here is Main-Building-shaped). */
export class PanoramaEngine {
  private readonly floors = new Map<string, PanoramaLinkedList>();
  private readonly nodesById = new Map<string, PanoramaNode>();

  getFloor(name: string): PanoramaLinkedList | undefined {
    return this.floors.get(name);
  }

  listFloorNames(): string[] {
    return Array.from(this.floors.keys());
  }

  getNode(sceneId: string): PanoramaNode | undefined {
    return this.nodesById.get(sceneId);
  }

  allNodes(): PanoramaNode[] {
    return Array.from(this.nodesById.values());
  }

  /** @internal used only by buildPanoramaEngine */
  _registerFloor(list: PanoramaLinkedList): void {
    this.floors.set(list.name, list);
    for (const node of list.toArray()) {
      this.nodesById.set(node.sceneId, node);
    }
  }
}

/**
 * Builds the doubly-linked-list engine from the existing, unmodified tour
 * API response (useTourPanoramas -> tourApi.listScenes). Reuses that data
 * verbatim (images, each scene's own calibrated initial_yaw/initial_pitch)
 * — it only replaces *how the frontend holds and walks the scene graph*,
 * from a flat array + findIndex to real DLL node links whose forward/back
 * entry orientation is always derived from the target's own calibration,
 * never a separately-stored edge value.
 */
export function buildPanoramaEngine(scenes: TourPanorama[]): PanoramaEngine {
  const engine = new PanoramaEngine();

  const byFloor = new Map<string, TourPanorama[]>();
  for (const scene of scenes) {
    const bucket = byFloor.get(scene.floor);
    if (bucket) bucket.push(scene);
    else byFloor.set(scene.floor, [scene]);
  }

  for (const [floorName, floorScenes] of byFloor) {
    const ordered = [...floorScenes].sort(
      (a, b) => (a.sequenceIndex ?? 0) - (b.sequenceIndex ?? 0),
    );
    const list = new PanoramaLinkedList(floorName);

    let previousScene: TourPanorama | null = null;
    for (const scene of ordered) {
      const node = new PanoramaNode({
        sceneId: scene.id,
        panoramaId: scene.panoramaId,
        name: scene.name,
        building: scene.building,
        floor: scene.floor,
        room: scene.room,
        imagePath: scene.image,
        previewImagePath: scene.previewImage ?? null,
        sequenceIndex: scene.sequenceIndex ?? null,
        yaw: scene.yaw,
        pitch: scene.pitch,
        hfov: scene.hfov,
        aiDescription: scene.description ?? null,
        hotspots: scene.hotspots,
      });

      if (previousScene) {
        list.append(
          node,
          // Walking forward always lands facing this node's own calibrated
          // orientation, and walking backward always lands facing exactly
          // opposite *that* node's own calibrated orientation — both read
          // live off initial_yaw/initial_pitch (never a separately-stored,
          // and after recalibration potentially stale, edge.entry_yaw).
          // This is what makes a saved recalibration apply to Next/
          // Previous/Guided Tour immediately, with no backend edge writes
          // and no DLL/hotspot-engine redesign — the saved view is the only
          // reference either direction ever reads.
          { yaw: scene.yaw, pitch: scene.pitch },
          { yaw: previousScene.yaw + 180, pitch: previousScene.pitch },
        );
      } else {
        list.append(node);
      }

      previousScene = scene;
    }

    engine._registerFloor(list);
  }

  // Second pass: branch/floor-transition hotspots become cross-reference node
  // pointers — the only data source the Sprint 2 hotspot engine reads from.
  for (const scene of scenes) {
    const node = engine.getNode(scene.id);
    if (!node) continue;

    for (const hotspot of scene.hotspots) {
      if (hotspot.type === "forward" || hotspot.type === "back") continue;
      const target = engine.getNode(hotspot.targetId);
      if (!target) continue;

      switch (hotspot.type) {
        case "left":
        case "right":
          node.crossReferences.oppositeCorridor = target;
          break;
        case "elevator":
          node.crossReferences.lift = [...(node.crossReferences.lift ?? []), target];
          break;
        case "upstairs":
          node.crossReferences.floorUp = target;
          break;
        case "downstairs":
          node.crossReferences.floorDown = target;
          break;
        case "enter_room":
          node.crossReferences.roomEntry = target;
          break;
        case "exit_room":
          node.crossReferences.returnTo = target;
          break;
        default:
          break;
      }

      const floorKey = FLOOR_CROSS_REF_KEY[target.floor];
      if (floorKey) node.crossReferences[floorKey] = target;
    }
  }

  return engine;
}
