"use client";

import { AlertTriangle, MapPin, X } from "lucide-react";

interface UserLocationStatusBannerProps {
  message: string;
  tone: "warning" | "info";
  onDismiss: () => void;
}

/** Phase 18 — the friendly denied/unavailable/unsupported messages
 * (Section "USER EXPERIENCE") and the "outside campus area" hint
 * (Section "CAMPUS BOUNDARY HANDLING"), rendered the same way so both
 * fit this app's existing alert styling (compare
 * BuildingGeoInfoPanel.tsx's inline amber note). */
export function UserLocationStatusBanner({ message, tone, onDismiss }: UserLocationStatusBannerProps) {
  const toneClasses =
    tone === "warning"
      ? "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
      : "bg-brand/10 text-brand";

  return (
    <div
      className={`pointer-events-auto flex items-start gap-2 rounded-2xl px-3 py-2.5 text-xs shadow-soft ${toneClasses}`}
    >
      {tone === "warning" ? (
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      ) : (
        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      )}
      <p className="flex-1 leading-relaxed">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="shrink-0 rounded-full p-0.5 opacity-70 transition-opacity hover:opacity-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
