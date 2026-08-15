export interface Building {
  id: number;
  campus_id: number;
  name: string;
  code: string | null;
  description: string | null;
  /** Real, surveyed building coordinates (Phase 17). Null for every
   * building until an on-site GPS survey populates them — see
   * docs/phase17_satellite_campus_map.md. Never fall back to an
   * approximated value when these are null; render nothing instead. */
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  updated_at: string;
}
