"use client";

import { Compass, Navigation } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";

import { useEdges, useNodes } from "@/hooks";
import { cn } from "@/utils";
import type { TourPanorama } from "@/types";

interface MinimapProps {
  panoramas: TourPanorama[];
  current: TourPanorama;
  visitedIds: ReadonlySet<string>;
  onSelect: (id: string) => void;
  /** Reads the live camera yaw straight from the panorama viewer, once per
   * animation frame — deliberately not a React prop value, so the heading
   * needle can rotate smoothly without re-rendering the whole minimap (or
   * the page) 60 times a second. */
  getLiveYaw: () => number | null;
}

const VIEWBOX_WIDTH = 220;
const VIEWBOX_HEIGHT = 120;
const PADDING = 16;

interface SpatialPoint {
  scene: TourPanorama;
  cx: number;
  cy: number;
}

/**
 * Real spatial minimap of the current floor's walking sequence — plots
 * each scene at its actual Node.pos_x/pos_y (the same real local-plane
 * coordinates campusLayout.ts already uses for the 3D map's building
 * placement; Main Building's walkthrough sequence has one for every scene,
 * seeded as real cumulative walking distance, not an arbitrary index) and
 * draws the real Edge connections between them, so a user can see their
 * actual position and path through the building rather than an arbitrary
 * evenly-spaced strip.
 *
 * Falls back to the original evenly-spaced schematic strip when fewer than
 * two of the current floor's scenes have a real position — this only
 * happens if a future building's tour data doesn't carry Node.pos_x/pos_y
 * the way Main Building's does. Never invents a coordinate: a node
 * without real pos_x/pos_y simply isn't plotted on the spatial map.
 */
