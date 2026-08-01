/**
 * Sprint 3 Step 13 — architecture only, no playback. A VideoPortal describes
 * an optional 360° video experience reachable from a PanoramaNode (an
 * auditorium, lab, or classroom walkthrough). Nothing currently populates
 * this (no backend column/edge produces it yet) — it exists so a future
 * sprint can attach one to a node and have the UI light up automatically,
 * per Step 15's Panorama -> Video Portal -> 360 Video -> Exit -> return-to-
 * same-node flow (only the first and last legs — the portal button, and
 * "the same node is what you land back on" — are wired today).
 */
export type VideoPortalType = "auditorium" | "lab" | "classroom";

export interface VideoPortal {
  id: string;
  title: string;
  type: VideoPortalType;
  videoUrl: string;
  thumbnail: string | null;
  duration: number | null;
  enabled: boolean;
}

const VIDEO_PORTAL_LABEL: Record<VideoPortalType, string> = {
  auditorium: "Explore Auditorium (360°)",
  lab: "Explore Computer Lab (360°)",
  classroom: "Explore Classroom (360°)",
};

export function videoPortalButtonLabel(portal: VideoPortal): string {
  return VIDEO_PORTAL_LABEL[portal.type];
}
