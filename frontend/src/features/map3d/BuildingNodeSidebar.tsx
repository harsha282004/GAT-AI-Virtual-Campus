"use client";

import { Building2, MapPin } from "lucide-react";

import { ErrorState, Skeleton } from "@/components/ui";
import { useBuildings, useNodes } from "@/hooks";
import { useCampusStore } from "@/store";
import { cn } from "@/utils";

export function BuildingNodeSidebar() {
  const buildings = useBuildings();
  const nodes = useNodes();

  const selectedBuildingId = useCampusStore((state) => state.selectedBuildingId);
  const setSelectedBuildingId = useCampusStore((state) => state.setSelectedBuildingId);

  const isLoading = buildings.isLoading || nodes.isLoading;
  const isError = buildings.isError || nodes.isError;

  function retryAll() {
    buildings.refetch();
    nodes.refetch();
  }

  const visibleNodes = selectedBuildingId
    ? (nodes.data ?? []).filter((n) => n.building_id === selectedBuildingId)
    : (nodes.data ?? []);

  return (
    <aside className="flex h-[calc(100vh-7rem)] w-full flex-col gap-6 overflow-y-auto rounded-3xl border border-hairline bg-white p-6 shadow-soft lg:w-80">
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      )}

      {isError && !isLoading && (
        <ErrorState
          title="Couldn't load map data"
          message="Buildings and nodes could not be retrieved from the backend."
          onRetry={retryAll}
        />
      )}

      {!isLoading && !isError && (
        <>
          <div>
            <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
              <Building2 className="h-3.5 w-3.5" />
              Buildings ({buildings.data?.length ?? 0})
            </h2>
            {!buildings.data || buildings.data.length === 0 ? (
              <p className="text-xs text-muted">No buildings yet.</p>
            ) : (
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedBuildingId(null)}
                  className={cn(
                    "w-full rounded-lg px-3 py-2 text-left text-sm transition-colors",
                    selectedBuildingId === null
                      ? "bg-brand/10 font-medium text-brand"
                      : "text-ink/70 hover:bg-brand/5",
                  )}
                >
                  All buildings
                </button>
                {buildings.data.map((building) => (
                  <button
                    key={building.id}
                    type="button"
                    onClick={() => setSelectedBuildingId(building.id)}
                    className={cn(
                      "w-full rounded-lg px-3 py-2 text-left text-sm transition-colors",
                      selectedBuildingId === building.id
                        ? "bg-brand/10 font-medium text-brand"
                        : "text-ink/70 hover:bg-brand/5",
                    )}
                  >
                    {building.name}
                    {building.code && (
                      <span className="ml-1.5 text-xs text-muted">{building.code}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
              <MapPin className="h-3.5 w-3.5" />
              Nodes ({visibleNodes.length})
            </h2>
            {visibleNodes.length === 0 ? (
              <p className="text-xs text-muted">No nodes recorded for this selection.</p>
            ) : (
              <ul className="space-y-1.5">
                {visibleNodes.map((node) => (
                  <li
                    key={node.id}
                    className="flex items-center justify-between rounded-lg bg-brand/5 px-3 py-2 text-xs text-ink/70"
                  >
                    <span>{node.name}</span>
                    <span className="capitalize text-muted">{node.node_type}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
