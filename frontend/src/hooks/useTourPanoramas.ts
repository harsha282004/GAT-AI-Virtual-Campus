import { useQuery } from "@tanstack/react-query";

import type { TourPanorama } from "@/types";

/**
 * Loads the dummy panorama/hotspot graph from the static JSON asset. Field
 * shapes intentionally mirror the backend's Building/Floor/Room/Panorama
 * naming so this can be swapped for a real API response later with no
 * consumer changes — see docs note in public/panoramas/panoramas.json.
 */
async function fetchTourPanoramas(): Promise<TourPanorama[]> {
  const response = await fetch("/panoramas/panoramas.json");
  if (!response.ok) {
    throw new Error(`Failed to load panorama metadata (${response.status})`);
  }
  return response.json();
}

export function useTourPanoramas() {
  return useQuery({
    queryKey: ["tour-panoramas"],
    queryFn: fetchTourPanoramas,
    staleTime: Infinity,
  });
}
