export type HotspotDirection =
  | "forward"
  | "back"
  | "left"
  | "right"
  | "upstairs"
  | "downstairs"
  | "enter_room"
  | "exit_room";

export interface TourHotspot {
  type: HotspotDirection;
  label: string;
  yaw: number;
  pitch: number;
  targetId: string;
}

export interface TourPanorama {
  id: string;
  name: string;
  building: string;
  floor: string;
  room: string | null;
  image: string;
  yaw: number;
  pitch: number;
  hfov: number;
  hotspots: TourHotspot[];
}
