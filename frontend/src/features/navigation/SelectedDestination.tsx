"use client";

import { Flag, X } from "lucide-react";

import { useNavigationStore } from "@/store";

export function SelectedDestination() {
  const destinationLabel = useNavigationStore((state) => state.destinationLabel);
  const destinationType = useNavigationStore((state) => state.destinationType);
  const setDestination = useNavigationStore((state) => state.setDestination);

  return (
    <div>
      <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gat-navy/60 dark:text-white/60">
        <Flag className="h-3.5 w-3.5" />
        Destination
      </label>

      {destinationLabel ? (
        <div className="flex items-center justify-between rounded-xl border border-gat-maroon/30 bg-gat-maroon/5 px-4 py-2.5">
          <div>
            <p className="text-sm font-medium text-gat-navy dark:text-white">{destinationLabel}</p>
            <p className="text-xs capitalize text-gat-navy/50 dark:text-white/50">
              {destinationType}
            </p>
          </div>
          <button
            type="button"
            aria-label="Clear destination"
            onClick={() => setDestination(null, null, null)}
            className="flex h-7 w-7 items-center justify-center rounded-full text-gat-navy/40 transition-colors hover:bg-white hover:text-gat-maroon dark:text-white/40 dark:hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-gat-navy/15 px-4 py-2.5 text-sm text-gat-navy/40 dark:border-white/15 dark:text-white/40">
          No destination selected yet
        </p>
      )}
    </div>
  );
}
