import { useEffect } from "react";

interface TourKeyboardHandlers {
  onReset: () => void;
  onFullscreen: () => void;
  onToggleImmersive: () => void;
}

/**
 * Global keyboard shortcuts for the tour page: R resets the view, F toggles
 * fullscreen, Space toggles immersive (chrome-hidden) mode. Escape isn't
 * handled here — exiting fullscreen on Escape is native Fullscreen API
 * behavior that Pannellum's toggleFullscreen already relies on, so adding
 * our own listener would just race it. Ignored while a text input has focus
 * so it doesn't fight search boxes elsewhere on the page.
 *
 * Deliberately does NOT bind arrow keys or WASD to scene navigation:
 * Pannellum's own viewer captures those natively to pan/look around once its
 * container has focus, which happens on every click/drag. A second global
 * listener on the same keys fought it — pressing an arrow key would both pan
 * the camera and jump scenes at once, which was the "doesn't rotate
 * consistently" symptom this was implicated in. Scene stepping stays
 * available via the on-screen Previous/Next controls instead.
 */
export function useTourKeyboardShortcuts({
  onReset,
  onFullscreen,
  onToggleImmersive,
}: TourKeyboardHandlers): void {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;

      switch (event.key) {
        case "r":
        case "R":
          onReset();
          break;
        case "f":
        case "F":
          onFullscreen();
          break;
        case " ":
          onToggleImmersive();
          break;
        default:
          return;
      }
      event.preventDefault();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onReset, onFullscreen, onToggleImmersive]);
}
