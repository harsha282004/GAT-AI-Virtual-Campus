"use client";

import { Box, Satellite } from "lucide-react";
import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { useState } from "react";

import { Skeleton } from "@/components/ui";
import { Map3DCampusView } from "@/features/map3d";

type ViewMode = "satellite" | "3d";

// The Google Maps JS SDK touches window/document as it loads, same
// reasoning as map3d/Map3DCampusView.tsx's own dynamic import of its R3F
// canvas — never run during Next.js's server render.
const SatelliteCampusMap = dynamic(
  () => import("@/features/mapSatellite").then((mod) => mod.SatelliteCampusMap),
  { ssr: false, loading: () => <Skeleton className="h-full w-full rounded-3xl" /> },
);

/** Phase 17 — the satellite map is now the primary /map experience
 * (Section 1). The Phase 16 3D scene is preserved completely unmodified
 * and reachable as a selectable alternate view (Section 10) rather than
 * deleted. Only one renderer mounts at a time: switching modes fully
 * unmounts the other, so the Google Maps JS SDK and Three.js/WebGL never
 * run concurrently (Section 10's "do not force both renderers into the
 * same runtime"). */
export function CampusMapView() {
  const [mode, setMode] = useState<ViewMode>("satellite");

  return (
    <div className="relative flex h-[calc(100vh-7rem)] min-w-0 flex-1 flex-col">
      <div className="pointer-events-none absolute inset-x-0 top-4 z-30 flex justify-center">
        <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-hairline bg-white p-1 shadow-soft dark:bg-[#0F172A]">
          <ModeButton
            active={mode === "satellite"}
            onClick={() => setMode("satellite")}
            icon={<Satellite className="h-3.5 w-3.5" />}
            label="Satellite"
          />
          <ModeButton
            active={mode === "3d"}
            onClick={() => setMode("3d")}
            icon={<Box className="h-3.5 w-3.5" />}
            label="3D View"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {mode === "satellite" ? <SatelliteCampusMap /> : <Map3DCampusView />}
      </div>
    </div>
  );
}

interface ModeButtonProps {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}

function ModeButton({ active, onClick, icon, label }: ModeButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? "flex items-center gap-1.5 rounded-full bg-[#2E4DB7] px-3.5 py-1.5 text-sm font-medium text-white transition-colors"
          : "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-brand/5"
      }
    >
      {icon}
      {label}
    </button>
  );
}
