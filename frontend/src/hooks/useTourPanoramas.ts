import { useQuery } from "@tanstack/react-query";

import { buildingsApi } from "@/api/buildings";
import { tourApi } from "@/api/tour";
import type { TourPanorama } from "@/types";

const TOUR_BUILDING_CODE = "MAIN";

/**
 * Resolves the Main Building's id (buildings are looked up by code, same
 * "fetch all, find client-side" pattern used elsewhere — see useBuildings)
 * then loads its full scene sequence from the backend. Field shapes match
 * the pre-existing TourPanorama type exactly, so PanoramaViewer, TourSidebar,
 * TourControls and TourTopBar needed no changes for this swap.
 */
async function fetchTourPanoramas(): Promise<TourPanorama[]> {
  const buildings = await buildingsApi.list();
  const mainBuilding = buildings.find((b) => b.code === TOUR_BUILDING_CODE);
  if (!mainBuilding) {
    throw new Error(
      "Main Building tour data not found — has the database been seeded? " +
        "(run `python scripts/media/build_panoramas.py` then `python scripts/db/seed.py`)",
    );
  }
  return tourApi.listScenes(mainBuilding.id);
}

export function useTourPanoramas() {
  return useQuery({
    queryKey: ["tour-panoramas"],
    queryFn: fetchTourPanoramas,
    staleTime: 5 * 60 * 1000,
  });
}
