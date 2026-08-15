"use client";

import dynamic from "next/dynamic";

// Touches the Google Maps JS SDK at mount (window/document) — must stay
// client-only, same pattern used for other browser-API-dependent views.
const SatelliteCampusMap = dynamic(
  () => import("@/features/mapSatellite").then((mod) => mod.SatelliteCampusMap),
  { ssr: false },
);

export default function MapPage() {
  return (
    <div className="flex h-screen flex-col gap-4 px-4 pb-4 pt-24 sm:px-6 lg:px-8">
      <SatelliteCampusMap />
    </div>
  );
}
