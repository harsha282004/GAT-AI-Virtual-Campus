"use client";

import { Eye, EyeOff } from "lucide-react";

interface ImmersiveToggleProps {
  active: boolean;
  onToggle: () => void;
}

/**
 * Deliberately rendered outside the rest of the tour chrome (which this
 * button controls the visibility of) and never subject to auto-hide-on-idle
 * itself — otherwise turning immersive mode on, or waiting it out idle,
 * would hide the only way back.
 */
export function ImmersiveToggle({ active, onToggle }: ImmersiveToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      aria-label={active ? "Exit immersive mode" : "Enter immersive mode"}
      title={active ? "Exit immersive mode (Space)" : "Immersive mode (Space)"}
      className="glass flex h-10 w-10 items-center justify-center rounded-full text-ink/70 shadow-soft transition-colors hover:text-brand"
    >
      {active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );
}
