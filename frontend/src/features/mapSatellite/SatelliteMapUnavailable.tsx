"use client";

import { MapPinOff } from "lucide-react";

interface SatelliteMapUnavailableProps {
  reason: "missing-key" | "load-failed";
}

const MESSAGES: Record<SatelliteMapUnavailableProps["reason"], string> = {
  "missing-key":
    "Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in frontend/.env.local to enable the live satellite map — see docs/phase17_satellite_campus_map.md for where to get a key.",
  "load-failed":
    "Google Maps failed to load. Check that the configured API key is valid, the Maps JavaScript API is enabled for it, and no domain/referrer restriction is blocking this origin.",
};

/** Section 13 — the app must not crash or show a blank screen when the
 * Google Maps API key is missing or the SDK fails to load. Styled to
 * match map3d/Map3DErrorBoundary.tsx's Map3DUnavailable fallback. */
export function SatelliteMapUnavailable({ reason }: SatelliteMapUnavailableProps) {
  return (
    <div className="flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-4 rounded-3xl border border-hairline bg-white p-8 text-center shadow-soft dark:bg-[#0F172A] dark:shadow-black/30">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-900/40">
        <MapPinOff className="h-7 w-7 text-amber-600 dark:text-amber-400" />
      </span>
      <div>
        <p className="font-display text-lg font-semibold text-ink">Satellite map unavailable</p>
        <p className="mt-1 max-w-sm text-sm text-muted">{MESSAGES[reason]}</p>
      </div>
    </div>
  );
}
