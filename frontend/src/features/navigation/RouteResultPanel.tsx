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
    <div className="flex h-full flex-col rounded-3xl border border-hairline bg-white p-7 shadow-soft">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink">
        <Route className="h-4 w-4 text-brand" />
        Route
      </div>

      {!ready && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
          <MapPin className="h-8 w-8 text-brand/25" />
          <p className="max-w-xs text-sm text-muted">
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
          <MapPin className="h-8 w-8 text-brand/25" />
          <p className="max-w-xs text-sm text-muted">
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
            <span className="flex items-center gap-1.5 rounded-full bg-brand/8 px-3 py-1.5 font-medium text-ink">
              <Milestone className="h-3.5 w-3.5 text-brand" />
              {formatDistance(route.total_distance)}
            </span>
            <span className="flex items-center gap-1.5 rounded-full bg-brand/8 px-3 py-1.5 font-medium text-ink">
              <Footprints className="h-3.5 w-3.5 text-brand" />
              {formatWalkTime(route.estimated_walk_time_minutes)}
            </span>
          </div>

          <ol className="space-y-3">
            {route.turn_by_turn.map((step, index) => (
              <li key={`${step.node_id}-${index}`} className="flex gap-3 text-sm">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-semibold text-brand">
                  {index + 1}
                </span>
                <div>
                  <p className="text-ink">{step.instruction}</p>
                  {step.edge_type && (
                    <p className="text-xs text-muted">{formatEdgeType(step.edge_type)}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </motion.div>
      )}

      {/* Reserved for the future graphical/3D path visualization — see docs/architecture.md */}
      <div className="mt-6 flex min-h-[10rem] flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-hairline bg-brand/[0.02] p-6 text-center">
        <MapIcon className="h-6 w-6 text-brand/25" />
        <p className="text-xs text-muted">Visual path map — coming in a future phase</p>
      </div>

      {fromNodeLabel && (
        <p className="mt-4 text-center text-xs text-muted">Starting from {fromNodeLabel}</p>
      )}
    </div>
  );
}
