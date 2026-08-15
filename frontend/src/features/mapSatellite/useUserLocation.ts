"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type UserLocationStatus =
  | "idle"
  | "requesting"
  | "available"
  | "denied"
  | "unavailable"
  | "unsupported";

export interface UserLocationPosition {
  latitude: number;
  longitude: number;
  accuracy: number | null;
}

export interface UseUserLocationResult {
  status: UserLocationStatus;
  position: UserLocationPosition | null;
  errorMessage: string | null;
  requestLocation: () => void;
}

const UNSUPPORTED_MESSAGE = "Geolocation is not supported by this browser.";
const DENIED_MESSAGE =
  "Location permission was denied. Please enable location access in your browser settings.";
const UNAVAILABLE_MESSAGE = "Unable to determine your current location.";

/**
 * Phase 18 — thin wrapper around the real browser Geolocation API
 * (navigator.geolocation). Never returns a hardcoded/fake coordinate —
 * `position` is null until the browser actually reports one. Does NOT
 * call getCurrentPosition/watchPosition on mount; only requestLocation()
 * (wired to the "My Location" button) triggers a permission prompt, per
 * this phase's explicit "don't request location on page load" UX
 * requirement. Feature-detection (checking `navigator.geolocation`
 * exists) on mount is passive and does not prompt for permission.
 *
 * Prefers watchPosition() for live updates once an initial fix succeeds
 * (Section "REAL-TIME LOCATION") — a single watcher is kept at a time
 * (a second click replaces rather than stacks it), and it's always
 * cleared on unmount.
 */
export function useUserLocation(): UseUserLocationResult {
  const [status, setStatus] = useState<UserLocationStatus>("idle");
  const [position, setPosition] = useState<UserLocationPosition | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setStatus("unsupported");
      setErrorMessage(UNSUPPORTED_MESSAGE);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const handlePosition = useCallback((geo: GeolocationPosition) => {
    setStatus("available");
    setErrorMessage(null);
    setPosition({
      latitude: geo.coords.latitude,
      longitude: geo.coords.longitude,
      accuracy: geo.coords.accuracy ?? null,
    });
  }, []);

  const handleError = useCallback((error: GeolocationPositionError) => {
    if (error.code === error.PERMISSION_DENIED) {
      setStatus("denied");
      setErrorMessage(DENIED_MESSAGE);
    } else {
      setStatus("unavailable");
      setErrorMessage(UNAVAILABLE_MESSAGE);
    }
  }, []);

  const requestLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setStatus("unsupported");
      setErrorMessage(UNSUPPORTED_MESSAGE);
      return;
    }

    setStatus("requesting");
    setErrorMessage(null);

    navigator.geolocation.getCurrentPosition(
      (geo) => {
        handlePosition(geo);
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
        }
        watchIdRef.current = navigator.geolocation.watchPosition(handlePosition, handleError, {
          enableHighAccuracy: true,
          maximumAge: 10_000,
        });
      },
      handleError,
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  }, [handleError, handlePosition]);

  return { status, position, errorMessage, requestLocation };
}
