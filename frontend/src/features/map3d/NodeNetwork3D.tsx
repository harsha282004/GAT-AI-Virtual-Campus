"use client";

import { Line } from "@react-three/drei";
import { useMemo } from "react";

import type { CampusEdge, CampusNode } from "@/types";

interface NodeNetwork3DProps {
  nodes: CampusNode[];
  edges: CampusEdge[];
}

const NODE_COLOR = "#D4A537"; // accent.gold — distinct from BuildingMesh's blue palette
const EDGE_COLOR = "#8FA6D9";
const NODE_HEIGHT = 0.4; // just above the ground plane/grid, avoids z-fighting
const NODE_RADIUS = 0.9;

/**
 * Phase 16 follow-up — renders the real OUTDOOR campus navigation graph
 * (Node.pos_x/pos_y + Edge connections, the SAME local plane
 * campusLayout.ts already uses for building placement) as small points +
 * connecting lines, so the 3D scene shows an actual connected campus
 * network instead of isolated building boxes.
 *
 * Restricted to nodes with floor_id === null (outdoor/campus-level nodes)
 * — verified live that indoor nodes (a building's own floor-by-floor
 * corridor walk, e.g. Main Building's 76-node tour sequence) use their
 * OWN independent local pos_x/pos_y sequence that happens to start at the
 * same (0,0) origin as the outdoor graph by seeding convention, not
 * because they share one true campus-global coordinate frame. Plotting
 * both together would visually imply a spatial relationship between
 * indoor corridor nodes and the outdoor building layout that the data
 * doesn't actually support — the same kind of fabricated-relationship
 * mistake Phase 17 deliberately avoided for buildings. Indoor sequences
 * are represented separately, correctly floor-scoped, in the Virtual
 * Tour's own Minimap instead.
 *
 * Only nodes with a real, non-null pos_x/pos_y are plotted; an edge is
 * drawn only when BOTH endpoints have one — never an invented position.
 */
export function NodeNetwork3D({ nodes, edges }: NodeNetwork3DProps) {
  const positionedNodes = useMemo(
    () => nodes.filter((n) => n.pos_x !== null && n.pos_y !== null && n.floor_id === null),
    [nodes],
  );

  const positionsById = useMemo(() => {
    const map = new Map<number, [number, number, number]>();
    for (const node of positionedNodes) {
      map.set(node.id, [node.pos_x as number, NODE_HEIGHT, node.pos_y as number]);
    }
    return map;
  }, [positionedNodes]);

  const edgeSegments = useMemo(() => {
    const segments: { key: string; points: [number, number, number][] }[] = [];
    const seen = new Set<string>();
    for (const edge of edges) {
      const from = positionsById.get(edge.source_node_id);
      const to = positionsById.get(edge.target_node_id);
      if (!from || !to) continue;
      // Bidirectional edges appear once per direction in the data — a
      // single drawn segment already represents both, so dedupe by the
      // unordered node pair.
      const key = [edge.source_node_id, edge.target_node_id].sort((a, b) => a - b).join("-");
      if (seen.has(key)) continue;
      seen.add(key);
      segments.push({ key, points: [from, to] });
    }
    return segments;
  }, [edges, positionsById]);

  return (
    <group>
      {edgeSegments.map((segment) => (
        <Line
          key={segment.key}
          points={segment.points}
          color={EDGE_COLOR}
          lineWidth={1.25}
          transparent
          opacity={0.55}
        />
      ))}
      {positionedNodes.map((node) => (
        <mesh key={node.id} position={positionsById.get(node.id)}>
          <sphereGeometry args={[NODE_RADIUS, 12, 12]} />
          <meshStandardMaterial color={NODE_COLOR} roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}
