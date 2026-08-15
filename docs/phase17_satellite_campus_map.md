# Phase 17 — Real Satellite Campus Map + Geographic Coordinates

> **Status: complete.** Phase 18 (user's real GPS location on this same
> satellite map — a blue dot, accuracy circle, "My Location" button) is
> also complete, built directly on top of this phase's
> `GoogleSatelliteMap`/`SatelliteCampusMap` without changing anything
> described below. See
> [`phase18_user_location.md`](phase18_user_location.md).

## 1. Objective

Replace the artificial Three.js grid + blue boxes that were `/map`'s
*only* visualization (Phase 16) with a real geographic satellite map of
GAT, using the official Google Maps Platform, so a visitor immediately
sees the actual location, roads, and surroundings of the campus. The
Phase 16 3D scene is not deleted — it becomes a secondary, selectable
view.

## 2. Architecture

`/map/page.tsx` now renders `CampusMapView`
(`frontend/src/features/campusMap/`) instead of `Map3DCampusView`
directly. `CampusMapView` is a small mode-toggle: a segmented control
("Satellite" / "3D View") that mounts exactly one renderer at a time —

```
/map/page.tsx
  └─ CampusMapView                      (new, Phase 17)
       ├─ SatelliteCampusMap            (new — default/primary)
       └─ Map3DCampusView               (Phase 16 — reused, unmodified)
```

Only one of the two heavy runtimes (Google Maps JS SDK, Three.js/WebGL)
is ever mounted, per Section 10's "do not force both renderers into the
same runtime." Switching modes fully unmounts the other.

`BuildingNodeSidebar` (Phase 16, unmodified) still renders beside
`CampusMapView`, and both map renderers read/write the same
`useCampusStore.selectedBuildingId` — selecting a building anywhere
(sidebar, satellite popup, 3D scene) stays in sync everywhere, exactly
as in Phase 16.

## 3. Google Maps Platform integration

`@vis.gl/react-google-maps` (^1.9.0) — Google's own maintained React
wrapper around the Maps JavaScript API. Chosen over hand-rolling a
`<script>` loader because it's the officially recommended integration
path for React + Google Maps today, has first-class React 19 support
(`peerDependencies: react: ">=16.8.0 || ^19.0"`, verified before
installing), and its `APIProvider`/`Map`/`Marker`/`InfoWindow`
components map directly onto what this phase needed — no scraping, no
screenshots, no locally-cached tile imagery (Section 2's explicit
prohibitions); tiles are always fetched live from Google at request time
via the key-authenticated SDK.

