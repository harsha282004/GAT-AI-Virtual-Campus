"use client";

import { InfoWindow, Marker } from "@vis.gl/react-google-maps";
import { useState } from "react";

import { GAT_CAMPUS_CENTER } from "@/config/campusLocation";
import type { Building } from "@/types";

interface CampusMarkerProps {
  buildings: Building[];
  selectedBuildingId: number | null;
  onSelectBuilding: (buildingId: number) => void;
}

const POSITION = { lat: GAT_CAMPUS_CENTER.latitude, lng: GAT_CAMPUS_CENTER.longitude };

/** The one real, sourced geographic point this map plots (see
 * campusLocation.ts's documented source). Clicking it opens a popup
 * listing the real buildings from the existing project data (Section 6)
 * rather than scattering individual pins across the satellite tile at
 * fabricated positions — no building has a surveyed latitude/longitude
 * yet (see BuildingMarker.tsx), and inventing one would violate Section
 * 11. Once a building's real coordinates are recorded, BuildingMarker
 * renders a real pin for it automatically and it no longer needs this
 * list to be found. */
export function CampusMarker({ buildings, selectedBuildingId, onSelectBuilding }: CampusMarkerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Marker
        position={POSITION}
        title="Global Academy of Technology"
        onClick={() => setIsOpen((prev) => !prev)}
      />
      {isOpen && (
        <InfoWindow position={POSITION} maxWidth={260} onCloseClick={() => setIsOpen(false)}>
          <div className="min-w-[200px] p-1">
            <p className="text-sm font-semibold text-slate-900">Global Academy of Technology</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Exact building GPS positions are pending an on-site survey. Select a building to
              view what&apos;s recorded for it.
            </p>
            <ul className="mt-2 flex flex-col gap-0.5">
              {buildings.map((building) => (
                <li key={building.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectBuilding(building.id);
                      setIsOpen(false);
                    }}
                    className={
                      building.id === selectedBuildingId
                        ? "w-full rounded px-2 py-1 text-left text-xs font-semibold text-[#2E4DB7]"
                        : "w-full rounded px-2 py-1 text-left text-xs text-slate-700 hover:bg-slate-100"
                    }
                  >
                    {building.name}
                    {building.code ? ` (${building.code})` : ""}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </InfoWindow>
      )}
    </>
  );
}
