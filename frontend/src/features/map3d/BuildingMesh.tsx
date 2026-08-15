"use client";

import { Html } from "@react-three/drei";
import { useState } from "react";
import type { ThreeEvent } from "@react-three/fiber";

import type { BuildingPlacement } from "./campusLayout";

const BASE_COLOR = "#2344D4"; // brand.DEFAULT (frontend/tailwind.config.ts)
const HOVER_COLOR = "#3D5FE0";
const SELECTED_COLOR = "#D4A537"; // accent.gold — visually distinct from every hover/base state

interface BuildingMeshProps {
  placement: BuildingPlacement;
  isSelected: boolean;
  onSelect: (buildingId: number) => void;
}

/** One campus building as a simple extruded box (see campusLayout.ts for
 * why box geometry — no footprint/height data exists to justify anything
 * more elaborate yet). Hover and click are R3F's own built-in pointer
 * events, not manual raycasting. */
export function BuildingMesh({ placement, isSelected, onSelect }: BuildingMeshProps) {
  const [hovered, setHovered] = useState(false);
  const { building, x, z, width, depth, height } = placement;

  const color = isSelected ? SELECTED_COLOR : hovered ? HOVER_COLOR : BASE_COLOR;

  function handlePointerOver(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation();
    setHovered(true);
    document.body.style.cursor = "pointer";
  }

  function handlePointerOut(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation();
    setHovered(false);
    document.body.style.cursor = "auto";
  }

  function handleClick(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation();
    onSelect(building.id);
  }

  return (
    <group position={[x, 0, z]}>
      <mesh
        position={[0, height / 2, 0]}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
      >
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color={color} roughness={0.6} metalness={0.05} />
      </mesh>

      {/* A thin outline at the base makes the selected/hovered building
          readable even from a top-down angle, not just via the fill color. */}
      {(isSelected || hovered) && (
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[Math.max(width, depth) * 0.62, Math.max(width, depth) * 0.68, 32]} />
          <meshBasicMaterial color={isSelected ? SELECTED_COLOR : HOVER_COLOR} />
        </mesh>
      )}

      {/* Always visible (not just hover/select) so every building is
          identifiable at a glance — hover/select still get the richer,
          higher-contrast treatment via the conditional classes below. */}
      <Html position={[0, height + 2.5, 0]} center distanceFactor={60} occlude={false}>
        <div
          className={`pointer-events-none rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap shadow-lg transition-colors ${
            hovered || isSelected ? "bg-slate-900/90 text-white" : "bg-white/85 text-slate-800"
          }`}
        >
          {building.name}
          {building.code && (
            <span className={hovered || isSelected ? "ml-1 text-white/60" : "ml-1 text-slate-500"}>
              ({building.code})
            </span>
          )}
        </div>
      </Html>
    </group>
  );
}
