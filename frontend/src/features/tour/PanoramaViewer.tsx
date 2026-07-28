"use client";

import dynamic from "next/dynamic";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";

import { ErrorState, Spinner } from "@/components/ui";
import { cn } from "@/utils";
import type { HotspotDirection, TourHotspot, TourPanorama } from "@/types";
import type { Pannellum as PannellumClass } from "pannellum-react";

// Pannellum touches `window`/`document` at module load, so it must never be
// evaluated during SSR — dynamic + ssr:false defers the import to the browser.
// next/dynamic's inferred type for a class component drops ref support, but at
// runtime this resolves to the real class (which does accept a ref) — cast
// back to the real type rather than losing ref typing entirely.
const Pannellum = dynamic(() => import("pannellum-react").then((mod) => mod.Pannellum), {
  ssr: false,
}) as unknown as typeof PannellumClass;

/**
 * Inert marker used only to carry hotspot config as React element `.props` —
 * pannellum-react's own `Pannellum.Hotspot` is never actually mounted either
 * (see its source: children are inspected for `.props`, not rendered), so a
 * local marker avoids importing the class-based library eagerly for typing.
 */
type HotspotMarkerProps = {
  type: "custom";
  pitch?: number;
  yaw?: number;
  tooltip?: (hotSpotDiv: HTMLElement, args: unknown) => void;
  handleClick?: (event: MouseEvent, args: unknown) => void;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- props exist only for typed JSX usage; see comment above
function HotspotMarker(props: HotspotMarkerProps) {
  return null;
}

export interface PanoramaViewerHandle {
  resetView: () => void;
  toggleFullscreen: () => void;
  /** Live camera angle right now — used by the minimap's live heading marker. */
  getCurrentView: () => { yaw: number; pitch: number } | null;
}

export interface HotspotNavigationContext {
  yaw?: number;
  pitch?: number;
}

interface PanoramaViewerProps {
  panorama: TourPanorama;
  onHotspotClick: (targetId: string, context: HotspotNavigationContext) => void;
  autoRotate?: boolean;
  className?: string;
}

// Street View-style floating chevron, reused (rotated) for the four
// cardinal directions; the rest keep a plain glyph — a full custom icon set
// for every direction is future work, not required for the core "premium
// nav arrow" feel these four cover almost all real traffic through.
function chevronSvg(rotationDeg: number): string {
  return `<svg width="20" height="20" viewBox="0 0 24 24" style="transform:rotate(${rotationDeg}deg)" aria-hidden="true">
    <path d="M12 4 L19.5 15 L15 15 L15 20 L9 20 L9 15 L4.5 15 Z" fill="white"/>
  </svg>`;
}

const HOTSPOT_META: Record<HotspotDirection, { bg: string; icon: string }> = {
  forward: { bg: "bg-brand", icon: chevronSvg(0) },
  back: { bg: "bg-brand", icon: chevronSvg(180) },
  left: { bg: "bg-brand", icon: chevronSvg(-90) },
  right: { bg: "bg-brand", icon: chevronSvg(90) },
  upstairs: { bg: "bg-accent-green", icon: '<span style="font-size:18px;line-height:1">⤴</span>' },
  downstairs: { bg: "bg-accent-green", icon: '<span style="font-size:18px;line-height:1">⤵</span>' },
  elevator: { bg: "bg-accent-green", icon: '<span style="font-size:18px;line-height:1">⬍</span>' },
  enter_room: { bg: "bg-accent-purple", icon: '<span style="font-size:18px;line-height:1">⏎</span>' },
  exit_room: { bg: "bg-accent-purple", icon: '<span style="font-size:18px;line-height:1">⏏</span>' },
};

// pannellum-react falls back to a default of 10 whenever a hotspot's pitch/yaw
// prop is falsy — which incorrectly swallows a legitimate value of exactly 0.
function safeAngle(value: number): number {
  return value === 0 ? 0.001 : value;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

/**
 * Street View-style floating nav arrow: label hidden until hover, a
 * circular chevron badge with a soft ground shadow beneath it (billboards
 * to face the camera for free — that's pannellum's own hotspot positioning,
 * not something this markup has to do). Also wires up basic a11y (role,
 * label, keyboard activation) and honors prefers-reduced-motion by dropping
 * the pulse/entrance animation, both directly on the DOM node pannellum
 * hands us here since it isn't a React tree.
 */
function buildTooltip(hotspot: TourHotspot, onActivate: () => void) {
  return (hotSpotDiv: HTMLElement) => {
    const meta = HOTSPOT_META[hotspot.type];
    const reducedMotion = prefersReducedMotion();

    hotSpotDiv.innerHTML = `
      <div class="group relative flex flex-col items-center">
        <div class="pointer-events-none mb-1.5 -translate-y-1 whitespace-nowrap rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-medium text-white opacity-0 shadow-lg backdrop-blur-sm transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">
          ${hotspot.label}
        </div>
        <div class="relative flex items-center justify-center${reducedMotion ? "" : " tour-hotspot-enter"}">
          ${
            reducedMotion
              ? ""
              : `<span class="pointer-events-none absolute inline-flex h-12 w-12 animate-ping rounded-full ${meta.bg} opacity-25"></span>`
          }
          <div class="relative flex h-11 w-11 items-center justify-center rounded-full ${meta.bg} shadow-[0_6px_16px_rgba(0,0,0,0.4)] ring-2 ring-white/80 transition-transform duration-200 group-hover:scale-110">
            ${meta.icon}
          </div>
          <div class="absolute -bottom-2 left-1/2 h-2 w-8 -translate-x-1/2 rounded-full bg-black/30 blur-[3px]"></div>
        </div>
      </div>
    `;

    hotSpotDiv.setAttribute("role", "button");
    hotSpotDiv.setAttribute("aria-label", `Go ${hotspot.label}`);
    hotSpotDiv.tabIndex = 0;
    hotSpotDiv.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onActivate();
      }
    });
  };
}

