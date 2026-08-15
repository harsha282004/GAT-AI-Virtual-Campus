/**
 * Single source of truth for GAT's real-world geographic anchor point
 * (Phase 17). Every component that needs "where is the campus" — the
 * satellite map's default center, the campus marker, the reset-view
 * control — imports this instead of hardcoding a coordinate locally.
 *
 * SOURCE: no surveyed/authoritative coordinate existed anywhere in this
 * project before this phase (confirmed by inspection — only a text
 * address, "Rajarajeshwari Nagar, Bangalore", was recorded anywhere; see
 * backend/app/models/campus.py and scripts/db/seed.py). This value was
 * obtained from public third-party map data (Mapcarta's listing for
 * Global Academy of Technology) during Phase 17 research, not surveyed
 * on-site and not verified against an authoritative source (e.g. a GPS
 * reading taken at the campus gate). Treat it as a reasonable
 * campus-level approximation, not a precise coordinate — do not use it
 * as an anchor for deriving individual building positions (see
 * BUILDING_GEOCODING_STATUS below).
 */
export const GAT_CAMPUS_CENTER = {
  latitude: 12.92727,
  longitude: 77.52622,
} as const;

/** Google Maps zoom level appropriate for a whole-campus view (roughly
 * matches a ~300-400m viewport across) — not so far in that surrounding
 * roads/context are lost, not so far out that the campus is a speck. */
export const GAT_CAMPUS_DEFAULT_ZOOM = 18;

export const GAT_CAMPUS_MIN_ZOOM = 15;
export const GAT_CAMPUS_MAX_ZOOM = 21;

/**
 * Documents (does not enforce — TypeScript can't express "this column is
 * always null today") why individual buildings do NOT get a marker
 * derived from their local pos_x/pos_y campus-plane coordinates: that
 * plane has no documented compass alignment or absolute scale anchor
 * (see frontend/src/features/mapSatellite/campusLayout.ts's docstring —
 * it was only ever used relative to itself, originally for the removed
 * 3D scene). Projecting it onto real latitude/longitude would silently
 * invent a real-world orientation and position the data does not
 * support. Real per-building markers only render once
 * backend/app/models/building.py's latitude/longitude columns (added in
 * Phase 17, currently NULL for every building) are populated from an
 * actual survey.
 */
export const BUILDING_GEOCODING_STATUS = "pending-survey" as const;
