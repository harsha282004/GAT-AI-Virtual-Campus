"use client";

import { ErrorState, SkeletonCard } from "@/components/ui";
import { useBuildings, useFloors, useNodes, usePanoramas, useRooms } from "@/hooks";
import { useTourStore } from "@/store";

import { PanoramaCard } from "./PanoramaCard";

export function PanoramaGrid() {
  const panoramas = usePanoramas();
  const nodes = useNodes();
  const buildings = useBuildings();
  const floors = useFloors();
  const rooms = useRooms();

  const currentNodeId = useTourStore((state) => state.currentNodeId);
  const setLocation = useTourStore((state) => state.setLocation);

  const isLoading =
    panoramas.isLoading || nodes.isLoading || buildings.isLoading || floors.isLoading || rooms.isLoading;
  const isError =
    panoramas.isError || nodes.isError || buildings.isError || floors.isError || rooms.isError;

  function retryAll() {
    panoramas.refetch();
    nodes.refetch();
    buildings.refetch();
    floors.refetch();
    rooms.refetch();
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        title="Couldn't load panoramas"
        message="Make sure the backend is running at the configured API base URL."
        onRetry={retryAll}
      />
    );
  }

  if (!panoramas.data || panoramas.data.length === 0) {
    return (
      <p className="text-sm text-gat-navy/60 dark:text-white/60">
        No panoramas have been added yet.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {panoramas.data.map((panorama, index) => {
        const node = nodes.data?.find((n) => n.id === panorama.node_id);
        const building = buildings.data?.find((b) => b.id === node?.building_id);
        const floor = floors.data?.find((f) => f.id === node?.floor_id);
        const room = rooms.data?.find((r) => r.node_id === panorama.node_id);

        return (
          <PanoramaCard
            key={panorama.id}
            index={index}
            title={panorama.title ?? "Untitled location"}
            buildingName={building?.name ?? "Campus grounds"}
            floorName={floor?.name ?? null}
            roomName={room?.name ?? null}
            isPlaceholder={panorama.is_placeholder}
            isActive={currentNodeId === panorama.node_id}
            onOpen={() => setLocation(panorama.node_id, panorama.title ?? "Untitled location")}
          />
        );
      })}
    </div>
  );
}
