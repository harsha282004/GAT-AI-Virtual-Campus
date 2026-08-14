"use client";

import { Grid, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  type ComponentRef,
} from "react";

import { BuildingMesh } from "./BuildingMesh";
import type { BuildingPlacement } from "./campusLayout";

export interface CampusSceneHandle {
  resetView: () => void;
  /** Moves the camera to a fixed offset from the given building's real
   * (or grid-fallback) ground position and re-targets the orbit controls
   * at it — used by the search UI's "locate" action. */
  focusBuilding: (placement: BuildingPlacement) => void;
}

interface CampusScene3DProps {
  placements: BuildingPlacement[];
  selectedBuildingId: number | null;
  onSelectBuilding: (buildingId: number) => void;
}

/** Bounding circle (center + radius) around every building's ground
 * position — used only to pick a sensible default/reset camera framing
 * that keeps the whole campus visible (Section 15's "never start with an
 * empty scene / tiny model far away" requirement), never to place a
 * building itself. */
function sceneBounds(placements: BuildingPlacement[]) {
  if (placements.length === 0) {
    return { centerX: 0, centerZ: 0, radius: 60 };
  }
  const xs = placements.map((p) => p.x);
  const zs = placements.map((p) => p.z);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const radius = Math.max(maxX - minX, maxZ - minZ, 60) / 2 + 30;
  return { centerX, centerZ, radius };
}

/** The actual interactive 3D scene — ground, lighting, one box per real
 * campus building (see campusLayout.ts), and orbit camera controls. No
 * shadows/post-processing — deliberately kept cheap; see
 * docs/phase16_3d_campus_map.md's performance section. */
export const CampusScene3D = forwardRef<CampusSceneHandle, CampusScene3DProps>(
  function CampusScene3D({ placements, selectedBuildingId, onSelectBuilding }, ref) {
    const controlsRef = useRef<ComponentRef<typeof OrbitControls>>(null);
    const { centerX, centerZ, radius } = useMemo(() => sceneBounds(placements), [placements]);

    const defaultCameraPosition: [number, number, number] = [
      centerX + radius * 0.9,
      radius * 0.9,
      centerZ + radius * 0.9,
    ];
    const defaultTarget: [number, number, number] = [centerX, 0, centerZ];

    useImperativeHandle(
      ref,
      () => ({
        resetView: () => {
          const controls = controlsRef.current;
          if (!controls) return;
          controls.object.position.set(...defaultCameraPosition);
          controls.target.set(...defaultTarget);
          controls.update();
        },
        focusBuilding: (placement) => {
          const controls = controlsRef.current;
          if (!controls) return;
          const focusDistance = Math.max(placement.width, placement.depth) * 2.2 + 15;
          controls.object.position.set(
            placement.x + focusDistance * 0.7,
            placement.height + focusDistance * 0.6,
            placement.z + focusDistance * 0.7,
          );
          controls.target.set(placement.x, placement.height / 2, placement.z);
          controls.update();
        },
      }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [centerX, centerZ, radius],
    );

    return (
      <Canvas
        camera={{ position: defaultCameraPosition, fov: 50, near: 0.1, far: 2000 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true }}
      >
        <color attach="background" args={["#CFE3FF"]} />
        <hemisphereLight args={["#ffffff", "#4b6b8c", 0.9]} />
        <directionalLight position={[80, 120, 40]} intensity={1.1} />

        <Grid
          position={[centerX, 0, centerZ]}
          args={[radius * 3, radius * 3]}
          cellSize={5}
          cellThickness={0.5}
          cellColor="#9CB4E0"
          sectionSize={25}
          sectionThickness={1}
          sectionColor="#6B8FD6"
          fadeDistance={radius * 3}
          infiniteGrid={false}
        />

        <mesh position={[centerX, -0.05, centerZ]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[radius * 4, radius * 4]} />
          <meshStandardMaterial color="#DCE9FF" />
        </mesh>

        {placements.map((placement) => (
          <BuildingMesh
            key={placement.building.id}
            placement={placement}
            isSelected={placement.building.id === selectedBuildingId}
            onSelect={onSelectBuilding}
          />
        ))}

        <OrbitControls
          ref={controlsRef}
          target={defaultTarget}
          enablePan
          enableZoom
          enableRotate
          minDistance={20}
          maxDistance={radius * 4}
          maxPolarAngle={Math.PI / 2 - 0.02}
          makeDefault
        />
      </Canvas>
    );
  },
);
