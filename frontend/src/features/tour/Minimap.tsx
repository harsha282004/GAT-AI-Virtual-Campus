"use client";

import { Compass, Navigation } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";

import { useEdges, useNodes } from "@/hooks";
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

const VIEWBOX_WIDTH = 280;
const VIEWBOX_HEIGHT = 150;

// Floor name used elsewhere in this codebase (TourSidebar/FloorSelector's
// FLOOR_ORDER) as the literal string marking the outdoor gate walkway,
// distinct from every floor inside Main Building.
const ENTRANCE_FLOOR = "Entrance";

interface Zone {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SpatialPoint {
  scene: TourPanorama;
  cx: number;
  cy: number;
}

// Compact schematic "gate on one side, building on the other" frame — not
// derived from any real survey (no coordinate ties the outdoor Entrance
// walkway to Main Building's interior yet), purely a fixed orientation
// backdrop matching the requested visual design. Every REAL data point
// (per-floor node positions + edges from useNodes/useEdges, exactly as
// before) is projected INTO whichever zone's plot area is active below —
// nothing about the actual route itself is fabricated, only this framing
// is decorative. Sized generously (not a small corner icon) because the
// real Entrance floor here is a full ~20-scene outdoor walkway, not a
// single gate scene, and needs room to render legibly.
const ZONE_TOP = 18;
const ZONE_HEIGHT = 108;
const LABEL_ROW_HEIGHT = 20;

const ENTRANCE_ZONE: Zone = { x: 14, y: ZONE_TOP, width: 118, height: ZONE_HEIGHT };
const BUILDING_ZONE: Zone = { x: 148, y: ZONE_TOP, width: 118, height: ZONE_HEIGHT };

// The sub-region of each zone actual scene points are projected into —
// offset below the zone's own label row so plotted dots/lines never
// render underneath the "Entrance" / building-name text.
const ENTRANCE_PLOT: Zone = {
  x: ENTRANCE_ZONE.x,
  y: ENTRANCE_ZONE.y + LABEL_ROW_HEIGHT,
  width: ENTRANCE_ZONE.width,
  height: ENTRANCE_ZONE.height - LABEL_ROW_HEIGHT,
};
const BUILDING_PLOT: Zone = {
  x: BUILDING_ZONE.x,
  y: BUILDING_ZONE.y + LABEL_ROW_HEIGHT,
  width: BUILDING_ZONE.width,
  height: BUILDING_ZONE.height - LABEL_ROW_HEIGHT,
};

// Light-blue navigation theme on a white card — matches the rest of the
// Virtual Tour's clean card styling instead of a standalone dark widget.
// Structural chrome (zone frames/labels/gate glyph) reuses the site's own
// brand blue (#2344D4, see tailwind.config.ts) so the mini-map still reads
// as part of the same GAT UI rather than introducing new colors.
const TEXT_PRIMARY = "#16213E"; // site `ink` token
const TEXT_SECONDARY = "#5D6E84"; // site `muted` token
const BORDER_SUBTLE = "#E7EEF8"; // site `hairline` token
const BRAND = "#2344D4"; // site `brand` token

const ROUTE_BRIGHT = "#60A5FA";
const ROUTE_DIM = "rgba(96, 165, 250, 0.28)";
const MARKER_FILL = "#3B82F6";
const MARKER_RING = "rgba(59, 130, 246, 0.30)";

/** Scales a set of real local-plane points (Node.pos_x/pos_y) to fit
 * inside a target zone, preserving relative layout — the same
 * fit-to-bounds approach the previous full-viewport version used, just
 * parameterized to a sub-region so the real route can be drawn inside the
 * Entrance or Main Building schematic shape instead of the whole canvas. */
function projectIntoZone(
  points: { scene: TourPanorama; x: number; y: number }[],
  zone: Zone,
  padding: number,
): SpatialPoint[] {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(maxX - minX, 1);
  const spanY = Math.max(maxY - minY, 1);
  const innerWidth = zone.width - padding * 2;
  const innerHeight = zone.height - padding * 2;
  const scale = Math.min(innerWidth / spanX, innerHeight / spanY);
  const drawnWidth = spanX * scale;
  const drawnHeight = spanY * scale;
  const offsetX = zone.x + padding + (innerWidth - drawnWidth) / 2;
  const offsetY = zone.y + padding + (innerHeight - drawnHeight) / 2;
  return points.map(({ scene, x, y }) => ({
    scene,
    cx: offsetX + (x - minX) * scale,
    cy: offsetY + (y - minY) * scale,
  }));
}

/**
 * Campus navigation mini-map — plots the current floor's walking sequence
 * at each scene's real Node.pos_x/pos_y (same local-plane coordinates
 * campusLayout.ts uses for the map view) and the real Edge connections
 * between them. Those real points are drawn inside a white-card Entrance/
 * Main-Building schematic frame (not the whole canvas), with a light-blue
 * route and marker so it reads as part of the same Virtual Tour UI rather
 * than a separate widget.
 *
 * Falls back to an evenly-spaced strip (still drawn inside the active
 * zone) when fewer than two of the current floor's scenes have a real
 * position — never invents a coordinate.
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

  const isEntranceFloor = current.floor === ENTRANCE_FLOOR;
  const activePlot: Zone = isEntranceFloor ? ENTRANCE_PLOT : BUILDING_PLOT;

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
    return projectIntoZone(spatialScenes, activePlot, 6);
  }, [spatialScenes, hasSpatialLayout, activePlot]);

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

  // Evenly-spaced fallback — only reached when this floor has fewer than
  // two real-positioned scenes. Still drawn inside the active zone's plot
  // area so the user marker always sits somewhere meaningful rather than
  // a generic centered dot.
  const fallbackPoints: SpatialPoint[] = useMemo(() => {
    if (hasSpatialLayout || floorScenes.length === 0) return [];
    const centerY = activePlot.y + activePlot.height / 2;
    if (floorScenes.length === 1) {
      return [{ scene: floorScenes[0], cx: activePlot.x + activePlot.width / 2, cy: centerY }];
    }
    const innerX = activePlot.x + 10;
    const innerWidth = activePlot.width - 20;
    return floorScenes.map((scene, index) => ({
      scene,
      cx: innerX + (innerWidth * index) / (floorScenes.length - 1),
      cy: centerY,
    }));
  }, [hasSpatialLayout, floorScenes, activePlot]);

  const activePoints = hasSpatialLayout ? projected : fallbackPoints;

  // Bright once the user has actually crossed from the gate into the
  // building at any point this session (or is inside it right now) —
  // a real, data-derived signal (visitedIds/current.floor), not decoration.
  const hasEnteredBuilding =
    !isEntranceFloor || panoramas.some((p) => p.floor !== ENTRANCE_FLOOR && visitedIds.has(p.id));

  const locationLabel = [current.building, current.floor].filter(Boolean).join(" · ");
  const buildingLabel = (current.building || "Main Building").toUpperCase();

  return (
    <div
      className="flex w-[210px] flex-col gap-2 overflow-hidden rounded-3xl border bg-white p-3 shadow-soft sm:w-[260px] sm:p-4 lg:w-[300px]"
      style={{ borderColor: BORDER_SUBTLE }}
    >
      <div className="flex items-center justify-between gap-1.5 text-xs font-medium" style={{ color: TEXT_PRIMARY }}>
        <span className="flex min-w-0 items-center gap-1.5">
          <Compass className="h-3.5 w-3.5 shrink-0 text-brand" />
          <span className="truncate">{locationLabel}</span>
        </span>
        {/* Live heading needle — rotated directly via rAF above, not React state. */}
        <div
          ref={needleRef}
          aria-hidden="true"
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand/10"
          style={{ transition: "none" }}
        >
          <Navigation className="h-3 w-3 text-brand" strokeWidth={2.5} />
        </div>
      </div>

      <svg
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        className="h-28 w-full sm:h-32 lg:h-36"
        role="img"
        aria-label={`Campus map of ${locationLabel}, showing your current position and route`}
      >
        <defs>
          <filter id="minimap-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="1.6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Entrance zone frame + label */}
        <g aria-hidden="true">
          <rect
            x={ENTRANCE_ZONE.x}
            y={ENTRANCE_ZONE.y}
            width={ENTRANCE_ZONE.width}
            height={ENTRANCE_ZONE.height}
            rx={10}
            fill="rgba(35,68,212,0.035)"
            stroke="rgba(35,68,212,0.22)"
            strokeWidth={1.25}
            strokeDasharray="4 3"
          />
          <text
            x={ENTRANCE_ZONE.x + 10}
            y={ENTRANCE_ZONE.y + 14}
            fontSize={9}
            fontWeight={600}
            letterSpacing="0.04em"
            fill={TEXT_SECONDARY}
          >
            ENTRANCE
          </text>

          {/* Simple gate glyph — a small, fixed anchor near the zone's
              left edge; real plotted scenes (spatial or fallback) render
              to its right, reading naturally as "start at the gate". */}
          <g transform={`translate(${ENTRANCE_PLOT.x + 10}, ${ENTRANCE_PLOT.y + ENTRANCE_PLOT.height / 2})`} opacity={0.75}>
            <line x1={-6} y1={-7} x2={-6} y2={7} stroke={BRAND} strokeWidth={2} strokeLinecap="round" />
            <line x1={6} y1={-7} x2={6} y2={7} stroke={BRAND} strokeWidth={2} strokeLinecap="round" />
            <line x1={-8} y1={-7} x2={8} y2={-7} stroke={BRAND} strokeWidth={2} strokeLinecap="round" />
          </g>
        </g>

        {/* Main Building footprint + label */}
        <g aria-hidden="true">
          <rect
            x={BUILDING_ZONE.x}
            y={BUILDING_ZONE.y}
            width={BUILDING_ZONE.width}
            height={BUILDING_ZONE.height}
            rx={10}
            fill="rgba(35,68,212,0.06)"
            stroke="rgba(35,68,212,0.3)"
            strokeWidth={1.25}
          />
          <text
            x={BUILDING_ZONE.x + BUILDING_ZONE.width / 2}
            y={BUILDING_ZONE.y + 14}
            textAnchor="middle"
            fontSize={9}
            fontWeight={700}
            letterSpacing="0.04em"
            fill={TEXT_PRIMARY}
          >
            {buildingLabel}
          </text>
        </g>

        {/* Static Entrance <-> Building orientation guide */}
        <line
          x1={ENTRANCE_ZONE.x + ENTRANCE_ZONE.width}
          y1={ENTRANCE_ZONE.y + ENTRANCE_ZONE.height / 2}
          x2={BUILDING_ZONE.x}
          y2={BUILDING_ZONE.y + BUILDING_ZONE.height / 2}
          stroke={hasEnteredBuilding ? ROUTE_BRIGHT : ROUTE_DIM}
          strokeWidth={hasEnteredBuilding ? 2 : 1.5}
          strokeDasharray="3 4"
          strokeLinecap="round"
        />

        {/* Real per-floor route (spatial mode) */}
        {pathSegments.map((segment) => (
          <line
            key={segment.key}
            x1={segment.x1}
            y1={segment.y1}
            x2={segment.x2}
            y2={segment.y2}
            stroke={segment.walked ? ROUTE_BRIGHT : ROUTE_DIM}
            strokeWidth={segment.walked ? 2.5 : 1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            filter={segment.walked ? "url(#minimap-glow)" : undefined}
          />
        ))}

        {/* Fallback strip connecting line */}
        {!hasSpatialLayout && fallbackPoints.length > 1 && (
          <>
            <line
              x1={fallbackPoints[0].cx}
              y1={fallbackPoints[0].cy}
              x2={fallbackPoints[fallbackPoints.length - 1].cx}
              y2={fallbackPoints[fallbackPoints.length - 1].cy}
              stroke={ROUTE_DIM}
              strokeWidth={1.5}
              strokeLinecap="round"
            />
            {currentIndex > 0 && (
              <line
                x1={fallbackPoints[0].cx}
                y1={fallbackPoints[0].cy}
                x2={fallbackPoints[currentIndex].cx}
                y2={fallbackPoints[currentIndex].cy}
                stroke={ROUTE_BRIGHT}
                strokeWidth={2.5}
                strokeLinecap="round"
                filter="url(#minimap-glow)"
              />
            )}
          </>
        )}

        {/* Scene markers — current user location is the bright, pulsing one */}
        {activePoints.map(({ scene, cx, cy }) => {
          const active = scene.id === current.id;
          const visited = visitedIds.has(scene.id);
          return (
            <g
              key={scene.id}
              role="button"
              tabIndex={0}
              aria-label={`${scene.name}${active ? " (you are here)" : visited ? " (visited)" : ""}`}
              className="cursor-pointer focus:outline-none"
              onClick={() => onSelect(scene.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(scene.id);
                }
              }}
            >
              {active && (
                <circle cx={cx} cy={cy} r={7} fill={MARKER_RING}>
                  <animate attributeName="r" values="7;13;7" dur="2.2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.5;0.08;0.5" dur="2.2s" repeatCount="indefinite" />
                </circle>
              )}
              <circle
                cx={cx}
                cy={cy}
                r={active ? 6 : 3}
                fill={active ? MARKER_FILL : visited ? "rgba(59,130,246,0.5)" : "#ffffff"}
                stroke={active ? "#ffffff" : visited ? ROUTE_BRIGHT : "rgba(59,130,246,0.45)"}
                strokeWidth={active ? 2 : 1.1}
                filter={active ? "url(#minimap-glow)" : undefined}
              >
                <title>{scene.name}</title>
              </circle>
              {active && <circle cx={cx} cy={cy} r={2} fill="#ffffff" />}
            </g>
          );
        })}
      </svg>

      <p className="text-[10px] font-medium" style={{ color: TEXT_SECONDARY }}>
        {currentIndex >= 0 ? `Step ${currentIndex + 1} of ${floorScenes.length}` : current.name}
      </p>
    </div>
  );
}
