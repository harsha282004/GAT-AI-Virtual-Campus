import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { buildingsApi } from "@/api/buildings";
import { tourApi } from "@/api/tour";

const MAIN_BUILDING_CODE = "MAIN";

/**
 * Loads the Main Building's 360° scene list (the same data the Virtual Tour
 * uses) and exposes `resolveNode(panoramaFile)` which maps a campus_spatial
 * `panorama_file` (e.g. "first-floor/01.jpg") to that scene's campus graph
 * `node_id`. Used by the Campus Facilities section to build real
 * "Enter 360°" / "Get Directions" deep-links — and to hide those actions
 * when no scene matches.
 */
export function useCampusScenes() {
  const query = useQuery({
    queryKey: ["campus-scenes", MAIN_BUILDING_CODE],
    queryFn: async () => {
      const buildings = await buildingsApi.list();
      const main = buildings.find((b) => b.code === MAIN_BUILDING_CODE);
      if (!main) return [];
      return tourApi.listScenes(main.id);
    },
    staleTime: 10 * 60 * 1000,
  });

  const resolveNode = useMemo(() => {
    const scenes = query.data ?? [];
    return (panoramaFile: string): number | undefined => {
      const suffix = `/${panoramaFile.replace(/^\/+/, "")}`;
      const scene = scenes.find((s) => s.image.endsWith(suffix));
      return scene ? Number(scene.id) : undefined;
    };
  }, [query.data]);

  /** First scene on a given floor (by capture sequence) — the natural
   * origin for "Get Directions" on that floor. The campus graph's `edges`
   * connect scenes only within a floor (cross-floor links live in the
   * separate hotspot dataset the A* engine doesn't read), so a route
   * request has to start and end on the same floor. */
  const floorStartNode = useMemo(() => {
    const scenes = query.data ?? [];
    return (floorName: string): number | undefined => {
      const first = scenes
        .filter((s) => s.floor.toLowerCase() === floorName.toLowerCase())
        .sort((a, b) => (a.sequenceIndex ?? 0) - (b.sequenceIndex ?? 0))[0];
      return first ? Number(first.id) : undefined;
    };
  }, [query.data]);

  return { ...query, resolveNode, floorStartNode };
}
