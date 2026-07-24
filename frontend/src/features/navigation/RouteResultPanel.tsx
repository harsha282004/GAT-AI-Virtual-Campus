"use client";

import { motion } from "framer-motion";
import { Footprints, MapIcon, MapPin, Milestone, Route } from "lucide-react";

import { ErrorState, Spinner } from "@/components/ui";
import { useDestinationRoute } from "@/hooks";
import { useNavigationStore } from "@/store";
import { formatDistance, formatEdgeType, formatWalkTime } from "@/utils";

export function RouteResultPanel() {
  const { fromNodeId, fromNodeLabel, destinationType, destinationId, destinationLabel } =
    useNavigationStore();

  const {
    data: routeResponse,
    isLoading,
    isError,
    refetch,
  } = useDestinationRoute(fromNodeId, destinationType, destinationId);

  const route = routeResponse?.route ?? null;
  const ready = fromNodeId !== null && destinationType !== null && destinationId !== null;

  return (
    <div className="flex h-full flex-col rounded-2xl border border-gat-navy/10 bg-white p-6 dark:border-white/10 dark:bg-gat-navy-light">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-gat-navy dark:text-white">
        <Route className="h-4 w-4 text-gat-maroon" />
        Route
      </div>

      {!ready && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
          <MapPin className="h-8 w-8 text-gat-navy/20 dark:text-white/20" />
          <p className="max-w-xs text-sm text-gat-navy/50 dark:text-white/50">
            Choose a current location and a destination to compute a route.
          </p>
        </div>
      )}

      {ready && isLoading && (
        <div className="flex flex-1 items-center justify-center py-16">
          <Spinner label="Finding the shortest path…" />
        </div>
      )}

      {ready && isError && (
        <ErrorState
          title="Couldn't compute a route"
          message="No path could be found between these points."
          onRetry={() => refetch()}
        />
      )}

      {ready && !isLoading && !isError && !route && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
          <MapPin className="h-8 w-8 text-gat-navy/20 dark:text-white/20" />
          <p className="max-w-xs text-sm text-gat-navy/50 dark:text-white/50">
            &ldquo;{destinationLabel}&rdquo; doesn&apos;t have a navigable point set yet.
          </p>
        </div>
      )}

      {route && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-5"
        >
          <div className="flex flex-wrap gap-3 text-xs">
            <span className="flex items-center gap-1.5 rounded-full bg-gat-navy/5 px-3 py-1.5 font-medium text-gat-navy dark:bg-white/10 dark:text-white">
              <Milestone className="h-3.5 w-3.5" />
              {formatDistance(route.total_distance)}
            </span>
            <span className="flex items-center gap-1.5 rounded-full bg-gat-navy/5 px-3 py-1.5 font-medium text-gat-navy dark:bg-white/10 dark:text-white">
              <Footprints className="h-3.5 w-3.5" />
              {formatWalkTime(route.estimated_walk_time_minutes)}
            </span>
          </div>

          <ol className="space-y-3">
            {route.turn_by_turn.map((step, index) => (
              <li key={`${step.node_id}-${index}`} className="flex gap-3 text-sm">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gat-maroon/10 text-xs font-semibold text-gat-maroon">
                  {index + 1}
                </span>
                <div>
                  <p className="text-gat-navy dark:text-white">{step.instruction}</p>
                  {step.edge_type && (
                    <p className="text-xs text-gat-navy/40 dark:text-white/40">
                      {formatEdgeType(step.edge_type)}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </motion.div>
      )}

      {/* Reserved for the future graphical/3D path visualization — see docs/architecture.md */}
      <div className="mt-6 flex flex-1 min-h-[10rem] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gat-navy/15 bg-gat-navy/[0.02] p-6 text-center dark:border-white/15 dark:bg-white/[0.02]">
        <MapIcon className="h-6 w-6 text-gat-navy/25 dark:text-white/25" />
        <p className="text-xs text-gat-navy/40 dark:text-white/40">
          Visual path map — coming in a future phase
        </p>
      </div>

      {fromNodeLabel && (
        <p className="mt-4 text-center text-xs text-gat-navy/40 dark:text-white/40">
          Starting from {fromNodeLabel}
        </p>
      )}
    </div>
  );
}
