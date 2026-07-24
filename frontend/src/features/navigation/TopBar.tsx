"use client";

import { Accessibility, Clock, Flag, MapPin, Route } from "lucide-react";

import { useNavigationStore } from "@/store";
import { cn, formatDistance, formatWalkTime } from "@/utils";

export function TopBar() {
  const fromNodeLabel = useNavigationStore((state) => state.fromNodeLabel);
  const destinationLabel = useNavigationStore((state) => state.destinationLabel);
  const distance = useNavigationStore((state) => state.distance);
  const etaMinutes = useNavigationStore((state) => state.etaMinutes);
  const wheelchairMode = useNavigationStore((state) => state.wheelchairMode);
  const toggleWheelchairMode = useNavigationStore((state) => state.toggleWheelchairMode);

  return (
    <div className="glass flex flex-wrap items-center gap-3 rounded-3xl px-5 py-4 shadow-soft">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-4">
        <span className="flex items-center gap-1.5 text-sm text-ink">
          <MapPin className="h-4 w-4 shrink-0 text-brand" />
          <span className="truncate">{fromNodeLabel ?? "Set a current location"}</span>
        </span>
        <span className="text-muted">→</span>
        <span className="flex items-center gap-1.5 text-sm text-ink">
          <Flag className="h-4 w-4 shrink-0 text-brand" />
          <span className="truncate">{destinationLabel ?? "Choose a destination"}</span>
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {distance !== null && (
          <span className="flex items-center gap-1.5 rounded-full bg-brand/8 px-3 py-1.5 text-xs font-medium text-ink">
            <Route className="h-3.5 w-3.5 text-brand" />
            {formatDistance(distance)}
          </span>
        )}
        {etaMinutes !== null && (
          <span className="flex items-center gap-1.5 rounded-full bg-brand/8 px-3 py-1.5 text-xs font-medium text-ink">
            <Clock className="h-3.5 w-3.5 text-brand" />
            {formatWalkTime(etaMinutes)}
          </span>
        )}

        <button
          type="button"
          onClick={toggleWheelchairMode}
          aria-pressed={wheelchairMode}
          title="Wheelchair-accessible routing (avoids stairs)"
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
            wheelchairMode ? "bg-accent-green text-white" : "bg-brand/8 text-ink hover:bg-brand/15",
          )}
        >
          <Accessibility className="h-3.5 w-3.5" />
          Accessible
        </button>
      </div>
    </div>
  );
}
