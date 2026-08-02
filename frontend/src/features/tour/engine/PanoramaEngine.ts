import type { CrossFloorHotspotDto, TourPanorama } from "@/types";

import { PanoramaLinkedList } from "./PanoramaLinkedList";
import { PanoramaNode } from "./PanoramaNode";

const FLOOR_CROSS_REF_KEY: Record<string, "groundFloor" | "firstFloor" | "secondFloor" | "thirdFloor"> = {
  "Ground Floor": "groundFloor",
  "First Floor": "firstFloor",
  "Second Floor": "secondFloor",
  "Third Floor": "thirdFloor",
};

/** Staircase connections between floor DLLs — each floor's *last* scene
 * (by sequence) connects forward into the next floor's *first* scene, and
 * back again, exactly like any other forward/back link within a floor.
 * Nothing here is hotspot- or calibration-specific: it only ever sets
 * node.next/node.previous, which the existing hotspot engine already turns
 * into a Forward/Back arrow positioned from that node's own initial_yaw. */
const STAIRCASE_FLOOR_CHAIN = ["Ground Floor", "First Floor", "Second Floor", "Third Floor"] as const;

/** Ground Floor's calibrated scene #5 is a standalone courtyard view, not
 * part of the corridor walk — reclassified to its own single-scene "floor"
 * so it gets its own DLL (necessarily head===tail, no next/previous) and
 * its own sidebar entry, while Ground Floor's real sequence closes the gap
 * around it (scene #4 links directly to #6). The underlying scene object
 * (image, panoramaId, calibrated yaw/pitch) is carried through unchanged —
 * only which floor bucket it sorts into changes. */
const CENTRAL_QUADRANGLE_SOURCE = { floor: "Ground Floor", sequenceIndex: 5 } as const;
const CENTRAL_QUADRANGLE_LABEL = "Central Quadrangle";

/**
 * Applies the Central Quadrangle reclassification to a raw scene list.
 * Called once, up front, on the same array every consumer on the tour page
 * shares (sidebar, minimap, preloader, and the engine below) — so there is
 * exactly one place that knows "scene #5 isn't really Ground Floor," not a
 * separate copy of that knowledge in each consumer.
 */
export function applyFloorReclassification(scenes: TourPanorama[]): TourPanorama[] {
  return scenes.map((scene) =>
    scene.floor === CENTRAL_QUADRANGLE_SOURCE.floor &&
    scene.sequenceIndex === CENTRAL_QUADRANGLE_SOURCE.sequenceIndex
      ? { ...scene, floor: CENTRAL_QUADRANGLE_LABEL }
      : scene,
  );
}

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
 *
 * `crossFloorHotspots` is the separate, hand-placed sightline dataset
 * (cross-floor-hotspots API) — optional and empty by default so every other
 * caller (validation, synthetic tests) can keep building an engine with
 * just scene data, exactly as before. Each hotspot is attached ONLY to its
 * own `source_node_id` (see the fourth pass below) — the panorama it was
 * authored on and nowhere else. This is what makes `node.crossFloorHotspots`
 * the single, already-scoped per-node index that both normal touring
 * (hotspotEngine.ts) and the dev-only authoring overlay (PanoramaViewer)
 * read from.
 */
export function buildPanoramaEngine(
  scenes: TourPanorama[],
  crossFloorHotspots: CrossFloorHotspotDto[] = [],
): PanoramaEngine {
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
    ordered.forEach((scene, index) => {
      const node = new PanoramaNode({
        sceneId: scene.id,
        panoramaId: scene.panoramaId,
        name: scene.name,
        building: scene.building,
        floor: scene.floor,
        room: scene.room,
        imagePath: scene.image,
        previewImagePath: scene.previewImage ?? null,
        // 1-based position in *this floor's own* (possibly gapped, after
        // Central Quadrangle reclassification) sequence — not the raw
        // stored sequence_index — so "Scene X of Y" never shows a gap.
        sequenceIndex: index + 1,
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
    });

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

  // Third pass: staircase connections between floors. Each floor's tail
  // (its last scene) links forward into the next floor's head (its first
  // scene) exactly like an ordinary same-floor link — same PanoramaLink
  // shape, same entry-orientation rule (always the *target's* own
  // calibrated yaw/pitch), so Manual Tour, Guided Tour and the hotspot
  // engine all cross the boundary with no awareness that anything special
  // happened. Only next/previous pointers are touched; each floor's own
  // PanoramaLinkedList (head/tail/size) is untouched.
  for (let i = 0; i < STAIRCASE_FLOOR_CHAIN.length - 1; i++) {
    const lower = engine.getFloor(STAIRCASE_FLOOR_CHAIN[i]);
    const upper = engine.getFloor(STAIRCASE_FLOOR_CHAIN[i + 1]);
    if (!lower?.tail || !upper?.head) continue;

    const staircaseDown = lower.tail;
    const staircaseUp = upper.head;

    staircaseDown.next = {
      node: staircaseUp,
      entryYaw: staircaseUp.yaw,
      entryPitch: staircaseUp.pitch,
    };
    staircaseUp.previous = {
      node: staircaseDown,
      entryYaw: staircaseDown.yaw + 180,
      entryPitch: staircaseDown.pitch,
    };
  }

  // Fourth pass: hand-placed cross-floor sightline hotspots. Attached ONLY
  // to the exact node it was authored on (source_node_id) — never to any
  // other node, however similar the viewpoint. No propagation to adjacent
  // scenes, no same-floor grouping, no inference: a hotspot placed on
  // Scene 4 renders on Scene 4 and nowhere else, full stop. A row whose
  // source_node_id is unresolvable is skipped rather than thrown, since
  // this dataset is edited live via the placement tool and must never be
  // able to break the tour if a node is ever renumbered.
  for (const row of crossFloorHotspots) {
    const target = engine.getNode(String(row.target_node_id));
    const source = engine.getNode(String(row.source_node_id));
    if (!target || !source) continue;

    source.crossFloorHotspots.push({
      id: String(row.id),
      target,
      yaw: row.yaw,
      pitch: row.pitch,
      label: row.label,
    });
  }

  return engine;
}
