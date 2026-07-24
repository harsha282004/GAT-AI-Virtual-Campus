"use client";

import { Maximize, RotateCcw, SkipBack, SkipForward } from "lucide-react";

interface TourControlsProps {
  onNext: () => void;
  onPrevious: () => void;
  onReset: () => void;
  onFullscreen: () => void;
}

function ControlButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Maximize;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-medium text-ink shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand hover:text-white"
    >
      <Icon className="h-4 w-4" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

export function TourControls({ onNext, onPrevious, onReset, onFullscreen }: TourControlsProps) {
  return (
    <div className="glass flex flex-wrap items-center justify-center gap-3 rounded-full px-3 py-2 shadow-soft">
      <ControlButton icon={SkipBack} label="Previous" onClick={onPrevious} />
      <ControlButton icon={RotateCcw} label="Reset View" onClick={onReset} />
      <ControlButton icon={Maximize} label="Fullscreen" onClick={onFullscreen} />
      <ControlButton icon={SkipForward} label="Next" onClick={onNext} />
    </div>
  );
}
