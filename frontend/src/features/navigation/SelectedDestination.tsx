"use client";

import { Flag, X } from "lucide-react";

import { useNavigationStore } from "@/store";

export function SelectedDestination() {
  const destinationLabel = useNavigationStore((state) => state.destinationLabel);
  const destinationType = useNavigationStore((state) => state.destinationType);
  const setDestination = useNavigationStore((state) => state.setDestination);

  return (
    <div>
      <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
        <Flag className="h-3.5 w-3.5" />
        Destination
      </label>

      {destinationLabel ? (
        <div className="flex items-center justify-between rounded-xl border border-brand/30 bg-brand/5 px-4 py-2.5">
          <div>
            <p className="text-sm font-medium text-ink">{destinationLabel}</p>
            <p className="text-xs capitalize text-muted">{destinationType}</p>
          </div>
          <button
            type="button"
            aria-label="Clear destination"
            onClick={() => setDestination(null, null, null)}
            className="flex h-7 w-7 items-center justify-center rounded-full text-muted transition-colors hover:bg-white hover:text-brand"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-hairline px-4 py-2.5 text-sm text-muted">
          No destination selected yet
        </p>
      )}
    </div>
  );
}
