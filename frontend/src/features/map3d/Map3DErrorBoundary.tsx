"use client";

import { AlertTriangle } from "lucide-react";
import { Component, type ReactNode } from "react";

interface Map3DErrorBoundaryProps {
  children: ReactNode;
}

interface Map3DErrorBoundaryState {
  hasError: boolean;
}

/** A WebGL/Three.js render failure must not crash the rest of the site
 * (Section 24) — React error boundaries can only be class components, so
 * this one stays a class deliberately, unlike everything else in this
 * feature. Wraps ONLY the 3D canvas subtree in map3d/Map3DCampusView.tsx;
 * the surrounding page chrome (Navbar, sidebar, info panel) is outside it
 * and keeps working even if the canvas itself throws. */
export class Map3DErrorBoundary extends Component<Map3DErrorBoundaryProps, Map3DErrorBoundaryState> {
  state: Map3DErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): Map3DErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("3D Campus Map failed to render:", error);
  }

  render() {
    if (this.state.hasError) {
      return <Map3DUnavailable />;
    }
    return this.props.children;
  }
}

export function Map3DUnavailable() {
  return (
    <div className="flex h-[calc(100vh-7rem)] min-w-0 flex-1 flex-col items-center justify-center gap-4 rounded-3xl border border-hairline bg-white p-8 text-center shadow-soft dark:bg-[#0F172A] dark:shadow-black/30">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 dark:bg-rose-900/40">
        <AlertTriangle className="h-7 w-7 text-rose-500 dark:text-rose-400" />
      </span>
      <div>
        <p className="font-display text-lg font-semibold text-ink">
          3D Map is unavailable on this device
        </p>
        <p className="mt-1 max-w-sm text-sm text-muted">
          Your browser or device could not render the interactive 3D campus map. Try a different
          browser, or update your graphics drivers.
        </p>
      </div>
    </div>
  );
}

/** Cheap, synchronous WebGL availability check — checked BEFORE mounting
 * <Canvas> at all, so an unsupported device never even attempts a
 * WebGLRenderer construction (which can throw asynchronously in ways an
 * error boundary alone won't always catch cleanly). */
export function isWebGLAvailable(): boolean {
  if (typeof window === "undefined") return true; // SSR — assume yes, real check runs client-side
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext("webgl2") || canvas.getContext("webgl")),
    );
  } catch {
    return false;
  }
}
