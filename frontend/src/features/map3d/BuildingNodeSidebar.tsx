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
    <aside className="flex h-[calc(100vh-7rem)] w-full flex-col gap-6 overflow-y-auto rounded-3xl border border-gat-navy/10 bg-white p-5 dark:border-white/10 dark:bg-gat-navy-light lg:w-80">
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
            <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gat-navy/60 dark:text-white/60">
              <Building2 className="h-3.5 w-3.5" />
              Buildings ({buildings.data?.length ?? 0})
            </h2>
            {!buildings.data || buildings.data.length === 0 ? (
              <p className="text-xs text-gat-navy/40 dark:text-white/40">No buildings yet.</p>
            ) : (
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedBuildingId(null)}
                  className={cn(
                    "w-full rounded-lg px-3 py-2 text-left text-sm transition-colors",
                    selectedBuildingId === null
                      ? "bg-gat-maroon/10 font-medium text-gat-maroon"
                      : "text-gat-navy/70 hover:bg-gat-navy/5 dark:text-white/70 dark:hover:bg-white/5",
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
                        ? "bg-gat-maroon/10 font-medium text-gat-maroon"
                        : "text-gat-navy/70 hover:bg-gat-navy/5 dark:text-white/70 dark:hover:bg-white/5",
                    )}
                  >
                    {building.name}
                    {building.code && (
                      <span className="ml-1.5 text-xs text-gat-navy/40 dark:text-white/40">
                        {building.code}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gat-navy/60 dark:text-white/60">
              <MapPin className="h-3.5 w-3.5" />
              Nodes ({visibleNodes.length})
            </h2>
            {visibleNodes.length === 0 ? (
              <p className="text-xs text-gat-navy/40 dark:text-white/40">
                No nodes recorded for this selection.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {visibleNodes.map((node) => (
                  <li
                    key={node.id}
                    className="flex items-center justify-between rounded-lg bg-gat-navy/5 px-3 py-2 text-xs text-gat-navy/70 dark:bg-white/5 dark:text-white/70"
                  >
                    <span>{node.name}</span>
                    <span className="capitalize text-gat-navy/40 dark:text-white/40">
                      {node.node_type}
                    </span>
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
