import type { Building, CampusNode, Floor } from "@/types";

/**
 * Phase 16 — derives a 3D placement for each real campus Building from
 * already-existing, verified project data (backend/app/models/node.py's
 * pos_x/pos_y, backend/app/models/floor.py's per-building floor rows) —
 * never invents a building position, footprint, or height.
 *
 * The Building model itself (backend/app/models/building.py) has no
 * position/footprint/height columns at all — only Node carries pos_x/
 * pos_y, and only for nodes that were actually seeded with them. So:
 *
 * - Position: the associated "entrance"-type Node's (pos_x, pos_y) when
 *   one exists (the canonical "front door" position for that building);
 *   otherwise the first positioned node belonging to that building;
 *   otherwise a clearly-flagged (`isPositionVerified: false`) grid
 *   fallback slot, never a guessed coordinate.
 * - Height: derived from the REAL number of Floor rows recorded for that
 *   building (a verified fact) multiplied by a single documented
 *   placeholder storey height — not an invented per-building value. A
 *   building with zero recorded floors still renders as one storey so it
 *   remains visible, not a fabricated floor count.
 * - Footprint (width/depth): no footprint data exists anywhere in the
 *   project for any building, so every building uses the same single,
 *   clearly-documented placeholder square footprint — deliberately
 *   uniform, so it never implies a real per-building size difference
 *   that doesn't exist in the data.
 */

export interface BuildingPlacement {
  building: Building;
  /** Local campus-plane X coordinate, in meters — same unit/origin as
   * backend/app/models/node.py's pos_x (see scripts/db/seed.py). */
  x: number;
  /** Local campus-plane Z coordinate (3D "depth" axis), sourced from the
   * node's pos_y. */
  z: number;
  width: number;
  depth: number;
  height: number;
  /** Real Floor row count for this building (0 if none recorded). */
  floorCount: number;
  /** False when no positioned Node exists for this building at all, and
   * a grid fallback slot was used instead of a real coordinate. */
  isPositionVerified: boolean;
}

// No real footprint data exists anywhere in this project for any
// building — see this module's docstring. A single shared placeholder
// keeps that honestly visible (every building the same size) rather than
// implying invented per-building variation.
export const PLACEHOLDER_FOOTPRINT_M = 14;

// A typical storey height, used ONLY to convert a real, verified floor
// COUNT into a height — never a substitute for real height data.
export const FLOOR_HEIGHT_M = 3.5;

const FALLBACK_GRID_SPACING_M = 45;
const FALLBACK_GRID_COLUMNS = 3;
const FALLBACK_GRID_Z_OFFSET_M = 80;

function fallbackGridPosition(index: number): [number, number] {
  const x = (index % FALLBACK_GRID_COLUMNS) * FALLBACK_GRID_SPACING_M;
  const z = Math.floor(index / FALLBACK_GRID_COLUMNS) * FALLBACK_GRID_SPACING_M + FALLBACK_GRID_Z_OFFSET_M;
  return [x, z];
}

export function deriveBuildingPlacements(
  buildings: Building[],
  nodes: CampusNode[],
  floors: Floor[],
): BuildingPlacement[] {
  return buildings.map((building, index) => {
    const buildingNodes = nodes.filter(
      (n) => n.building_id === building.id && n.pos_x !== null && n.pos_y !== null,
    );
    const anchor = buildingNodes.find((n) => n.node_type === "entrance") ?? buildingNodes[0];

    const isPositionVerified = Boolean(anchor);
    const [x, z] = anchor
      ? [anchor.pos_x as number, anchor.pos_y as number]
      : fallbackGridPosition(index);

    const floorCount = floors.filter((f) => f.building_id === building.id).length;
    const height = Math.max(floorCount, 1) * FLOOR_HEIGHT_M;

    return {
      building,
      x,
      z,
      width: PLACEHOLDER_FOOTPRINT_M,
      depth: PLACEHOLDER_FOOTPRINT_M,
      height,
      floorCount,
      isPositionVerified,
    };
  });
}
