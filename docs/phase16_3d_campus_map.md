# Phase 16 — Interactive 3D Campus Map

## 1. Objective

Replace the reserved-but-non-functional `/map` page (a static "coming in a
future phase" placeholder, Phase 5) with a real, interactive 3D
visualization of the GAT campus: buildings the user can orbit/zoom/pan
around, click to select, and see real information about — built from the
project's existing campus data, laying the foundation Phase 18+ can
extend into the full Virtual Tour + indoor navigation experience.

## 2. Existing frontend architecture (as found)

Next.js 15 App Router, React 19, TypeScript, Tailwind CSS, zustand,
TanStack Query, framer-motion. `/map` (`frontend/src/app/map/page.tsx`)
already existed and was already linked correctly from `Navbar`/`Footer`
("3D Map" / "3D Campus Map") — no homepage wiring was missing. It rendered
two things side by side: `BuildingNodeSidebar` (a fully working sidebar
already fetching real buildings/nodes via `useBuildings()`/`useNodes()`)
and `Map3DPlaceholder` (a static animated box with "coming in a future
phase" text). This phase replaces only `Map3DPlaceholder`; the route,
the sidebar, and the nav links were reused as-is.

A parallel `/campus` + `/campus/[buildingId]` flow already existed too
(`BuildingCard`, `BuildingDetail`, `BuildingPanoramas`) with real
floor/room/panorama data — the new 3D map's "View Building" action links
into this existing page rather than duplicating its rendering logic.

## 3. 3D rendering technology

No 3D library existed in `frontend/package.json` before this phase.
Added: `three` (^0.185), `@react-three/fiber` (^9.7, the React renderer
for Three.js), `@react-three/drei` (^10.7, helper primitives — `OrbitControls`,
`Grid`, `Html`), and `@types/three` as a dev dependency. Versions were
checked against the project's installed React (19.2.8, within
`@react-three/fiber@9.7.0`'s `>=19 <19.3` peer range) before installing.
No competing 3D engine was introduced.

## 4. Data source

**Reused as-is, no new backend endpoint:** the existing generic CRUD
routers `GET /api/v1/buildings`, `/api/v1/nodes`, `/api/v1/floors` — the
same endpoints `BuildingNodeSidebar` and the `/campus` pages already call
via the existing `useBuildings()`/`useNodes()`/`useFloors()` hooks.

**What the data actually contains** (verified live against the running
database, not assumed):

- `Building` (`backend/app/models/building.py`) has **no position,
  footprint, or height columns at all** — only `id`, `campus_id`, `name`,
  `code`, `description`.
- `Node` (`backend/app/models/node.py`) has `pos_x`/`pos_y` (a local 2D
  plane, in meters — see `scripts/db/seed.py`'s `SEQUENTIAL_STEP_DISTANCE_M`)
  and unpopulated `latitude`/`longitude` columns, and an optional
  `building_id`.
- `Floor` has a real `building_id` + `level`.
- Live query at implementation time: **5 real buildings** — Admin Block,
  CSE Block, Library, Auditorium (from the original Phase 5 seed script),
  and Main Building (added later, the same building Phase 9's panorama
  analysis covers — 76 of its nodes carry real `pos_x`/`pos_y`, versus 1
  positioned node each for the original 4).

**What was NOT invented:** building footprint dimensions, building
height, GPS coordinates. See Section 6.

## 5. Campus visualization architecture

`frontend/src/features/map3d/`:

- `campusLayout.ts` — pure function `deriveBuildingPlacements(buildings,
  nodes, floors)` → `BuildingPlacement[]`. No React, no rendering —
  independently reasoned about and testable.
- `CampusScene3D.tsx` — the `<Canvas>`: ground plane + grid, lighting, one
  `<BuildingMesh>` per placement, `OrbitControls`. Exposes an imperative
  `resetView()`/`focusBuilding()` handle via `forwardRef`.
- `BuildingMesh.tsx` — one building's box geometry + hover/click handling
  (R3F's built-in pointer events, not manual raycasting) + a `Html`-based
  floating name label.
- `Map3DCampusView.tsx` — the top-level component: data fetching, loading/
  error states, WebGL check, error boundary, search, reset button,
  selected-building info panel. This is what replaced `Map3DPlaceholder`
  in `map/page.tsx`.
- `Map3DErrorBoundary.tsx` — class-based React error boundary (required —
  boundaries can't be function components) + `isWebGLAvailable()` check.
- `BuildingInfoPanel.tsx`, `MapSearch.tsx` — UI panels, described below.

## 6. Building representation

Each building is a single extruded box (`BoxGeometry`). Per this phase's
own priority order (functionality > interaction > correct data > visual
polish), no GLTF models or per-building custom geometry were attempted.

- **Position** — the building's "entrance"-type Node's `(pos_x, pos_y)`
  when one exists; else its first positioned Node; else (only if a
  building has *no* positioned Node at all) a clearly-flagged grid slot.
  Every one of the 5 real buildings currently has at least one positioned
  node, so **no building in the live database uses the grid fallback
  today** — verified, not assumed (see Section 14).
- **Height** — the REAL Floor-row count for that building × a single
  documented placeholder storey height (3.5m), with a 1-storey minimum so
  a building with zero recorded floors still renders. This is real data
  (a verified count) scaled by one placeholder constant — not a fabricated
  height.
- **Footprint (width/depth)** — no footprint data exists anywhere in the
  project for any building. A single shared placeholder square (14m ×
  14m) is used for every building, deliberately uniform so it never
  implies a per-building size difference the data doesn't support.

## 7. Camera controls

`@react-three/drei`'s `OrbitControls`: rotate, zoom (`minDistance`/
`maxDistance` bounded to the scene's actual size), pan, and
`maxPolarAngle` capped just under horizontal so the camera can't dip below
the ground plane. Default camera position is computed from the real
bounding box of every building's position (never a hardcoded point), so
the whole campus is framed on first load — no empty/black/mis-framed
scene. A floating "Reset View" button (top-right of the canvas) restores
this exact framing via the same computed value.

## 8. Building selection

Click selects a building; state lives in the **existing** `useCampusStore`
(zustand) — the same store `BuildingNodeSidebar` already reads — so
clicking a building in the 3D scene highlights it in the sidebar too, and
vice versa, with no new state management introduced. Selecting shows
`BuildingInfoPanel` (name, code, description — all from `Building`;
real floor count from `Floor`; real mapped-point count from `Node`) with
a "View Building" link into the existing `/campus/[buildingId]` page and
a **disabled** "Get Directions (coming soon)" button — the documented
future integration point (Section 11), not fabricated route data. Hover
highlights the building and shows a floating name label.

## 9. Search

`MapSearch.tsx` — a plain client-side filter over the already-loaded
`useBuildings()` list (no new search endpoint, no duplicate data source).
Selecting a result sets the selection and calls the scene's
`focusBuilding()` to move the camera there.

## 10. Backend integration

No backend code was modified. The existing `/api/v1/buildings`,
`/api/v1/nodes`, `/api/v1/floors` CRUD endpoints (already used by
pre-existing pages) were the only data source used — reused, not
duplicated, per Section 20's explicit instruction.

## 11. Navigation integration point

`backend/app/navigation/` (`pathfinding.py`, `graph_builder.py`,
`direction_formatter.py`, `resolvers.py`, `building_search.py`,
`room_search.py`, `nearby.py`) was **not modified or imported** from the
frontend. "Get Directions" in `BuildingInfoPanel.tsx` is present, styled,
and positioned as the real future action — but rendered `disabled` with
an explanatory `title` tooltip, so no fabricated route is ever shown. A
future phase can wire it to a real `/api/v1/navigate`-style endpoint (none
currently exists — the old one was deliberately removed in Phase 9) built
on top of this already-intact navigation engine.

## 12. Future panorama integration

Not implemented this phase (explicitly out of scope — Section 18 says
"do not implement a fake panorama system unless the required assets
already exist"). The clean future path this phase's structure enables:
`BuildingPlacement` (this phase) → an "Enter Building" action on
`BuildingInfoPanel` → a floor/room selector (existing `Floor`/`Room` data,
already fetched on `/campus/[buildingId]`) → the existing
`PanoramaViewer`/`PanoramaEngine` (`frontend/src/features/tour/`,
untouched) for buildings with real panorama coverage (currently "Main
Building", per Phase 9). No code changes were made to
`frontend/src/features/tour/` or any panorama asset.

## 13. Performance considerations

- 5 buildings today → 5 simple box meshes; no instancing needed at this
  scale (documented here as the point to revisit if the building count
  grows into the dozens).
- No shadows, no post-processing, no textures — a flat-shaded scene keeps
  GPU cost low on ordinary laptops.
- `dpr={[1, 1.5]}` caps device-pixel-ratio upscaling on high-DPI screens.
- The `<Canvas>` is loaded via `next/dynamic({ ssr: false })` — Three.js
  never runs during Next.js's server render, and the heavy 3D bundle is
  excluded from every other route's JS payload.
- Hover-only `Html` labels (not always-rendered) avoid a DOM node per
  building at rest.

## 14. Testing

No frontend unit-test runner exists anywhere in this project (confirmed:
no Jest/Vitest/Testing Library in `frontend/package.json`, and no prior
phase added one — every phase's frontend gate has been `npm run
type-check` + `npm run lint`). Adding one now would be a large,
out-of-scope architectural addition for this phase alone, so it was not
done. Instead:

- `npm run type-check` — clean.
- `npm run lint` — clean (one warning found and fixed during development:
  an unnecessary eslint-disable comment).
- `npm run build` — succeeds; `/map` compiles to a normal statically-
  prerendered route with its 3D bundle correctly split out.
- `scripts/ai/test_phase16_3d_map.py` (new) — structural checks (route
  file wired to the real component, Navbar link correct, all new
  component files present, dependencies added with no competing engine),
  a live check against the real running backend (`/api/v1/buildings` +
  `/api/v1/nodes` return real, non-empty, positioned data), and a full
  re-run of the Phase 9/13/14/15 regression suites, unmodified.
- Live HTTP verification: both `/` and `/map` return 200 with no
  server-side compile/runtime errors in the Next.js dev server log.
- **NOT independently verified**: actual in-browser rendering (canvas
  pixels, orbit/zoom gestures, click interactions, browser console
  errors). No browser-automation/screenshot tool was available in this
  environment — this is stated honestly rather than assumed. The
  strongest available substitute evidence is: a clean production build
  (which fully compiles and statically analyzes the Three.js/R3F scene
  graph), a clean dev-server compile with no runtime errors logged for
  either route, and the same component patterns (hooks, error states)
  already proven working elsewhere in this codebase. Manually opening
  `http://localhost:3000/map` is recommended before considering this
  phase visually confirmed.

## 15. Known limitations

- Building footprint and real height are placeholder/derived values, not
  survey data (Section 32 compliance — clearly documented, not
  fabricated; see Section 6).
- 4 of 5 buildings have only their entrance node positioned (1 point each)
  — precise building orientation/rotation isn't derivable from a single
  point, so every building box faces the same default orientation.
- "Get Directions" is a disabled placeholder, not a working feature.
- No panorama/indoor-tour entry point yet (by design — Section 18).
- Phase 9's spatial knowledge base (`data/campus_spatial/`) and this
  Node/Building graph are still two separate datasets that happen to
  refer to the same real "Main Building" — they are not yet merged or
  cross-referenced; this phase did not attempt that (out of scope, and
  risky to rush).
- No mobile/touch-specific gesture tuning was hand-tested (OrbitControls
  supports touch by default, but device-specific behavior wasn't
  independently verified for the same reason as Section 14's browser
  limitation).

## 16. Future improvements

- Wire "Get Directions" to a real route-computation endpoint built on the
  existing `backend/app/navigation/` engine.
- "Enter Building" → floor/room selector → existing panorama viewer, for
  buildings with real panorama coverage.
- Survey real building footprints/heights/orientations to replace the
  placeholder box geometry with accurate extruded footprints.
- Cross-reference `data/campus_spatial/` with the Building/Node graph so
  Phase 9's real room-level evidence is queryable from the 3D map too.
- GLTF/textured models for at least the most-visited buildings once real
  assets exist (explicitly not attempted now — Section 25 forbids
  claiming photorealism that doesn't exist).
