"use client";

import dynamic from "next/dynamic";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

import { Spinner } from "@/components/ui";
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
}

interface PanoramaViewerProps {
  panorama: TourPanorama;
  onHotspotClick: (targetId: string) => void;
  autoRotate?: boolean;
  className?: string;
}

const HOTSPOT_META: Record<HotspotDirection, { symbol: string; bg: string }> = {
  forward: { symbol: "↑", bg: "bg-brand" },
  back: { symbol: "↓", bg: "bg-brand" },
  left: { symbol: "←", bg: "bg-brand" },
  right: { symbol: "→", bg: "bg-brand" },
  upstairs: { symbol: "⤴", bg: "bg-accent-green" },
  downstairs: { symbol: "⤵", bg: "bg-accent-green" },
  enter_room: { symbol: "⏎", bg: "bg-accent-purple" },
  exit_room: { symbol: "⏏", bg: "bg-accent-purple" },
};

// pannellum-react falls back to a default of 10 whenever a hotspot's pitch/yaw
// prop is falsy — which incorrectly swallows a legitimate value of exactly 0.
function safeAngle(value: number): number {
  return value === 0 ? 0.001 : value;
}

function buildTooltip(hotspot: TourHotspot) {
  return (hotSpotDiv: HTMLElement) => {
    const meta = HOTSPOT_META[hotspot.type];
    hotSpotDiv.innerHTML = `
      <div class="flex items-center gap-1.5 rounded-full ${meta.bg} px-3 py-1.5 text-xs font-medium text-white shadow-lg whitespace-nowrap">
        <span>${meta.symbol}</span>
        <span>${hotspot.label}</span>
      </div>
    `;
  };
}

export const PanoramaViewer = forwardRef<PanoramaViewerHandle, PanoramaViewerProps>(
  function PanoramaViewer({ panorama, onHotspotClick, autoRotate = false, className }, ref) {
    const viewerRef = useRef<PannellumClass | null>(null);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
      setLoaded(false);
    }, [panorama.id]);

    useImperativeHandle(
      ref,
      () => ({
        resetView: () => {
          viewerRef.current?.getViewer().lookAt(panorama.pitch, panorama.yaw, panorama.hfov, 800);
        },
        toggleFullscreen: () => {
          viewerRef.current?.getViewer().toggleFullscreen();
        },
      }),
      [panorama.pitch, panorama.yaw, panorama.hfov],
    );

    return (
      <div className={cn("relative overflow-hidden rounded-3xl bg-ink", className)}>
        {!loaded && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-ink/90">
            <Spinner label="Loading panorama…" />
          </div>
        )}

        <Pannellum
          key={panorama.id}
          ref={(instance) => {
            viewerRef.current = instance;
          }}
          width="100%"
          height="100%"
          image={panorama.image}
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
        >
          {panorama.hotspots.map((hotspot, index) => (
            <HotspotMarker
              key={`${panorama.id}-${index}`}
              type="custom"
              pitch={safeAngle(hotspot.pitch)}
              yaw={safeAngle(hotspot.yaw)}
              tooltip={buildTooltip(hotspot)}
              handleClick={() => onHotspotClick(hotspot.targetId)}
            />
          ))}
        </Pannellum>
      </div>
    );
  },
);
