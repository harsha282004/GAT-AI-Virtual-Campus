/**
 * pannellum-react ships no type definitions of its own. This mirrors the
 * actual props/API read directly from its source
 * (node_modules/pannellum-react/es/elements/Pannellum.js) rather than guessed
 * from memory.
 */
declare module "pannellum-react" {
  import type { Component, ComponentType, ReactNode } from "react";

  export interface PannellumViewerInstance {
    getPitch(): number;
    setPitch(pitch: number, animated?: boolean | number, callback?: () => void): void;
    getYaw(): number;
    setYaw(yaw: number, animated?: boolean | number, callback?: () => void): void;
    getHfov(): number;
    setHfov(hfov: number, animated?: boolean | number, callback?: () => void): void;
    lookAt(
      pitch?: number,
      yaw?: number,
      hfov?: number,
      animated?: boolean | number,
      callback?: () => void,
    ): void;
    startAutoRotate(speed?: number): void;
    stopAutoRotate(): void;
    toggleFullscreen(): void;
    destroy(): void;
  }

  export interface PannellumProps {
    id?: string;
    width?: string;
    height?: string;
    image: string;
    haov?: number;
    vaov?: number;
    vOffset?: number;
    yaw?: number;
    pitch?: number;
    hfov?: number;
    minHfov?: number;
    maxHfov?: number;
    minPitch?: number;
    maxPitch?: number;
    minYaw?: number;
    maxYaw?: number;
    autoRotate?: number;
    compass?: boolean;
    autoLoad?: boolean;
    orientationOnByDefault?: boolean;
    showZoomCtrl?: boolean;
    doubleClickZoom?: boolean;
    keyboardZoom?: boolean;
    mouseZoom?: boolean;
    draggable?: boolean;
    disableKeyboardCtrl?: boolean;
    showFullscreenCtrl?: boolean;
    showControls?: boolean;
    hotspotDebug?: boolean;
    onLoad?: () => void;
    onScenechange?: () => void;
    onScenechangefadedone?: () => void;
    onError?: (error: unknown) => void;
    onErrorcleared?: () => void;
    onMousedown?: (event: MouseEvent) => void;
    onMouseup?: (event: MouseEvent) => void;
    onTouchstart?: (event: TouchEvent) => void;
    onTouchend?: (event: TouchEvent) => void;
    children?: ReactNode;
  }

  export interface HotspotProps {
    type: "custom" | "info";
    pitch?: number;
    yaw?: number;
    text?: string;
    URL?: string;
    cssClass?: string;
    tooltip?: (hotSpotDiv: HTMLElement, args: unknown) => void;
    tooltipArg?: unknown;
    handleClick?: (event: MouseEvent, args: unknown) => void;
    handleClickArg?: unknown;
  }

  export class Pannellum extends Component<PannellumProps> {
    static Hotspot: ComponentType<HotspotProps>;
    getViewer(): PannellumViewerInstance;
  }
}
