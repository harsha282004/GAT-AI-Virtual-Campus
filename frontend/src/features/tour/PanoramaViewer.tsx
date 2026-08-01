"use client";

import dynamic from "next/dynamic";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { SyntheticEvent } from "react";

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
  /** Sprint 3 Guided Tour — smooth eased yaw rotation (reuses pannellum's own
   * animateTo easing, same mechanism resetView already relies on). Resolves
   * once the animation completes; resolves immediately if the viewer isn't
   * mounted (defensive — Step 17, never hang the tour on a torn-down view). */
  rotateBy: (deltaDeg: number, durationMs: number) => Promise<void>;
  rotateTo: (yawDeg: number, durationMs: number) => Promise<void>;
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
  /** false while the Guided Tour (Sprint 3) is driving the camera itself —
   * hotspots stay visible but stop responding, so a stray click can't fight
   * the automatic walk sequence. Defaults to true (Manual Tour, unchanged). */
  interactionsEnabled?: boolean;
  /** Dev-only cross-floor hotspot placement tool: while true, a click
   * anywhere on the panorama reports the (yaw, pitch) under the cursor
   * instead of dragging/navigating. Defaults to false (production path
   * untouched). */
  placementModeActive?: boolean;
  onPlacementPick?: (yaw: number, pitch: number) => void;
  /** Dev-only authoring reference overlay: when provided (even as an empty
   * array), every project-wide cross-floor hotspot renders here — not just
   * this scene's own — for use as a visual reference while placing new
   * ones. Replaces (not adds to) the normal per-scene cross_floor entries
   * from `panorama.hotspots`, so nothing is ever double-rendered. `undefined`
   * (the default) means normal runtime: only this scene's own hotspots,
   * exactly as before this feature existed. */
  editorCrossFloorHotspots?: AuthoringCrossFloorHotspot[];
  onEditCrossFloorHotspot?: (hotspotId: number) => void;
}

