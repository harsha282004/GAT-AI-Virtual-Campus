"use client";

import { Footprints, Sparkles } from "lucide-react";

import { useTranslation } from "@/hooks";
import { cn } from "@/utils";

export type TourMode = "manual" | "guided";

interface TourModeToggleProps {
  mode: TourMode;
  onChange: (mode: TourMode) => void;
}

/** Sprint 3 Step 1 — switches between Manual Tour (unchanged, Sprint 1/2
 * hotspot-driven walking) and Guided Tour (Sprint 3's automatic walk). */
export function TourModeToggle({ mode, onChange }: TourModeToggleProps) {
  const { t } = useTranslation();
  return (
    <div className="glass inline-flex items-center gap-1.5 rounded-full p-1.5 shadow-soft">
      <button
        type="button"
        aria-pressed={mode === "manual"}
        onClick={() => onChange("manual")}
        className={cn(
          "flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-all duration-200",
          mode === "manual" ? "bg-brand text-white" : "text-ink hover:bg-brand/10",
        )}
      >
        <Footprints className="h-4 w-4" />
        {t("Manual Tour")}
      </button>
      <button
        type="button"
        aria-pressed={mode === "guided"}
        onClick={() => onChange("guided")}
        className={cn(
          "flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-all duration-200",
          mode === "guided" ? "bg-brand text-white" : "text-ink hover:bg-brand/10",
        )}
      >
        <Sparkles className="h-4 w-4" />
        {t("Guided Tour")}
      </button>
    </div>
  );
}
