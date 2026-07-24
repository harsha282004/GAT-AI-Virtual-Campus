"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { ErrorState, PageContainer, Skeleton } from "@/components/ui";
import { BuildingDetail, BuildingPanoramas } from "@/features/campus";
import { useBuilding, useFloors, useNodes, usePanoramas, useRooms } from "@/hooks";

export default function BuildingDetailsPage() {
  const params = useParams<{ buildingId: string }>();
  const parsedId = Number(params.buildingId);
  const buildingId = Number.isFinite(parsedId) ? parsedId : null;

  const building = useBuilding(buildingId);
  const floors = useFloors();
  const rooms = useRooms();
  const nodes = useNodes();
  const panoramas = usePanoramas();

  const isLoading =
    building.isLoading || floors.isLoading || rooms.isLoading || nodes.isLoading || panoramas.isLoading;
  const isError = building.isError || floors.isError || rooms.isError || nodes.isError || panoramas.isError;

  function retryAll() {
    building.refetch();
    floors.refetch();
    rooms.refetch();
    nodes.refetch();
    panoramas.refetch();
  }

  const buildingFloors = (floors.data ?? []).filter((f) => f.building_id === buildingId);
  const floorIds = new Set(buildingFloors.map((f) => f.id));
  const buildingRooms = (rooms.data ?? []).filter((r) => floorIds.has(r.floor_id));
  const buildingNodeIds = new Set(
    (nodes.data ?? []).filter((n) => n.building_id === buildingId).map((n) => n.id),
  );
  const buildingPanoramas = (panoramas.data ?? []).filter((p) => buildingNodeIds.has(p.node_id));

  return (
    <PageContainer narrow>
      <Link
        href="/campus"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-gat-navy/60 transition-colors hover:text-gat-maroon dark:text-white/60"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Campus Overview
      </Link>

      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}

      {isError && !isLoading && (
        <ErrorState
          title="Couldn't load this building"
          message="Make sure the backend is running at the configured API base URL."
          onRetry={retryAll}
        />
      )}

      {!isLoading && !isError && !building.data && (
        <ErrorState
          title="Building not found"
          message="This building may have been removed or the link is incorrect."
        />
      )}

      {!isLoading && !isError && building.data && (
        <div className="space-y-6">
          <BuildingDetail building={building.data} floors={buildingFloors} rooms={buildingRooms} />
          <BuildingPanoramas panoramas={buildingPanoramas} />
        </div>
      )}
    </PageContainer>
  );
}