export interface AuthoringCrossFloorHotspot {
  id: number;
  sourceSceneId: string;
  targetSceneId: string;
  yaw: number;
  pitch: number;
  label: string | null;
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

// Manual Tour hotspots (Sprint 2) share one professional look — small,
// semi-transparent white by default, blue glow + scale on hover — and are
// told apart only by icon glyph, never by badge color.
const HOTSPOT_META: Record<HotspotDirection, { icon: string }> = {
  forward: { icon: chevronSvg(0) },
  back: { icon: chevronSvg(180) },
  left: { icon: chevronSvg(-90) },
  right: { icon: chevronSvg(90) },
  opposite: { icon: '<span style="font-size:15px;line-height:1">⇄</span>' },
  upstairs: { icon: '<span style="font-size:16px;line-height:1">⤴</span>' },
  downstairs: { icon: '<span style="font-size:16px;line-height:1">⤵</span>' },
  elevator: { icon: '<span style="font-size:16px;line-height:1">⬍</span>' },
  enter_room: { icon: '<span style="font-size:16px;line-height:1">⏎</span>' },
  exit_room: { icon: '<span style="font-size:16px;line-height:1">⏏</span>' },
  // Deliberately the plainest glyph of the set — a cross-floor sightline
  // hotspot must read as subtle/"looks inactive" by default (Step 6), never
  // competing visually with the Forward/Back arrows that drive the walk.
  cross_floor: { icon: '<span style="font-size:14px;line-height:1">↗</span>' },
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

/** Flashes the ripple ring on a badge, per Sprint 2 Step 10's click animation
 * (removes itself on animationend so it can replay on the next click). */
function playRipple(container: HTMLElement) {
  const ripple = container.querySelector(".tour-hotspot-ripple");
  if (!ripple) return;
  ripple.classList.remove("is-rippling");
  // Force reflow so re-adding the class restarts the animation.
  void (ripple as HTMLElement).offsetWidth;
  ripple.classList.add("is-rippling");
  ripple.addEventListener("animationend", () => ripple.classList.remove("is-rippling"), {
    once: true,
  });
}

/**
 * Street View-style floating nav badge: label hidden until hover, a small
 * semi-transparent white circle that glows blue and scales on hover, ripples
 * on click. Also wires up basic a11y (role, label, keyboard activation) and
 * honors prefers-reduced-motion, both directly on the DOM node pannellum
 * hands us here since it isn't a React tree.
 *
 * `elevator` hotspots with more than one floor option render a small
 * floor-select list instead of navigating on the badge itself (Sprint 2
 * Step 8) — each option stops propagation so it doesn't also trigger the
 * outer badge's own click handler (pannellum attaches one click listener to
 * the whole hotspot div, so any inner click bubbles into it too).
 */
function buildTooltip(hotspot: TourHotspot, onSelect: (targetId: string) => void) {
  return (hotSpotDiv: HTMLElement) => {
    const meta = HOTSPOT_META[hotspot.type];
    const reducedMotion = prefersReducedMotion();
    const floorOptions = hotspot.type === "elevator" ? hotspot.floorOptions : undefined;
    const hasFloorMenu = !!floorOptions && floorOptions.length > 1;
    // Cross-floor sightline hotspots stay deliberately subtle at rest —
    // smaller, dimmer, no entrance ping/shadow — and only fully "arrive"
    // on hover (Step 6: default "looks inactive", hover "brighten,
    // increase opacity, small glow, scale slightly larger").
    const isCrossFloor = hotspot.type === "cross_floor";

    const badgeLabel = hasFloorMenu ? "Select Floor" : hotspot.label;

    const badgeSizeClass = isCrossFloor ? "h-6 w-6" : "h-9 w-9";
    const badgeRestClass = isCrossFloor
      ? "bg-white/10 opacity-55 shadow-none ring-1 ring-white/30"
      : "bg-white/25 shadow-[0_4px_14px_rgba(0,0,0,0.35)] ring-1 ring-white/60";
    const badgeHoverClass = isCrossFloor
      ? "group-hover:scale-125 group-hover:opacity-100 group-hover:bg-sky-500/60 group-hover:shadow-[0_0_14px_rgba(56,142,255,0.75)] group-hover:ring-sky-200"
      : "group-hover:scale-125 group-hover:bg-sky-500/70 group-hover:shadow-[0_0_18px_rgba(56,142,255,0.85)] group-hover:ring-sky-200";

    hotSpotDiv.innerHTML = `
      <div class="group relative flex flex-col items-center">
        <div class="pointer-events-none mb-1.5 -translate-y-1 whitespace-nowrap rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-medium text-white opacity-0 shadow-lg backdrop-blur-sm transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">
          ${badgeLabel}
        </div>
        <div class="relative flex items-center justify-center${reducedMotion || isCrossFloor ? "" : " tour-hotspot-enter"}">
          ${
            reducedMotion || isCrossFloor
              ? ""
              : `<span class="pointer-events-none absolute inline-flex h-10 w-10 animate-ping rounded-full bg-white/30 opacity-25"></span>`
          }
          <span class="tour-hotspot-ripple pointer-events-none absolute inline-flex h-9 w-9 rounded-full bg-sky-300/70"></span>
          <div class="relative flex ${badgeSizeClass} items-center justify-center rounded-full ${badgeRestClass} text-white backdrop-blur-md transition-all duration-200 ease-out ${badgeHoverClass}">
            ${meta.icon}
          </div>
          ${isCrossFloor ? "" : '<div class="absolute -bottom-2 left-1/2 h-2 w-8 -translate-x-1/2 rounded-full bg-black/30 blur-[3px]"></div>'}
        </div>
        ${
          hasFloorMenu
            ? `<ul class="tour-floor-menu pointer-events-auto absolute top-full mt-2 hidden min-w-[140px] flex-col overflow-hidden rounded-xl bg-black/80 text-xs text-white shadow-xl backdrop-blur-md group-hover:flex">
                ${floorOptions
                  .map(
                    (opt) =>
                      `<li><button type="button" data-target-id="${opt.sceneId}" class="tour-floor-option block w-full px-3 py-2 text-left transition-colors hover:bg-sky-500/60">${opt.label}</button></li>`,
                  )
                  .join("")}
              </ul>`
            : ""
        }
      </div>
    `;

    if (hasFloorMenu) {
      hotSpotDiv.querySelectorAll<HTMLButtonElement>(".tour-floor-option").forEach((button) => {
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          playRipple(hotSpotDiv);
          onSelect(button.dataset.targetId ?? hotspot.targetId);
        });
      });
    }

    hotSpotDiv.setAttribute("role", "button");
    hotSpotDiv.setAttribute("aria-label", hasFloorMenu ? "Select floor" : `Go ${hotspot.label}`);
    hotSpotDiv.tabIndex = 0;
    hotSpotDiv.addEventListener("keydown", (event) => {
      if ((event.key === "Enter" || event.key === " ") && !hasFloorMenu) {
        event.preventDefault();
        playRipple(hotSpotDiv);
        onSelect(hotspot.targetId);
      }
    });
  };
}

