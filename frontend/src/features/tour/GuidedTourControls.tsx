"use client";

import { Pause, Play, RotateCcw, Square } from "lucide-react";

import { useTranslation } from "@/hooks";
import { cn } from "@/utils";
import type { GuidedTourSpeed, GuidedTourStatus } from "@/features/tour/engine";

interface GuidedTourControlsProps {
  status: GuidedTourStatus;
  speed: GuidedTourSpeed;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onRestart: () => void;
  onSpeedChange: (speed: GuidedTourSpeed) => void;
}

const SPEED_OPTIONS: { value: GuidedTourSpeed; label: string }[] = [
  { value: "slow", label: "Slow" },
  { value: "normal", label: "Normal" },
  { value: "fast", label: "Fast" },
];

/** Sprint 3 Step 9 — Start / Pause / Resume / Stop / Restart + speed. Which
 * action buttons show depends only on `status` (idle/stopped/error/completed
 * -> Start; playing -> Pause+Stop+Restart; paused -> Resume+Stop+Restart). */
export function GuidedTourControls({
  status,
  speed,
  onStart,
  onPause,
  onResume,
  onStop,
  onRestart,
  onSpeedChange,
}: GuidedTourControlsProps) {
  const canRestart = status === "playing" || status === "paused" || status === "completed";
  const { t } = useTranslation();

  return (
    <div className="glass flex flex-wrap items-center justify-center gap-3 rounded-full px-3 py-2 shadow-soft">
      {status === "playing" ? (
        <button
          type="button"
          onClick={onPause}
          className="flex items-center gap-2 rounded-full bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-soft hover:bg-brand-dark"
        >
          <Pause className="h-4 w-4" />
          <span className="hidden sm:inline">{t("Pause")}</span>
        </button>
      ) : status === "paused" ? (
        <button
          type="button"
          onClick={onResume}
          className="flex items-center gap-2 rounded-full bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-soft hover:bg-brand-dark"
        >
          <Play className="h-4 w-4" />
          <span className="hidden sm:inline">{t("Resume")}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={onStart}
          className="flex items-center gap-2 rounded-full bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-soft hover:bg-brand-dark"
        >
          <Play className="h-4 w-4" />
          <span className="hidden sm:inline">{t("Start Guided Tour")}</span>
        </button>
      )}

      {(status === "playing" || status === "paused") && (
        <button
          type="button"
          onClick={onStop}
          aria-label={t("Stop")}
          title={t("Stop")}
          className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-medium text-ink shadow-soft hover:bg-brand hover:text-white dark:bg-[#0F172A]"
        >
          <Square className="h-4 w-4" />
          <span className="hidden sm:inline">{t("Stop")}</span>
        </button>
      )}

      {canRestart && (
        <button
          type="button"
          onClick={onRestart}
          aria-label={t("Restart")}
          title={t("Restart")}
          className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-medium text-ink shadow-soft hover:bg-brand hover:text-white dark:bg-[#0F172A]"
        >
          <RotateCcw className="h-4 w-4" />
          <span className="hidden sm:inline">{t("Restart")}</span>
        </button>
      )}

      <div className="flex items-center gap-1 rounded-full bg-white/60 p-1 dark:bg-[#0F172A]/60">
        {SPEED_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={speed === option.value}
            onClick={() => onSpeedChange(option.value)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              speed === option.value ? "bg-brand text-white" : "text-ink/70 hover:text-ink",
            )}
          >
            {t(option.label)}
          </button>
        ))}
      </div>
    </div>
  );
}
