import type { PanoramaEngine } from "./PanoramaEngine";

export interface PanoramaValidationIssue {
  code:
    | "duplicate_scene_id"
    | "missing_previous"
    | "missing_next"
    | "orphan_node"
    | "broken_chain"
    | "missing_orientation";
  message: string;
  sceneId?: string;
  floor?: string;
}

export interface PanoramaValidationReport {
  valid: boolean;
  floorsChecked: number;
  nodesChecked: number;
  issues: PanoramaValidationIssue[];
}

/** Step 9 of Sprint 1 — structural + orientation integrity of the DLL engine.
 * Does not touch the network/backend; pure in-memory graph check. */
export function validatePanoramaEngine(engine: PanoramaEngine): PanoramaValidationReport {
  const issues: PanoramaValidationIssue[] = [];
  const seenSceneIds = new Set<string>();
  let nodesChecked = 0;

  for (const floorName of engine.listFloorNames()) {
    const list = engine.getFloor(floorName);
    if (!list) continue;

    const nodes = list.toArray();
    nodesChecked += nodes.length;

    // Broken chain: forward walk must visit exactly `size` nodes and land on tail.
    if (nodes.length !== list.size || nodes[nodes.length - 1] !== list.tail) {
      issues.push({
        code: "broken_chain",
        message: `Floor "${floorName}": forward traversal (${nodes.length} nodes) did not match list size (${list.size}) or reach the tail.`,
        floor: floorName,
      });
    }

    // Symmetric backward walk from tail must reach head — bounded at
    // list.head for the same reason toArray() bounds at list.tail: a
    // staircase connection means .previous can now reach into the
    // preceding floor, which must not be counted as part of this one.
    const backward: typeof nodes = [];
    let cursor = list.tail;
    while (cursor) {
      backward.push(cursor);
      if (cursor === list.head) break;
      cursor = cursor.previous?.node ?? null;
    }
    if (backward.length !== nodes.length || backward[backward.length - 1] !== list.head) {
      issues.push({
        code: "broken_chain",
        message: `Floor "${floorName}": backward traversal did not mirror the forward chain.`,
        floor: floorName,
      });
    }

    nodes.forEach((node, index) => {
      if (seenSceneIds.has(node.sceneId)) {
        issues.push({
          code: "duplicate_scene_id",
          message: `Scene ID "${node.sceneId}" appears more than once across the engine.`,
          sceneId: node.sceneId,
          floor: floorName,
        });
      }
      seenSceneIds.add(node.sceneId);

      const isFirst = index === 0;
      const isLast = index === nodes.length - 1;

      if (!isFirst && !node.previous) {
        issues.push({
          code: "missing_previous",
          message: `Scene "${node.sceneId}" is missing its previous-scene link.`,
          sceneId: node.sceneId,
          floor: floorName,
        });
      }
      if (!isLast && !node.next) {
        issues.push({
          code: "missing_next",
          message: `Scene "${node.sceneId}" is missing its next-scene link.`,
          sceneId: node.sceneId,
          floor: floorName,
        });
      }
      if (isFirst && isLast && nodes.length > 1) {
        issues.push({
          code: "orphan_node",
          message: `Scene "${node.sceneId}" is disconnected from the rest of floor "${floorName}".`,
          sceneId: node.sceneId,
          floor: floorName,
        });
      }

      const orientationValid =
        Number.isFinite(node.yaw) && Number.isFinite(node.pitch) && Number.isFinite(node.hfov);
      if (!orientationValid) {
        issues.push({
          code: "missing_orientation",
          message: `Scene "${node.sceneId}" has an invalid/missing yaw, pitch, or hfov.`,
          sceneId: node.sceneId,
          floor: floorName,
        });
      }
    });
  }

  return {
    valid: issues.length === 0,
    floorsChecked: engine.listFloorNames().length,
    nodesChecked,
    issues,
  };
}