export const PanoramaViewer = forwardRef<PanoramaViewerHandle, PanoramaViewerProps>(
  function PanoramaViewer({ panorama, onHotspotClick, autoRotate = false, className }, ref) {
    const viewerRef = useRef<PannellumClass | null>(null);
    const [loaded, setLoaded] = useState(false);
    const [loadError, setLoadError] = useState(false);
    const [retryToken, setRetryToken] = useState(0);
    const [veilVisible, setVeilVisible] = useState(false);
    const headingBadgeRef = useRef<HTMLSpanElement | null>(null);

    useEffect(() => {
      setLoaded(false);
      setLoadError(false);
      setVeilVisible(true);
    }, [panorama.id]);

    // Lift the transition veil once the new scene has actually painted, plus
    // a small grace window so even an instant (cache-warm) load still reads
    // as a deliberate transition rather than a flicker.
    useEffect(() => {
      if (!loaded) return;
      const timer = setTimeout(() => setVeilVisible(false), 120);
      return () => clearTimeout(timer);
    }, [loaded]);

    function resetView() {
      viewerRef.current?.getViewer().lookAt(panorama.pitch, panorama.yaw, panorama.hfov, 800);
    }

    useImperativeHandle(
      ref,
      () => ({
        resetView,
        toggleFullscreen: () => {
          viewerRef.current?.getViewer().toggleFullscreen();
        },
        getCurrentView: () => {
          const viewer = viewerRef.current?.getViewer();
          if (!viewer) return null;
          return { yaw: viewer.getYaw(), pitch: viewer.getPitch() };
        },
      }),
      // eslint-disable-next-line react-hooks/exhaustive-deps -- resetView closes over panorama.{pitch,yaw,hfov} directly
      [panorama.pitch, panorama.yaw, panorama.hfov],
    );

    function handleRetry() {
      setLoaded(false);
      setLoadError(false);
      setRetryToken((token) => token + 1);
    }

    // Pannellum's compass is a purely visual heading indicator with no
    // built-in interactivity — clicking it to reset the view is our own
    // addition. Delegated on the wrapper (rather than queried/attached via
    // an effect) since the compass DOM element is destroyed and recreated
    // by pannellum on every scene change; delegation survives that for free.
    function handleWrapperClick(event: ReactMouseEvent<HTMLDivElement>) {
      if ((event.target as HTMLElement).closest(".pnlm-compass")) {
        resetView();
      }
    }

    // Runs every animation frame while the viewer is moving. Deliberately
    // mutates the DOM directly instead of setState — a per-frame React
    // re-render of the whole tour page would fight the "60fps, no jank"
    // requirement it exists to serve.
    function handleRender() {
      const viewer = viewerRef.current?.getViewer();
      const badge = headingBadgeRef.current;
      if (!viewer || !badge) return;
      const heading = Math.round((((-viewer.getYaw() % 360) + 360) % 360) / 1);
      badge.textContent = `${heading}°`;
    }

    // Stable across every re-render (empty deps) — critical, not just tidy:
    // an inline arrow function here would get a new identity on every
    // render, and React detaches+reattaches a ref whenever its callback
    // identity changes (calling it with null, then the instance, again).
    // That was silently destroying the *current* pannellum instance (see
    // the destroy() comment below) on the very next unrelated re-render of
    // this component — e.g. a parent state update from the mouse-move idle
    // timer — leaving a blank canvas with no console error, since destroy()
    // itself doesn't throw. useCallback is what makes the destroy-on-
    // unmount fix below safe to have at all.
    const setViewerRef = useCallback((instance: PannellumClass | null) => {
      if (instance === null) {
        // pannellum-react has no componentWillUnmount — without this, every
        // scene change (each a full remount via the key below) leaks the
        // outgoing instance's WebGL context plus several document/window-
        // level event listeners it registers (mousemove, mouseup, resize,
        // ...). Calling destroy() ourselves here, on the outgoing ref, is
        // the only place that actually happens. React nulls the departing
        // element's ref before setting the incoming element's ref, so
        // viewerRef.current here is still the *old* instance.
        viewerRef.current?.getViewer()?.destroy();
      }
      viewerRef.current = instance;
    }, []);

    return (
      <div
        className={cn("relative overflow-hidden rounded-3xl bg-[#16213E]", className)}
        onClick={handleWrapperClick}
      >
        {!loaded && !loadError && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#16213E]/90">
            <Spinner label="Loading panorama…" />
          </div>
        )}

        {loadError && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#16213E] p-6">
            <ErrorState
              title="This panorama couldn't be loaded"
              message="The image may be missing or your connection dropped. Try again."
              onRetry={handleRetry}
              className="max-w-sm border-none bg-white/5 backdrop-blur"
            />
          </div>
        )}

        {/* Scene-transition veil: fades to a blurred preview of the destination
            rather than an instant hard cut, and back out once it has painted —
            deliberately not a live dual-canvas crossfade (2x GPU/WebGL context
            cost for marginal gain here) but reads the same to the eye. */}
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 z-30 bg-cover bg-center transition-opacity duration-300 ease-out",
            veilVisible ? "opacity-100" : "opacity-0",
          )}
          style={{
            backgroundImage: panorama.previewImage ? `url(${panorama.previewImage})` : undefined,
            backgroundColor: "#16213E",
            filter: "blur(6px) brightness(0.7)",
          }}
        />

        {!loadError && (
          <Pannellum
            key={`${panorama.id}-${retryToken}`}
            ref={setViewerRef}
            width="100%"
            height="100%"
            image={panorama.image}
            preview={panorama.previewImage ?? undefined}
            yaw={panorama.yaw}
            pitch={panorama.pitch}
            hfov={panorama.hfov}
            autoLoad
            compass
            showZoomCtrl
            showFullscreenCtrl={false}
            draggable
            mouseZoom
            keyboardZoom
            autoRotate={autoRotate ? -2 : 0}
            onLoad={() => setLoaded(true)}
            onError={() => setLoadError(true)}
            onRender={handleRender}
          >
            {panorama.hotspots.map((hotspot, index) => {
              const activate = () =>
                onHotspotClick(hotspot.targetId, {
                  yaw: hotspot.entryYaw,
                  pitch: hotspot.entryPitch,
                });
              return (
                <HotspotMarker
                  key={`${panorama.id}-${index}`}
                  type="custom"
                  pitch={safeAngle(hotspot.pitch)}
                  yaw={safeAngle(hotspot.yaw)}
                  tooltip={buildTooltip(hotspot, activate)}
                  handleClick={activate}
                />
              );
            })}
          </Pannellum>
        )}

        {!loadError && (
          <span
            ref={headingBadgeRef}
            aria-hidden="true"
            className="pointer-events-none absolute bottom-[62px] right-1 z-10 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-white/90 backdrop-blur-sm"
          >
            0°
          </span>
        )}
      </div>
    );
  },
);