/**
 * Authoring-overlay marker (dev-only): every project-wide cross-floor
 * hotspot, not just this scene's own. Deliberately camouflaged — a small,
 * glassy, near-invisible dot at rest (25-35% opacity, pale blue/white tint,
 * thin white outline, soft shadow, no solid color fill) that only "arrives"
 * on hover (brighten, scale up slightly, soft glow), so it reads as a
 * hidden reference marker rather than a loud icon. Clicking opens
 * edit/delete, never navigates — authoring, not touring.
 */
function buildAuthoringTooltip(hotspot: AuthoringCrossFloorHotspot, isOwnScene: boolean, onEdit: () => void) {
  return (hotSpotDiv: HTMLElement) => {
    const badgeLabel = hotspot.label ?? `→ scene ${hotspot.targetSceneId}`;

    hotSpotDiv.innerHTML = `
      <div class="group relative flex flex-col items-center">
        <div class="pointer-events-none mb-1.5 -translate-y-1 whitespace-nowrap rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-medium text-white opacity-0 shadow-lg backdrop-blur-sm transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">
          ${badgeLabel}${isOwnScene ? " (this scene)" : ""}
        </div>
        <div class="relative flex h-5 w-5 items-center justify-center rounded-full bg-white/10 opacity-30 shadow-[0_1px_6px_rgba(0,0,0,0.25)] ring-1 ring-white/50 backdrop-blur-md transition-all duration-200 ease-out group-hover:scale-125 group-hover:bg-sky-100/30 group-hover:opacity-100 group-hover:shadow-[0_0_12px_rgba(186,230,253,0.65)] group-hover:ring-white/80">
          <span class="text-white" style="font-size:10px;line-height:1">✎</span>
        </div>
      </div>
    `;
    hotSpotDiv.setAttribute("role", "button");
    hotSpotDiv.setAttribute("aria-label", `Edit cross-floor hotspot: ${badgeLabel}`);
    hotSpotDiv.tabIndex = 0;
    hotSpotDiv.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onEdit();
      }
    });
  };
}