export function Minimap({ panoramas, current, visitedIds, onSelect, getLiveYaw }: MinimapProps) {
  const needleRef = useRef<HTMLDivElement | null>(null);
  const nodesQuery = useNodes();
  const edgesQuery = useEdges();

  useEffect(() => {
    let frameId: number;
    function tick() {
      const yaw = getLiveYaw();
      if (needleRef.current && yaw !== null) {
        needleRef.current.style.transform = `rotate(${yaw}deg)`;
      }
      frameId = requestAnimationFrame(tick);
    }
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [getLiveYaw]);

  const floorScenes = panoramas
    .filter((p) => p.floor === current.floor)
    .sort((a, b) => (a.sequenceIndex ?? 0) - (b.sequenceIndex ?? 0));

  const currentIndex = floorScenes.findIndex((p) => p.id === current.id);

  const positionByNodeId = useMemo(() => {
    const map = new Map<number, { x: number; y: number }>();
    for (const node of nodesQuery.data ?? []) {
      if (node.pos_x !== null && node.pos_y !== null) {
        map.set(node.id, { x: node.pos_x, y: node.pos_y });
      }
    }
    return map;
  }, [nodesQuery.data]);

  const spatialScenes = useMemo(() => {
    const withPositions: { scene: TourPanorama; x: number; y: number }[] = [];
    for (const scene of floorScenes) {
      const pos = positionByNodeId.get(Number(scene.id));
      if (pos) withPositions.push({ scene, x: pos.x, y: pos.y });
    }
    return withPositions;
  }, [floorScenes, positionByNodeId]);

  const hasSpatialLayout = spatialScenes.length >= 2;

  const projected: SpatialPoint[] = useMemo(() => {
    if (!hasSpatialLayout) return [];
    const xs = spatialScenes.map((s) => s.x);
    const ys = spatialScenes.map((s) => s.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const spanX = Math.max(maxX - minX, 1);
    const spanY = Math.max(maxY - minY, 1);
    const scale = Math.min(
      (VIEWBOX_WIDTH - PADDING * 2) / spanX,
      (VIEWBOX_HEIGHT - PADDING * 2) / spanY,
    );
    const drawnWidth = spanX * scale;
    const drawnHeight = spanY * scale;
    const offsetX = (VIEWBOX_WIDTH - drawnWidth) / 2;
    const offsetY = (VIEWBOX_HEIGHT - drawnHeight) / 2;
    return spatialScenes.map(({ scene, x, y }) => ({
      scene,
      cx: offsetX + (x - minX) * scale,
      cy: offsetY + (y - minY) * scale,
    }));
  }, [spatialScenes, hasSpatialLayout]);

  const projectedById = useMemo(() => {
    const map = new Map<string, SpatialPoint>();
    for (const point of projected) map.set(point.scene.id, point);
    return map;
  }, [projected]);

  const pathSegments = useMemo(() => {
    if (!hasSpatialLayout) return [];
    const segments: { key: string; x1: number; y1: number; x2: number; y2: number; walked: boolean }[] =
      [];
    const seen = new Set<string>();
    for (const edge of edgesQuery.data ?? []) {
      const from = projectedById.get(String(edge.source_node_id));
      const to = projectedById.get(String(edge.target_node_id));
      if (!from || !to) continue;
      const key = [edge.source_node_id, edge.target_node_id].sort((a, b) => a - b).join("-");
      if (seen.has(key)) continue;
      seen.add(key);
      const walked =
        visitedIds.has(String(edge.source_node_id)) && visitedIds.has(String(edge.target_node_id));
      segments.push({ key, x1: from.cx, y1: from.cy, x2: to.cx, y2: to.cy, walked });
    }
    return segments;
  }, [edgesQuery.data, projectedById, visitedIds, hasSpatialLayout]);

  return (
    <div className="glass flex w-full flex-col gap-2 rounded-3xl p-4 shadow-soft lg:w-64">
      <div className="flex items-center justify-between gap-1.5 text-xs font-medium text-ink/70">
        <span className="flex items-center gap-1.5">
          <Compass className="h-3.5 w-3.5 text-brand/60" />
          {current.floor}
        </span>
        {/* Live heading needle — rotated directly via rAF above, not React state. */}
        <div
          ref={needleRef}
          aria-hidden="true"
          className="flex h-5 w-5 items-center justify-center rounded-full bg-brand/10"
          style={{ transition: "none" }}
        >
          <Navigation className="h-3 w-3 text-brand" strokeWidth={2.5} />
        </div>
      </div>

      {hasSpatialLayout ? (
        <svg
          viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
          className="h-28 w-full"
          role="img"
          aria-label={`Map of ${current.floor}, showing your current position and route`}
        >
          {pathSegments.map((segment) => (
            <line
              key={segment.key}
              x1={segment.x1}
              y1={segment.y1}
              x2={segment.x2}
              y2={segment.y2}
              stroke={segment.walked ? "#2E4DB7" : "#A9BEE8"}
              strokeWidth={segment.walked ? 2 : 1.5}
              strokeLinecap="round"
            />
          ))}
          {projected.map(({ scene, cx, cy }) => {
            const active = scene.id === current.id;
            const visited = visitedIds.has(scene.id);
            return (
              <g
                key={scene.id}
                role="button"
                tabIndex={0}
                aria-label={`${scene.name}${visited ? " (visited)" : ""}`}
                className="cursor-pointer focus:outline-none"
                onClick={() => onSelect(scene.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(scene.id);
                  }
                }}
              >
                {active && <circle cx={cx} cy={cy} r={9} fill="rgba(46,77,183,0.2)" />}
                <circle
                  cx={cx}
                  cy={cy}
                  r={active ? 5 : 3.5}
                  fill={active ? "#2E4DB7" : visited ? "rgba(46,77,183,0.45)" : "#ffffff"}
                  stroke={active || visited ? "#2E4DB7" : "rgba(46,77,183,0.4)"}
                  strokeWidth={1.5}
                >
                  <title>{scene.name}</title>
                </circle>
              </g>
            );
          })}
        </svg>
      ) : floorScenes.length > 1 ? (
        <div className="relative flex h-9 items-center">
          <div className="absolute inset-x-1 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-brand/15" />
          <div className="relative flex w-full items-center justify-between">
            {floorScenes.map((scene) => {
              const active = scene.id === current.id;
              const visited = visitedIds.has(scene.id);
              return (
                <button
                  key={scene.id}
                  type="button"
                  title={scene.name}
                  aria-current={active}
                  aria-label={`${scene.name}${visited ? " (visited)" : ""}`}
                  onClick={() => onSelect(scene.id)}
                  className={cn(
                    "relative flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                    active
                      ? "scale-125 border-brand bg-brand shadow-[0_0_0_4px_rgba(46,77,183,0.2)]"
                      : visited
                        ? "border-brand/60 bg-brand/30 hover:border-brand"
                        : "border-brand/30 bg-white hover:border-brand/70 dark:bg-[#0F172A]",
                  )}
                >
                  {active && (
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand/50" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-muted">Single scene on this floor.</p>
      )}

      {/* Hotspot direction ticks — only shown alongside the schematic
          fallback strip; the spatial map above already conveys direction
          via real edge lines, so repeating it here would be redundant. */}
      {!hasSpatialLayout && current.hotspots.length > 0 && (
        <div className="relative mx-auto my-1 h-16 w-16">
          <div className="absolute inset-0 rounded-full border border-brand/15" />
          <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand" />
          {current.hotspots.map((hotspot, index) => (
            <div
              key={`${hotspot.targetId}-${index}`}
              title={hotspot.label}
              className="absolute left-1/2 top-1/2 h-16 w-0.5 origin-top"
              style={{ transform: `translateX(-50%) rotate(${hotspot.yaw}deg)` }}
            >
              <span className="absolute -top-0.5 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-brand/70" />
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] text-muted">
        {currentIndex >= 0 ? `Step ${currentIndex + 1} of ${floorScenes.length}` : current.name}
      </p>
    </div>
  );
}
