"use client";

import { useEffect } from "react";
import { ListChecks, MapPin } from "lucide-react";

import { ErrorState, Spinner } from "@/components/ui";
import { useDestinationRoute } from "@/hooks";
import { useNavigationStore } from "@/store";
import { formatEdgeType } from "@/utils";

export function TurnByTurnPanel() {
  const fromNodeId = useNavigationStore((state) => state.fromNodeId);
  const destinationType = useNavigationStore((state) => state.destinationType);
  const destinationId = useNavigationStore((state) => state.destinationId);
  const destinationLabel = useNavigationStore((state) => state.destinationLabel);
  const wheelchairMode = useNavigationStore((state) => state.wheelchairMode);
  const instructions = useNavigationStore((state) => state.instructions);
  const setRoute = useNavigationStore((state) => state.setRoute);
  const setIsRouting = useNavigationStore((state) => state.setIsRouting);

  const ready = fromNodeId !== null && destinationType !== null && destinationId !== null;

  const {
    data: routeResponse,
    isLoading,
    isError,
    refetch,
  } = useDestinationRoute(fromNodeId, destinationType, destinationId, wheelchairMode);

  useEffect(() => {
    setIsRouting(isLoading);
  }, [isLoading, setIsRouting]);

  useEffect(() => {
    setRoute(routeResponse?.route ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setRoute identity is stable
  }, [routeResponse]);

  return (
    <div className="rounded-3xl border border-hairline bg-white p-5 shadow-soft dark:bg-[#0F172A] dark:shadow-black/30">
      <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
        <ListChecks className="h-3.5 w-3.5 text-brand" />
        Route Instructions
      </h2>

      {!ready && (
        <p className="flex items-center gap-2 text-sm text-muted">
          <MapPin className="h-4 w-4 text-brand/30" />
          Set a current location and a destination to see turn-by-turn directions.
        </p>
      )}

      {ready && isLoading && <Spinner size="sm" label="Calculating route…" />}

      {ready && isError && (
        <ErrorState
          title="Couldn't compute a route"
          message={
            wheelchairMode
              ? "No wheelchair-accessible path could be found — try turning off accessible mode."
              : "No path could be found between these points."
          }
          onRetry={() => refetch()}
        />
      )}

      {ready && !isLoading && !isError && instructions.length === 0 && (
        <p className="text-sm text-muted">
          &ldquo;{destinationLabel}&rdquo; doesn&apos;t have a navigable point set yet.
        </p>
      )}

      {ready && !isLoading && !isError && instructions.length > 0 && (
        <ol className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {instructions.map((step, index) => (
            <li
              key={`${step.node_id}-${index}`}
              className="flex gap-2.5 rounded-2xl bg-brand/5 p-3 text-sm"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-semibold text-brand">
                {index + 1}
              </span>
              <div>
                <p className="text-ink">{step.instruction}</p>
                {step.edge_type && (
                  <p className="mt-0.5 text-xs text-muted">{formatEdgeType(step.edge_type)}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