export const PanoramaViewer = forwardRef<PanoramaViewerHandle, PanoramaViewerProps>(
  function PanoramaViewer(
    {
      panorama,
      onHotspotClick,
      autoRotate = false,
      className,
      interactionsEnabled = true,
      placementModeActive = false,
      onPlacementPick,
      editorCrossFloorHotspots,
      onEditCrossFloorHotspot,
    },
    ref,
  ) {
    const isEditorOverlayActive = editorCrossFloorHotspots !== undefined;
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

    // Hold-to-look-behind on the compass: press and hold rotates smoothly to
    // exactly opposite the calibrated forward direction; release smoothly
    // returns to it. Purely a temporary view — never touches saved
    // orientation, never navigates, nothing is persisted.
    const lookingBehindRef = useRef(false);

    function startLookBehind() {
      if (lookingBehindRef.current) return;
      lookingBehindRef.current = true;
      viewerRef.current?.getViewer()?.setYaw(panorama.yaw + 180, 500);
    }

    function endLookBehind() {
      if (!lookingBehindRef.current) return;
      lookingBehindRef.current = false;
      viewerRef.current?.getViewer()?.setYaw(panorama.yaw, 500);
    }

    // Release can land anywhere (drag off the compass before letting go), so
    // this listens on window rather than the compass element itself —
    // otherwise a "hold" could get stuck never returning to center.
    useEffect(() => {
      window.addEventListener("mouseup", endLookBehind);
      window.addEventListener("touchend", endLookBehind);
      window.addEventListener("touchcancel", endLookBehind);
      return () => {
        window.removeEventListener("mouseup", endLookBehind);
        window.removeEventListener("touchend", endLookBehind);
        window.removeEventListener("touchcancel", endLookBehind);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps -- endLookBehind closes over panorama.yaw directly, re-subscribing per scene is intended
    }, [panorama.yaw]);

    // A scene change mid-hold (e.g. a keyboard shortcut fired while holding)
    // must not leave the next scene thinking it's still "looking behind".
    useEffect(() => {
      lookingBehindRef.current = false;
    }, [panorama.id]);

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
        rotateTo: (yawDeg, durationMs) =>
          new Promise<void>((resolve) => {
            const viewer = viewerRef.current?.getViewer();
            if (!viewer) {
              resolve();
              return;
            }
            viewer.setYaw(yawDeg, durationMs, () => resolve());
          }),
        rotateBy: (deltaDeg, durationMs) =>
          new Promise<void>((resolve) => {
            const viewer = viewerRef.current?.getViewer();
            if (!viewer) {
              resolve();
              return;
            }
            viewer.setYaw(viewer.getYaw() + deltaDeg, durationMs, () => resolve());
          }),
      }),
      // eslint-disable-next-line react-hooks/exhaustive-deps -- resetView closes over panorama.{pitch,yaw,hfov} directly
      [panorama.pitch, panorama.yaw, panorama.hfov],
    );

    function handleRetry() {
      setLoaded(false);
      setLoadError(false);
      setRetryToken((token) => token + 1);
    }

    // Cross-floor hotspot placement tool: a click while active reports
    // exactly the (yaw, pitch) under the cursor via pannellum's own
    // mouseEventToCoords — the same projection math the viewer itself uses,
    // so a placed hotspot always matches what the admin actually clicked.
    function handlePlacementClick(event: SyntheticEvent<HTMLDivElement>) {
      if (!placementModeActive || !onPlacementPick) return;
      const viewer = viewerRef.current?.getViewer();
      if (!viewer) return;
      const nativeEvent = event.nativeEvent;
      if (!(nativeEvent instanceof MouseEvent)) return;
      const [pitch, yaw] = viewer.mouseEventToCoords(nativeEvent);
      onPlacementPick(yaw, pitch);
    }

    // Pannellum's compass is a purely visual heading indicator with no
    // built-in interactivity — press-and-hold to look behind is our own
    // addition. Delegated on the wrapper (rather than queried/attached via
    // an effect) since the compass DOM element is destroyed and recreated
    // by pannellum on every scene change; delegation survives that for free.
    function handleWrapperPressStart(event: SyntheticEvent<HTMLDivElement>) {
      if ((event.target as HTMLElement).closest(".pnlm-compass")) {
        startLookBehind();
      }
    }

    // Runs every animation frame while the viewer is moving. Deliberately
    // mutates the DOM directly instead of setState — a per-frame React
    // re-render of the whole tour page would fight the "60fps, no jank"
    // requirement it exists to serve.
    //
    // Heading is shown relative to this scene's calibrated initial_yaw —
    // "local north" — rather than pannellum's raw absolute yaw, so the
    // compass always reads 0° at exactly the saved/calibrated view.
    function handleRender() {
      const viewer = viewerRef.current?.getViewer();
      const badge = headingBadgeRef.current;
      if (!viewer || !badge) return;
      const relativeYaw = viewer.getYaw() - panorama.yaw;
      const heading = Math.round(((-relativeYaw % 360) + 360) % 360);
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
        onMouseDown={handleWrapperPressStart}
        onTouchStart={handleWrapperPressStart}
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

        {!loadError && (() => {
          // In editor mode this scene's own cross_floor entries are dropped
          // from the normal list — the authoring overlay below renders
          // every cross-floor hotspot (including this scene's own, at full
          // opacity), so nothing is ever rendered twice.
          const baseHotspots = isEditorOverlayActive
            ? panorama.hotspots.filter((h) => h.type !== "cross_floor")
            : panorama.hotspots;
          const authoringHotspots = editorCrossFloorHotspots ?? [];
          // A count-only key (e.g. "4 hotspots") doesn't change when an
          // existing hotspot is *edited* in place (same count, different
          // label/target) — verified live: the stale DOM tooltip (built
          // once at mount by pannellum itself, not React) then silently
          // keeps showing the pre-edit label until something else forces a
          // remount. Folding each hotspot's own content into the key closes
          // that gap so update, not just add/delete, remounts immediately.
          const authoringFingerprint = authoringHotspots
            .map((h) => `${h.id}:${h.targetSceneId}:${h.label ?? ""}:${h.yaw}:${h.pitch}`)
            .join("|");

          return (
            <Pannellum
              // pannellum-react's own componentDidUpdate only rebuilds its
              // internal hotSpots array when children.length changes, and
              // even then doesn't reliably add a new hotspot's DOM to an
              // already-mounted scene (verified live). Including the total
              // rendered marker count (and, for the authoring overlay, a
              // content fingerprint) in the key forces a clean remount
              // whenever the set actually changes — the only reliable way
              // to guarantee hotspots (including the authoring overlay,
              // which can change without panorama.hotspots changing at all)
              // are never stale.
              key={`${panorama.id}-${retryToken}-${baseHotspots.length}-${authoringFingerprint}`}
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
              doubleClickZoom={false}
              autoRotate={autoRotate ? -2 : 0}
              onLoad={() => setLoaded(true)}
              onError={() => setLoadError(true)}
              onRender={handleRender}
            >
              {[
                ...baseHotspots.map((hotspot, index) => {
                  const navigate = (targetId: string) => {
                    if (!interactionsEnabled) return;
                    onHotspotClick(targetId, {
                      yaw: hotspot.entryYaw,
                      pitch: hotspot.entryPitch,
                    });
                  };
                  // pannellum attaches this as a plain click listener on the
                  // hotspot's outer div, so it fires for a direct badge click —
                  // for a floor-select hotspot that means "jump to the primary
                  // option"; a specific floor menu item stops propagation and
                  // calls navigate itself instead (see buildTooltip).
                  const handlePannellumClick = (event: MouseEvent) => {
                    if (!interactionsEnabled) return;
                    if (event.currentTarget instanceof HTMLElement) {
                      playRipple(event.currentTarget);
                    }
                    navigate(hotspot.targetId);
                  };
                  return (
                    <HotspotMarker
                      key={`${panorama.id}-${index}`}
                      type="custom"
                      pitch={safeAngle(hotspot.pitch)}
                      yaw={safeAngle(hotspot.yaw)}
                      tooltip={buildTooltip(hotspot, navigate)}
                      handleClick={handlePannellumClick}
                    />
                  );
                }),
                ...authoringHotspots.map((hotspot) => {
                  const isOwnScene = hotspot.sourceSceneId === panorama.id;
                  const handleEditClick = () => onEditCrossFloorHotspot?.(hotspot.id);
                  return (
                    <HotspotMarker
                      key={`authoring-${hotspot.id}`}
                      type="custom"
                      pitch={safeAngle(hotspot.pitch)}
                      yaw={safeAngle(hotspot.yaw)}
                      tooltip={buildAuthoringTooltip(hotspot, isOwnScene, handleEditClick)}
                      handleClick={handleEditClick}
                    />
                  );
                }),
              ]}
            </Pannellum>
          );
        })()}

        {!loadError && (
          <span
            ref={headingBadgeRef}
            aria-hidden="true"
            className="pointer-events-none absolute bottom-[62px] right-1 z-10 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-white/90 backdrop-blur-sm"
          >
            0°
          </span>
        )}

        {/* Cross-floor hotspot placement tool only — a transparent full-cover
            hit target so a click reports coordinates instead of dragging the
            view or hitting an existing hotspot underneath. */}
        {placementModeActive && (
          <div
            className="absolute inset-0 z-40 cursor-crosshair"
            onClick={handlePlacementClick}
            title="Click where the other floor is visible"
          />
        )}
      </div>
    );
  },
);
