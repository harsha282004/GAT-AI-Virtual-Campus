"use client";

import { Maximize, PanelLeft, PanelLeftClose, RotateCcw, SkipBack, SkipForward } from "lucide-react";

import { cn } from "@/utils";

interface TourControlsProps {
  onNext: () => void;
  onPrevious: () => void;
  onReset: () => void;
  onFullscreen: () => void;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

function ControlButton({
  icon: Icon,
  label,
  onClick,
  active = false,
}: {
  icon: typeof Maximize;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={cn(
        "flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium shadow-soft transition-all duration-200 hover:-translate-y-0.5 dark:shadow-black/30",
        active
          ? "bg-brand text-white hover:bg-brand-dark"
          : "bg-white text-ink hover:bg-brand hover:text-white dark:bg-[#0F172A]",
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

export function TourControls({
  onNext,
  onPrevious,
  onReset,
  onFullscreen,
  sidebarCollapsed,
  onToggleSidebar,
}: TourControlsProps) {
  return (
    <div className="glass flex flex-wrap items-center justify-center gap-3 rounded-full px-3 py-2 shadow-soft">
      <ControlButton
        icon={sidebarCollapsed ? PanelLeft : PanelLeftClose}
        label={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
        onClick={onToggleSidebar}
        active={sidebarCollapsed}
      />
      <ControlButton icon={SkipBack} label="Previous" onClick={onPrevious} />
      <ControlButton icon={RotateCcw} label="Reset View" onClick={onReset} />
      <ControlButton icon={Maximize} label="Fullscreen" onClick={onFullscreen} />
      <ControlButton icon={SkipForward} label="Next" onClick={onNext} />
    </div>
  );
}