`frontend/src/features/mapSatellite/GoogleSatelliteMap.tsx` wraps
`APIProvider` + `Map` (`mapTypeId="satellite"`), exposes an imperative
`resetView()`/`panTo()` handle via `forwardRef` (mirroring
`map3d/CampusScene3D.tsx`'s pattern), and is loaded through
`next/dynamic({ ssr: false })` from `CampusMapView.tsx` — the SDK
touches `window`/`document` as it loads, so it must never run during
Next.js's server render, same reasoning as Phase 16's Three.js canvas.

## 4. API key configuration

Read from `process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — never
hardcoded. Added to:

- `.env.example` (repo root, tracked) — documented, left **blank**.
- `frontend/.env.local` (gitignored, local dev only) — added as an empty
  placeholder line so the app "just works" the moment a real key is
  pasted in, matching this repo's existing convention of duplicating
  `NEXT_PUBLIC_*` vars between the two files.

**To enable the satellite view:** get a key at
[console.cloud.google.com/google/maps-apis](https://console.cloud.google.com/google/maps-apis),
enable the "Maps JavaScript API" for it, restrict it to your dev/prod
origins, and paste it into `frontend/.env.local`'s
`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=`. Restart `next dev` after editing
(Next.js only reads `NEXT_PUBLIC_*` env vars at build/start time).

**Security check performed:** grepped the entire repository (excluding
`.git`, `node_modules`, `.next`, `venv`) for the Google Maps API key
literal pattern (`AIzaSy...`) — zero matches. No key was ever hardcoded
anywhere in this project, before or after this phase (see
`scripts/ai/test_phase17_satellite_map.py`'s `case_e_no_hardcoded_api_key`,
which now runs on every future test pass too).

## 5. GAT campus coordinates

**Inspected first, per Section 4:** no surveyed or previously-recorded
latitude/longitude existed anywhere in this project before this phase.
The only prior location data was a text address,
`"Rajarajeshwari Nagar, Bangalore"`, on the `Campus` model
(`backend/app/models/campus.py`) — no coordinate. `Node.latitude`/
`longitude` columns already existed (added in an earlier phase) but were
confirmed 100% `NULL` in the live database.

**Source used:** public third-party map data (a Mapcarta listing for
Global Academy of Technology), obtained via web search during this
phase. Recorded in `frontend/src/config/campusLocation.ts` as
`GAT_CAMPUS_CENTER = { latitude: 12.92727, longitude: 77.52622 }`, with
an explicit code comment stating the source and that it is **not**
surveyed or independently verified — it should be treated as a
reasonable campus-level approximation, replaceable with an authoritative
on-site GPS reading at any time (a config change, not a code change).

This is the single source of truth for the map's default center, zoom,
and the "Return to GAT Campus" reset control — no other file hardcodes a
coordinate.

## 6. Building geographic data — status and the Section 6/11 tension

**Backend:** `backend/app/models/building.py` gained two new nullable
columns, `latitude`/`longitude` (migration
`93a0ce5865ca_building_geo_coordinates`, chained on the real current
head `cabb26ecec65`, applied to the local dev DB). `BuildingRead`/
`BuildingCreate`/`BuildingUpdate` schemas expose them; the existing
generic CRUD router picked them up with no route code changes. **Every
building's values are `NULL` today** — confirmed live:
`GET /api/v1/buildings` returns `latitude`/`longitude` present in every
record, all `null` (Admin Block, CSE Block, Library, Auditorium, Main
Building). This is intentional, not an oversight: no building has been
GPS-surveyed. The spec's fuller example model
(`entrance_latitude`/`entrance_longitude`, `footprint`, `orientation`)
was deliberately **not** added — there is no foreseeable data source for
those fields yet either, and adding four more permanently-null columns
would be schema bloat with no present purpose; they're a reasonable
Phase 18+ addition once a real survey plan exists.

**Frontend:** the Section 5/11 tension was resolved deliberately, not by
picking silently:

- Section 6 requires buildings to "appear on top of the satellite map...
  clickable."
- Section 11 forbids "guess[ing] building positions" or "claim[ing]
  approximate coordinates are exact."
- Section 5 explicitly resolves this for the *data model*: "if exact
  coordinates are not yet available... clearly mark coordinates as
  pending verification... do not pretend approximate coordinates are
  accurate."

The building's local `pos_x`/`pos_y` plane (used for the Phase 16 3D
scene) has no documented compass alignment or absolute-distance anchor
to real-world geography (confirmed by re-reading
`map3d/campusLayout.ts`'s own docstring and `scripts/db/seed.py` — it's
an arbitrary local plane, not oriented data). Projecting it onto
`latitude`/`longitude` would have silently invented a real-world
orientation the data does not support — exactly what Section 11
prohibits. So **no individual building marker is placed at a derived or
approximated position.** Instead:

- `CampusMarker.tsx` renders the one real, sourced point (Section 4) and
  opens a popup listing the real buildings (name, code) on click —
  satisfying "buildings appear on the map, clickable, real name/ID" via
  the one coordinate that's actually legitimate.
- `BuildingMarker.tsx` renders a real individual pin **only** when a
  building's own `latitude`/`longitude` are both non-null. Today that's
  zero buildings, so zero individual pins render — an accurate
  reflection of what's known, not a fabrication. The moment a future
  phase populates real survey data into those columns, pins appear
  automatically with no code change.
- `BuildingGeoInfoPanel.tsx` (opened via the popup list, the sidebar, or
  search) shows an explicit "no surveyed GPS coordinate is recorded yet"
  note whenever this is true for the selected building.

## 7. Search integration

`MapSearch` (`map3d/MapSearch.tsx`, Phase 16) is reused completely
unmodified — the exact same component, same `useBuildings()`-backed
client-side filter, same "no duplicate search backend" property (Section
7). Selecting a result sets `selectedBuildingId` and — if that building
has real coordinates — pans the satellite camera there via
`GoogleSatelliteMapHandle.panTo()`; if not (true for all 5 today), it
selects and opens the info panel without moving the camera, rather than
panning to a fabricated location.

## 8. Reset / campus-center behavior

The floating "Return to GAT Campus" button (top-right of the satellite
canvas, same visual slot as Phase 16's "Reset View") calls
`GoogleSatelliteMapHandle.resetView()`, which pans to
`GAT_CAMPUS_CENTER` and restores `GAT_CAMPUS_DEFAULT_ZOOM` (18 — a
whole-campus view, not zoomed past the campus or so far out it's a
speck, per Section 3).

## 9. Error / fallback behavior

- **Missing API key:** `GoogleSatelliteMap` checks
  `process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` before ever mounting
  `APIProvider`; if unset, renders `SatelliteMapUnavailable` (styled
  like Phase 16's `Map3DUnavailable`) with clear setup instructions — no
  blank screen, no crash.
- **SDK load failure / bad key / auth failure:** `useApiLoadingStatus()`
  is checked inside the provider; `FAILED`/`AUTH_FAILURE` states also
  render `SatelliteMapUnavailable` with a diagnostic message (check key
  validity, API enablement, referrer restrictions).
- In both cases the rest of the page — Navbar, `BuildingNodeSidebar`,
  the mode toggle itself, and the "3D View" option — keeps working.
  Switching to "3D View" still works with no satellite key configured at
  all.

## 10. Security considerations

- API key is env-var only, `NEXT_PUBLIC_*` (required for a
  browser-side Maps JS key — this is Google's own documented pattern;
  such keys are meant to be restricted by HTTP referrer/API restriction
  in Google Cloud Console, not kept secret client-side).
- `.env.example` documents the var with a blank value; `.gitignore`
  already covers `.env.local`/`.env.*.local` (unchanged, verified).
- Repo-wide grep for the Google API key literal pattern found zero
  hardcoded keys (Section 4 above / Section 12).

## 11. Performance considerations

- Only one map runtime mounts at a time (Section 2) — no double GPU/JS
  SDK cost from running satellite + 3D simultaneously.
- `next/dynamic({ ssr: false })` keeps the Google Maps JS bundle out of
  every other route's payload, same pattern as Phase 16's Three.js
  bundle.
- `Marker`/`InfoWindow` (the legacy, lightweight marker API) were used
  instead of `AdvancedMarker`, which requires a Google Cloud "Map ID" —
  an extra piece of required configuration this phase's key-only
  promise (Section 13) didn't need to introduce for 1-6 markers at
  campus scale.
- Building `npm run build` confirms `/map`'s bundle stays reasonable
  (198 kB First Load JS, in the same range as Phase 16's).

## 12. Testing performed

- `npm run type-check` — clean.
- `npm run lint` — clean, no warnings.
- `npm run build` — succeeds; `/map` compiles and prerenders correctly.
- `ruff check backend`, `black --check backend`, `mypy backend` — all
  clean on the modified backend files (model, schema).
- `alembic upgrade head` — applied the new migration to the local dev
  DB successfully; verified live via `GET /api/v1/buildings` that
  `latitude`/`longitude` are present (and correctly `null`) on every
  building.
- `scripts/ai/test_phase17_satellite_map.py` (new) — structural checks
  (satellite components exist, `/map` wired through the new toggle,
  centralized location config exists, dependency + env var wired),
  a security check (no hardcoded key anywhere), a live-data check
  (`/api/v1/buildings` serves the new fields), and regression re-runs of
  Phase 13/14/15/16's test scripts. **Result: 9/10 passed.**
- The one failure — Phase 16's own `test_phase16_3d_map.py`, case
  `A-ROUTE-EXISTES` — is an **expected, explained** consequence of this
  phase's architecture, not a real regression: that script's assertion
  is textually `map/page.tsx contains "Map3DCampusView"`, which is no
  longer literally true now that `page.tsx` renders `CampusMapView`
  (which itself still renders `Map3DCampusView`, unmodified, one level
  down — exactly what Section 10 asked for). Verified this is a stale
  assertion, not breakage, by re-running the same script standalone: all
  8 other cases pass, including the full K-N regression chain
  (Phase 9/13/14/15). Per this project's convention of never editing a
  prior phase's committed test file, `test_phase16_3d_map.py` was left
  completely untouched; `test_phase17_satellite_map.py`'s own case
  `B-MAP-PAGE-TOGGLE` re-validates the current wiring correctly.
- **NOT independently verified:** actual in-browser rendering of the
  satellite tiles, marker click/popup interaction, and the mode-toggle's
  visual behavior — no Google Maps API key is configured in this
  environment yet (Section 4), so the live satellite view itself has
  only been verified to *fail gracefully* (the `SatelliteMapUnavailable`
  fallback), not to render actual imagery. Once a real key is added to
  `frontend/.env.local`, this should be manually confirmed in a browser
  before considering the visual experience validated.

## 13. Known limitations

- No building has surveyed GPS coordinates yet — `BuildingMarker`
  renders nothing individually for any of the 5 real buildings today
  (Section 6). They're only reachable via the campus marker's popup
  list, the sidebar, or search.
- The satellite view has not been visually confirmed in a browser with
  a real API key (Section 12) — only its key-missing/load-failure
  fallback states have been exercised.
- `GAT_CAMPUS_CENTER` is a public-source approximation
  (`frontend/src/config/campusLocation.ts`), not an on-site GPS reading
  — good enough for a whole-campus view, not for building-level
  precision.
- `Marker`/`InfoWindow` (legacy Maps JS API) were used instead of
  `AdvancedMarker` to avoid requiring a Google Cloud Map ID on top of an
  API key; a future phase introducing custom marker icons/clustering at
  a larger building count may want to revisit this and add a Map ID.
- The Phase 16 3D scene's own known limitations (placeholder building
  footprints/heights, single-orientation boxes, etc. —
  `docs/phase16_3d_campus_map.md` Section 15) are unchanged; it's
  reused as-is.

## 14. Future integration points

```
PHASE 17 — Real Satellite Map                    ← this phase
        ↓
PHASE 18 — Campus User Location + Mini-Map       ← now complete, see phase18_user_location.md
        ↓
PHASE 19 — Navigation Engine Integration
        ↓
PHASE 20 — Building → Floor → 360° Virtual Tour
        ↓
PHASE 21 — Google Photorealistic 3D Tiles
        ↓
PHASE 22 — Voice Navigation + AI Campus Guidance
```

This phase's structure is built for that chain specifically:

- **Phase 18 (user location) — done:** `GoogleSatelliteMap` already
  exposed a `panTo()`/`resetView()` imperative handle — the "show my
  location" marker landed as an additive component next to
  `CampusMarker`, exactly as predicted here, no restructuring needed.
  See `phase18_user_location.md`.
- **Phase 19 (navigation):** `BuildingGeoInfoPanel`'s "Get Directions"
  button is present, styled, and disabled with an explanatory tooltip —
  the same reserved integration point Phase 16 left for
  `backend/app/navigation/`, carried forward.
- **Phase 20 (indoor tour entry):** unaffected — `frontend/src/features/tour/`
  was not touched this phase either.
- **Phase 21 (Photorealistic 3D Tiles):** `CampusMapView`'s mode-toggle
  pattern is exactly the seam this needs — a third `"3d-photoreal"` mode
  can be added beside `"satellite"`/`"3d"` without restructuring
  `/map/page.tsx` again, per Section 10's explicit ask.
- **Building geo data:** the moment `Building.latitude`/`longitude` are
  populated from a real survey (any phase), `BuildingMarker` starts
  rendering real pins automatically — no code change required, only a
  data change, matching this whole project's placeholder-swap
  discipline (see root `CLAUDE.md`).

## 15. Section 6 vs Section 11 — explicit conflict note

Flagged per Section 22's "if any requirement conflicts... stop and
explain the conflict before making a destructive change": Section 6
implies every building gets an individually-clickable pin on the
satellite tile; Section 11 forbids guessing a building's position to
make that possible. This phase resolved the conflict in Section 11's
favor (no fabricated per-building pins), using the campus-marker popup
list as the honest substitute for "buildings appear on the map,
clickable" (Section 6). This is not a destructive change — no data or
feature was removed — but it is a deliberate interpretation choice the
report calls out for explicit review rather than assuming silently.
