"use client";

import { Navigation2, X } from "lucide-react";

import { Button, Card } from "@/components/ui";

import type { UseCampusNavigationResult } from "./useCampusNavigation";

interface NavigationPanelProps {
  nav: UseCampusNavigationResult;
  onClose: () => void;
}

/** Phase 19 — the "My Location -> Select Destination -> Navigate" panel
 * (Section "DESTINATION SELECTION"'s example UI). Destination selection
 * itself is NOT duplicated here — it reuses the existing
 * useCampusStore.selectedBuildingId (set by the sidebar or MapSearch,
 * both unmodified); this panel only displays whichever building is
 * already selected and starts navigation to it. */
export function NavigationPanel({ nav, onClose }: NavigationPanelProps) {
  const { nearestNode, destinationBuilding, route, status, errorMessage, startNavigation, clearRoute } =
    nav;

  return (
    <Card className="w-full max-w-sm !p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 font-display text-sm font-semibold text-ink">
          <Navigation2 className="h-4 w-4 text-brand" />
          Navigate
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close navigation panel"
          className="rounded-full p-1 text-muted transition-colors hover:bg-brand/5 hover:text-ink"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mb-3 space-y-2 text-xs">
        <div className="rounded-xl bg-brand/5 px-3 py-2">
          <p className="text-muted">Current location</p>
          <p className="font-medium text-ink">
            {nearestNode
              ? `Nearest: ${nearestNode.nearestNodeName} (${nearestNode.distanceMeters.toFixed(0)}m away)`
              : "No supported GPS starting point nearby yet"}
          </p>
        </div>
        <div className="rounded-xl bg-brand/5 px-3 py-2">
          <p className="text-muted">Destination</p>
          <p className="font-medium text-ink">
            {destinationBuilding ? destinationBuilding.name : "Select a building to navigate to"}
          </p>
        </div>
      </div>

      {errorMessage && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
          {errorMessage}
        </p>
      )}

      {route ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-ink">
            {route.total_distance.toFixed(0)}m · ~{Math.max(1, Math.round(route.estimated_walk_time_minutes))}{" "}
            min walk
            {!route.is_accessible && " · includes stairs"}
          </p>
          <ol className="max-h-48 space-y-1.5 overflow-y-auto text-xs text-ink/80">
            {route.turn_by_turn.map((step, index) => (
              <li key={`${step.node_id}-${index}`} className="rounded-lg bg-brand/5 px-2.5 py-1.5">
                {step.instruction}
              </li>
            ))}
          </ol>
          <Button variant="outline" size="sm" fullWidth onClick={clearRoute}>
            Clear route
          </Button>
        </div>
      ) : (
        <Button
          variant="primary"
          size="sm"
          fullWidth
          onClick={startNavigation}
          disabled={status === "computing_route"}
        >
          {status === "computing_route" ? "Finding route…" : "Start Navigation"}
        </Button>
      )}

      <p className="mt-3 text-[10px] leading-relaxed text-muted">
        Based on your real outdoor GPS position — not exact indoor/room-level location.
      </p>
    </Card>
  );
}
