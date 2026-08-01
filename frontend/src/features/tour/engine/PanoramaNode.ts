import type { TourHotspot, TourPanorama } from "@/types";

import type { VideoPortal } from "./videoPortal";

/** Direct PanoramaNode references (not ids) so the Manual Tour hotspot
 * engine (Sprint 2) can derive every hotspot purely from a node object,
 * with no separate lookup pass. Populated by PanoramaEngine's second pass;
 * absent (undefined) means "no such connection exists here" — the hotspot
 * engine's only signal for hiding a hotspot (Sprint 2 Step 9). */
export interface PanoramaCrossReferences {
  oppositeCorridor?: PanoramaNode;
  groundFloor?: PanoramaNode;
  firstFloor?: PanoramaNode;
  secondFloor?: PanoramaNode;
  thirdFloor?: PanoramaNode;
  /** A node can have more than one elevator hop (e.g. up and down) —
   * Sprint 2 Step 8 ("Select Floor -> Jump") needs all of them. */
  lift?: PanoramaNode[];
  floorUp?: PanoramaNode;
  floorDown?: PanoramaNode;
  roomEntry?: PanoramaNode;
  /** From inside a room, the corridor node to return to. */
  returnTo?: PanoramaNode;
  auditorium?: PanoramaNode;
}

/** A DLL link to a neighboring node plus the camera orientation the target
 * should open with when arrived at via this specific link (Street View
 * style — keep facing the direction of travel). */
export interface PanoramaLink {
  node: PanoramaNode;
  entryYaw: number | null;
  entryPitch: number | null;
}

export interface PanoramaNodeInit {
  sceneId: string;
  /** The underlying Panorama row's own id — target for the orientation
   * calibration PUT, distinct from sceneId (which is the node id). */
  panoramaId: number;
  name: string;
  building: string;
  floor: string;
  room: string | null;
  imagePath: string;
  previewImagePath: string | null;
  sequenceIndex: number | null;
  yaw: number;
  pitch: number;
  hfov: number;
  aiDescription: string | null;
  videoUrl?: string | null;
  /** Sprint 3 Step 13 — architecture only; no current data source ever sets
   * this, it exists purely so a future sprint can attach one per node. */
  videoPortal?: VideoPortal | null;
  hotspots: TourHotspot[];
}

/** One panorama scene as a doubly-linked-list node. `previous`/`next` are the
 * chain within its own floor; everything else a scene connects to (branch
 * corridors, stairs, lifts, rooms) lives in `crossReferences` instead of the
 * chain, per the Sprint 1 spec — those are data pointers only, no hotspot UI. */
export class PanoramaNode {
  readonly sceneId: string;
  readonly panoramaId: number;
  readonly name: string;
  readonly building: string;
  readonly floor: string;
  readonly room: string | null;
  readonly imagePath: string;
  readonly previewImagePath: string | null;
  readonly sequenceIndex: number | null;
  readonly yaw: number;
  readonly pitch: number;
  readonly hfov: number;
  readonly aiDescription: string | null;
  readonly videoUrl: string | null;
  readonly videoPortal: VideoPortal | null;
  /** Raw source hotspots, kept only so the existing PanoramaViewer keeps
   * rendering its already-working nav arrows unchanged — not new hotspot UI. */
  readonly hotspots: TourHotspot[];

  previous: PanoramaLink | null = null;
  next: PanoramaLink | null = null;
  readonly crossReferences: PanoramaCrossReferences = {};

  constructor(init: PanoramaNodeInit) {
    this.sceneId = init.sceneId;
    this.panoramaId = init.panoramaId;
    this.name = init.name;
    this.building = init.building;
    this.floor = init.floor;
    this.room = init.room;
    this.imagePath = init.imagePath;
    this.previewImagePath = init.previewImagePath;
    this.sequenceIndex = init.sequenceIndex;
    this.yaw = init.yaw;
    this.pitch = init.pitch;
    this.hfov = init.hfov;
    this.aiDescription = init.aiDescription;
    this.videoUrl = init.videoUrl ?? null;
    this.videoPortal = init.videoPortal ?? null;
    this.hotspots = init.hotspots;
  }

  /** Adapter back to the pre-existing UI shape so PanoramaViewer, TourSidebar,
   * TourControls etc. need zero changes — they've never known this engine
   * exists and don't need to. */
  toTourPanorama(): TourPanorama {
    return {
      id: this.sceneId,
      panoramaId: this.panoramaId,
      name: this.name,
      building: this.building,
      floor: this.floor,
      room: this.room,
      image: this.imagePath,
      previewImage: this.previewImagePath,
      description: this.aiDescription,
      sequenceIndex: this.sequenceIndex,
      yaw: this.yaw,
      pitch: this.pitch,
      hfov: this.hfov,
      hotspots: this.hotspots,
    };
  }
}
