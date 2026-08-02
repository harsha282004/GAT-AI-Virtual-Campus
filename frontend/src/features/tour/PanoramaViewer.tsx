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
  /** Dev-only edit affordance for cross-floor hotspots: when provided, every
   * `cross_floor` marker gets a small edit icon (visible on hover) alongside
   * its normal navigable badge — clicking the icon calls this with the
   * hotspot's own database id instead of navigating; clicking the badge
   * itself always navigates, exactly like every other hotspot type.
   * `undefined` (the default) renders cross-floor hotspots as plain
   * navigable badges with no edit affordance at all — the real end-user
   * experience. */
  onEditCrossFloorHotspot?: (hotspotId: number) => void;
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
  // Its own opacity is independent of the badge's — near-invisible at rest,
  // full strength on hover, via a class (not inline-only) so
  // group-hover:opacity-100 can actually override it.
  cross_floor: {
    icon: '<span class="opacity-20 transition-opacity duration-200 ease-out group-hover:opacity-100" style="font-size:13px;line-height:1">↗</span>',
  },
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
 *
 * `onEditCrossFloor` (cross_floor hotspots only, dev-only): an optional
 * small edit icon rendered alongside the badge, visible on hover, that
 * stops propagation so clicking it opens edit instead of navigating — the
 * badge itself always navigates, in every mode, exactly like every other
 * hotspot type. `undefined` renders no edit icon at all (the real
 * end-user experience).
 */
