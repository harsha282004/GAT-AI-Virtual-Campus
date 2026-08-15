"use client";

import { Circle, Marker } from "@vis.gl/react-google-maps";
import { useEffect, useRef, useState } from "react";

interface UserLocationMarkerProps {
  latitude: number;
  longitude: number;
  accuracy: number | null;
}

const DOT_COLOR = "#4285F4";
const PULSE_MIN_RADIUS_M = 8;
const PULSE_MAX_RADIUS_M = 26;
const PULSE_PERIOD_MS = 2200;
const PULSE_MAX_OPACITY = 0.3;

/**
 * Phase 18 — the real-time "blue dot" for the user's own GPS position.
 * Deliberately styled nothing like BuildingMarker/CampusMarker (both
 * plain red pins) so it reads unambiguously as "you", not a campus
 * point of interest.
 *
 * The dot itself is a vector google.maps.Symbol on a plain Marker, not
 * an AdvancedMarker — AdvancedMarker requires a Google Cloud Map ID,
 * and Phase 17 deliberately kept this satellite map's only
 * configuration requirement to an API key; introducing a Map ID
 * requirement here would break that. The pulsing halo is a Circle
 * overlay (a real vector shape, not a bitmap) whose radius/opacity are
 * animated via requestAnimationFrame — this achieves a genuine
 * animation without needing DOM-based markers either.
 */
export function UserLocationMarker({ latitude, longitude, accuracy }: UserLocationMarkerProps) {
  const position = { lat: latitude, lng: longitude };
  const [pulseRadius, setPulseRadius] = useState(PULSE_MIN_RADIUS_M);
  const [pulseOpacity, setPulseOpacity] = useState(PULSE_MAX_OPACITY);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const start = performance.now();
    function tick(now: number) {
      const t = ((now - start) % PULSE_PERIOD_MS) / PULSE_PERIOD_MS; // 0..1
      setPulseRadius(PULSE_MIN_RADIUS_M + (PULSE_MAX_RADIUS_M - PULSE_MIN_RADIUS_M) * t);
      setPulseOpacity(PULSE_MAX_OPACITY * (1 - t));
      frameRef.current = requestAnimationFrame(tick);
    }
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, []);

  return (
    <>
      {/* GPS accuracy circle — only shown when the browser actually
          reported one; never a fabricated/default radius. */}
      {accuracy !== null && accuracy > 0 && (
        <Circle
          center={position}
          radius={accuracy}
          clickable={false}
          strokeColor={DOT_COLOR}
          strokeOpacity={0.25}
          strokeWeight={1}
          fillColor={DOT_COLOR}
          fillOpacity={0.12}
        />
      )}

      <Circle
        center={position}
        radius={pulseRadius}
        clickable={false}
        strokeWeight={0}
        fillColor={DOT_COLOR}
        fillOpacity={pulseOpacity}
      />

      <Marker
        position={position}
        clickable={false}
        zIndex={1000}
        title="Your location"
        icon={{
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: DOT_COLOR,
          fillOpacity: 1,
          strokeColor: "#FFFFFF",
          strokeWeight: 2,
        }}
      />
    </>
  );
}