function buildTooltip(
  hotspot: TourHotspot,
  onSelect: (targetId: string) => void,
  onEditCrossFloor?: () => void,
) {
  return (hotSpotDiv: HTMLElement) => {
    const meta = HOTSPOT_META[hotspot.type];
    const reducedMotion = prefersReducedMotion();
    const floorOptions = hotspot.type === "elevator" ? hotspot.floorOptions : undefined;
    const hasFloorMenu = !!floorOptions && floorOptions.length > 1;
    // Cross-floor sightline hotspots read as a clear glass/water-droplet
    // marker resting on the panorama, not a UI button: perfectly sharp (no
    // backdrop-blur), no flat color fill, just a faint radial highlight
    // suggesting a droplet's refraction + rim. mix-blend-overlay lets it
    // adapt to whatever's directly behind it (bright wall or dark corridor)
    // instead of fighting the scene with a fixed color — hover switches to
    // normal blending so the reveal is unambiguous regardless of what's
    // underneath. No blue, no glow, no shadow, ever.
    const isCrossFloor = hotspot.type === "cross_floor";
    const showEditIcon = isCrossFloor && !!onEditCrossFloor;

    const badgeLabel = hasFloorMenu ? "Select Floor" : hotspot.label;

    const badgeSizeClass = isCrossFloor ? "h-[22px] w-[22px]" : "h-9 w-9";
    const badgeRestClass = isCrossFloor
      ? "shadow-none ring-1 ring-white/10 mix-blend-overlay bg-[radial-gradient(circle_at_35%_30%,rgba(255,255,255,0.22)_0%,rgba(255,255,255,0.04)_55%,rgba(255,255,255,0.14)_100%)]"
      : "bg-white/25 shadow-[0_4px_14px_rgba(0,0,0,0.35)] ring-1 ring-white/60";
    const badgeHoverClass = isCrossFloor
      ? "group-hover:scale-[1.06] group-hover:ring-white/30 group-hover:mix-blend-normal group-hover:bg-[radial-gradient(circle_at_35%_30%,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0.22)_55%,rgba(255,255,255,0.35)_100%)]"
      : "group-hover:scale-125 group-hover:bg-sky-500/70 group-hover:shadow-[0_0_18px_rgba(56,142,255,0.85)] group-hover:ring-sky-200";
    const badgeBlurClass = isCrossFloor ? "" : "backdrop-blur-md";

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
          <span class="tour-hotspot-ripple pointer-events-none absolute inline-flex ${isCrossFloor ? "h-[22px] w-[22px] bg-white/25" : "h-9 w-9 bg-sky-300/70"} rounded-full"></span>
          <div class="relative flex ${badgeSizeClass} items-center justify-center rounded-full ${badgeRestClass} text-white ${badgeBlurClass} transition-all duration-200 ease-out ${badgeHoverClass}">
            ${meta.icon}
          </div>
          ${isCrossFloor ? "" : '<div class="absolute -bottom-2 left-1/2 h-2 w-8 -translate-x-1/2 rounded-full bg-black/30 blur-[3px]"></div>'}
          ${
            showEditIcon
              ? `<button type="button" class="tour-cross-floor-edit pointer-events-auto absolute -top-1 -right-1 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-white opacity-0 shadow-md ring-1 ring-white/40 transition-opacity duration-150 ease-out group-hover:opacity-100 hover:bg-sky-500" aria-label="Edit cross-floor hotspot" title="Edit hotspot">
                  <span style="font-size:8px;line-height:1">✎</span>
                </button>`
              : ""
          }
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

    // No separate click listener on .tour-cross-floor-edit itself: pannellum
    // (see libpannellum.js's createHotSpot) registers hotSpotDiv's own click
    // listener with a truthy string `'false'` as addEventListener's third
    // argument, which JS coerces to `useCapture: true`. That capture-phase
    // listener on this ANCESTOR div necessarily fires before any bubble- or
    // target-phase listener on a descendant like this button ever runs, so
    // stopPropagation() called from the button would always be too late —
    // navigate() would already have fired. Routing the decision inside the
    // single click handler passed via handleClick (see PanoramaViewer's
    // handlePannellumClick, which checks event.target) is the only correct
    // fix; see that function's own comment for the full explanation.

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
      onEditCrossFloorHotspot,
    },
    ref,
  ) {
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
      // Fallback: hide the veil regardless after a short grace window, so a
      // delayed or missing onLoad (large image, slow network, decode stall)
      // can never leave the panorama stuck behind a blur/haze indefinitely.
      // Re-armed fresh on every scene change (cleanup cancels a still-
      // pending timer from the previous scene if navigation is rapid).
      const fallback = setTimeout(() => setVeilVisible(false), 400);
      return () => clearTimeout(fallback);
    }, [panorama.id]);

    // Lift the transition veil the instant the new scene actually reports
    // loaded — no artificial grace delay beyond the CSS fade itself, so it
    // never lingers past what loading actually took. Deliberately depends
    // only on `loaded` (not panorama.id) so this never fires using a stale
    // pre-reset value in the same effects pass as the effect above.
    useEffect(() => {
      if (!loaded) return;
      setVeilVisible(false);
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

        {/* Scene-transition veil: fades to a lightly-blurred preview of the
            destination rather than an instant hard cut, and back out the
            moment it has painted — deliberately not a live dual-canvas
            crossfade (2x GPU/WebGL context cost for marginal gain here) but
            reads the same to the eye. Brief and light on purpose: no
            brightness reduction (the panorama itself is never darkened) and
            only a 2px blur, so this never reads as a low-quality or washed-
            out render — just a fast, smooth hand-off. */}
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 z-30 bg-cover bg-center transition-opacity duration-150 ease-out",
            veilVisible ? "opacity-100" : "opacity-0",
          )}
          style={{
            backgroundImage: panorama.previewImage ? `url(${panorama.previewImage})` : undefined,
            backgroundColor: "#16213E",
            filter: "blur(2px)",
          }}
        />

        {!loadError && (() => {
          // Every hotspot renders through this one path, in every mode —
          // cross-floor included. Clicking the badge always navigates; the
          // small edit icon buildTooltip renders alongside a cross_floor
          // badge (only when onEditCrossFloorHotspot is provided) is the
          // sole way to start editing, never the badge click itself.
          const baseHotspots = panorama.hotspots;
          // A count-only key (e.g. "4 hotspots") doesn't change when an
          // existing hotspot is *edited* in place (same count, different
          // label/target) — verified live: the stale DOM tooltip (built
          // once at mount by pannellum itself, not React) then silently
          // keeps showing the pre-edit label until something else forces a
          // remount. Folding each hotspot's own content into the key closes
          // that gap so update, not just add/delete, remounts immediately.
          const hotspotFingerprint = baseHotspots
            .map((h) => `${h.targetId}:${h.label}:${h.yaw}:${h.pitch}`)
            .join("|");

          return (
            <Pannellum
              // pannellum-react's own componentDidUpdate only rebuilds its
              // internal hotSpots array when children.length changes, and
              // even then doesn't reliably add a new hotspot's DOM to an
              // already-mounted scene (verified live). Including a content
              // fingerprint in the key forces a clean remount whenever the
              // set actually changes — the only reliable way to guarantee
              // hotspots (including an in-place edit, which can change a
              // hotspot's content without changing panorama.hotspots.length
              // at all) are never stale.
              key={`${panorama.id}-${retryToken}-${baseHotspots.length}-${hotspotFingerprint}`}
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
              {baseHotspots.map((hotspot, index) => {
                const navigate = (targetId: string) => {
                  if (!interactionsEnabled) return;
                  onHotspotClick(targetId, {
                    yaw: hotspot.entryYaw,
                    pitch: hotspot.entryPitch,
                  });
                };
                const onEditCrossFloor =
                  hotspot.type === "cross_floor" &&
                  onEditCrossFloorHotspot &&
                  hotspot.hotspotId !== undefined
                    ? () => onEditCrossFloorHotspot(hotspot.hotspotId as number)
                    : undefined;
                // pannellum (see libpannellum.js's createHotSpot) registers
                // this as a CAPTURE-phase listener on the hotspot's outer
                // div (a `'false'` string passed as addEventListener's third
                // arg coerces to useCapture: true) — it always fires before
                // any listener on a descendant (the floor-menu buttons, the
                // cross-floor edit icon) regardless of stopPropagation()
                // called from there, since capture-phase ancestor listeners
                // run strictly before the target/bubble phase reaches a
                // descendant. So routing has to happen HERE, by inspecting
                // event.target, not by relying on descendants to opt out.
                const handlePannellumClick = (event: MouseEvent) => {
                  if (!interactionsEnabled) return;
                  const targetEl = event.target instanceof HTMLElement ? event.target : null;
                  if (onEditCrossFloor && targetEl?.closest(".tour-cross-floor-edit")) {
                    onEditCrossFloor();
                    return;
                  }
                  if (targetEl?.closest(".tour-floor-option")) return; // handled by buildTooltip's own listener
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
                    tooltip={buildTooltip(hotspot, navigate, onEditCrossFloor)}
                    handleClick={handlePannellumClick}
                  />
                );
              })}
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
