# Phase 19 — GPS-to-Campus Navigation Integration

## 1. Objective

Connect Phase 18's real browser GPS position to the existing campus
navigation graph: find the nearest known campus node to the user's real
position, let them pick a destination (reusing the existing
building-selection UI), request a route from the existing A* engine, and
show it on the satellite map — without claiming indoor/room-level
accuracy from GPS, and without inventing coordinates anywhere data
doesn't exist.

## 2. A critical architectural finding from inspection

Before writing any code, `backend/app/navigation/`,
`backend/app/api/v1/`, `scripts/ai/campus_tools.py`, and
`scripts/ai/navigation_agent.py` were read in full. This surfaced a fact
the phase's own premise didn't anticipate: **there is no REST endpoint
or chat tool for point-to-point routing today.** Phase 9 deliberately
removed it — `campus_tools.py`'s old `navigation_tool(to, from)` and
`navigation_agent.py`'s "route" intent classification were deleted, with
an explicit scope note: *"this project is a virtual campus tour + AI
information assistant, not an indoor navigation/routing system."*
`backend/app/api/v1/chat.py` still references a `"navigation_tool"`
string in `_build_navigation_info()`, but nothing can ever produce that
value anymore — it's dead code left over from before Phase 9, not
something this phase touched.

Crucially, Phase 9 **did not** delete the underlying graph engine: `app.navigation`'s
`build_graph`, `find_shortest_path` (A*), `format_directions`, and
`backend/app/schemas/navigation.py`'s `RouteResponse`/`RouteStep` were
all left completely intact — Phase 9's own docstring says so explicitly
— just disconnected from any caller. This is exactly the "existing
navigation engine already accepts start node ID / destination node ID"
case this phase's own instructions anticipated, so the correct action
was to **re-wire the existing intact engine to a new minimal endpoint**,
not build anything new. Verified live: `find_shortest_path`/
`format_directions` computed a real 3-node route with correct
turn-by-turn text on the first call (see Section 10).

This aligns with, rather than contradicts, Phase 17's own "Future
integration points" table, which already named "Phase 19 — Navigation
Engine Integration" as the next step, and Phase 17's
`BuildingGeoInfoPanel`'s disabled "Get Directions (coming soon)" button,
explicitly described then as *"the reserved integration point for the
existing backend navigation engine."*

## 3. Backend: GET /api/v1/navigate

`backend/app/api/v1/navigate.py` (new, ~50 lines) — a thin wrapper:

```
build_graph(db) -> find_shortest_path(graph, start, dest) -> format_directions(path)
-> RouteResponse
```

No pathfinding logic, graph structure, or response schema was
reimplemented — every piece is imported from `app.navigation`
(unmodified) and `app.schemas.navigation` (unmodified, already existed).
Registered in `backend/app/api/v1/__init__.py` alongside the other
routers. `GET` with query params (`start_node_id`, `destination_node_id`,
optional `accessible_only`), matching this codebase's actual established
convention for stateless read/compute endpoints (`tour.py`'s
`/scenes?building_id=...`) rather than CLAUDE.md's older `POST
{from, to}` sketch, which predates node-ID-based GPS integration and
used building/room *names*, not IDs.

Takes node IDs only — **never** a raw latitude/longitude. Resolving GPS
to a node ID is entirely a client-side concern (Section 5), so the
backend never receives, stores, or logs a coordinate for this feature.
Errors (unknown node, no path) raise the existing `NoPathFoundError`
(`app.core.exceptions`, already mapped to 404 by the app's existing
global exception handler) — zero new error-handling code needed.

## 4. GPS → nearest node flow

```
useUserLocation()  (Phase 18, reused, not re-instantiated)
        ↓ userPosition { latitude, longitude, accuracy }
findNearestCampusNode(userPosition, nodes)   (Phase 19, new)
        ↓ nearestNode { nearestNodeId, nearestNodeName, distanceMeters, latitude, longitude } | null
useCampusNavigation()'s nearestNode state
```

`findNearestCampusNode.ts` filters to nodes with **real, non-null**
`latitude`/`longitude` (`backend/app/models/node.py`'s columns) and
picks the closest by `haversineDistanceMeters` — imported from Phase
18's `geoDistance.ts`, not reimplemented. Verified live: **0 of 100**
nodes in the running database have a real coordinate today (checked via
`GET /api/v1/nodes`) — every entrance node (Admin Block, CSE Block,
Library, Auditorium, Main Building) has `latitude: null, longitude:
null`. This means `findNearestCampusNode` correctly and honestly returns
`null` for every real GPS position right now — not a bug, the same
"structure ready, dormant until real data" pattern Phase 17 established
for building markers. The moment any node gets a surveyed coordinate,
matching starts working with no code change.

`useCampusNavigation.ts` only recomputes the nearest node when the user
has moved more than 8m from the position it was last computed from
(Section "GPS FOLLOWING BEHAVIOR" — avoids flip-flopping the navigation
start point on GPS jitter). It takes `userPosition` as a parameter — it
does **not** call `useUserLocation()` itself, so there is still exactly
one `navigator.geolocation` watcher in the whole app (Phase 18's,
unchanged).

## 5. Navigation integration (destination → route)

```
selectedBuildingId  (existing useCampusStore — unchanged, same state
                      BuildingNodeSidebar/MapSearch already write to)
        ↓
resolveDestinationNode(buildingId, nodes)   (Phase 19, new)
        ↓ CampusNode | null   (entrance-type node preferred, mirrors
                                backend/app/navigation/resolvers.py's
                                resolve_building_entrance_node exactly)
        ↓
navigateApi.getRoute(nearestNode.id, destinationNode.id)
        ↓
GET /api/v1/navigate  ->  RouteResponse (Section 3)
```

No new graph, no second A*, no duplicate routing engine — the only new
logic anywhere in this chain is "which existing Node object does this
existing Building resolve to" (`resolveDestinationNode.ts`), which
mirrors an existing backend function rather than inventing a new rule.

## 6. Destination selection

**Reused, not duplicated.** `NavigationPanel.tsx` reads
`useCampusStore.selectedBuildingId` — the exact same state
`BuildingNodeSidebar` (click a building) and `MapSearch` (search and
select) already write to, both completely unmodified. Selecting a
building anywhere in the app now also sets it as the navigation
destination; no second destination picker exists.

## 7. Route display

Two representations, per Section 8's explicit fallback design:

1. **Turn-by-turn text** (`NavigationPanel.tsx`) — always shown once a
   route is found; this is `RouteResponse.turn_by_turn`, the backend's
   existing real, human-readable directions (`direction_formatter.py`,
   unmodified), not something this phase invented.
2. **Map polyline** (`RoutePolyline.tsx`) — drawn on the satellite map
   **only if every node in the route's path has a real surveyed
   latitude/longitude.** Today that's never true (Section 4), so nothing
   is drawn on the map itself — deliberately, not a bug. Drawing a line
   through nodes that only have local `pos_x`/`pos_y` (Phase 16's
   scene-relative plane, no real-world orientation — see
   `campusLayout.ts`'s own docstring) would fabricate a geographic path
   exactly the way Phase 17 refused to fabricate building positions. The
   satellite imagery, existing markers, and campus context are never
   replaced or hidden by this — `RoutePolyline` either draws a real line
   or renders nothing; it never substitutes a fake one.

## 8. Error handling (Section "ERROR HANDLING", all 10 cases)

| Case | Handling |
|---|---|
| Permission denied | Phase 18's existing banner (unchanged) |
| Location unavailable | Phase 18's existing banner (unchanged) |
| GPS timeout | Phase 18's existing `unavailable` status (unchanged) |
| Outside campus | Phase 18's existing `CAMPUS_NEAR_RADIUS_M` hint (reused, not duplicated) |
| No nearby supported node | `NavigationPanel` shows "No supported GPS starting point nearby yet" |
| Destination not selected | "Select a destination building first" |
| Navigate API failure (non-404) | `getApiErrorMessage()` (existing helper, reused) shown in the panel |
| No route exists (404 from the engine) | "No walking route exists between your location and that destination." |
| Destination has no node mapping | `resolveDestinationNode` returns null → same "select a destination" message |
| Poor GPS accuracy | Not separately gated — `accuracy` is available on `nearestNode`'s source position for a future phase to threshold; not fabricated into a false precision claim either way |

No raw stack trace or backend error detail is ever shown to the user —
`getApiErrorMessage()` (existing, from Phase 1's API client layer)
already handles that translation.

## 9. Privacy behavior

Confirmed via `scripts/ai/test_phase19_gps_navigation.py`'s
`case_g_no_gps_persistence_or_logging`: no `localStorage`/
`sessionStorage` write, no `console.log` of position data, anywhere in
the new code. `GET /api/v1/navigate` takes and needs only `start_node_id`/
`destination_node_id` — a real latitude/longitude is never sent to, read
by, or logged by the backend for this feature. Everything upstream of
the node-ID resolution stays exactly where Phase 18 put it: client-side,
in-memory, cleared on refresh.

## 10. Coordinate requirements for full GPS navigation coverage

For this feature to produce a real route from a real GPS position, at
least: (a) the node the user is nearest to, and (b) their destination's
node, need real surveyed `latitude`/`longitude` in
`backend/app/models/node.py`. Today: **zero of 100 nodes** have this.
Populating it (e.g. a GPS reading taken at each building entrance and
major outdoor junction) is the single concrete data-collection task that
unlocks this phase's live behavior — no code change would be needed
after that.

## 11. Limitations

- **GPS navigation is not live-usable today** — verified: 0 nodes have
  real coordinates, so `findNearestCampusNode` always returns `null` in
  practice right now. The full pipeline (endpoint, hook, UI, error
  states) is implemented and independently verified to work correctly
  (Section 10's live route test used two real node IDs directly,
  bypassing the GPS-matching step, to confirm the reused A* engine
  itself still works end-to-end).
- **Outdoor GPS only, by design** — per the phase's own explicit
  requirement, nothing here claims classroom/floor-level positioning.
  The nearest-node match is an approximation based on whatever
  geographic data exists, never a guess dressed up as precision.
- The route polyline never renders today (Section 7) — the turn-by-turn
  text list is the only live route representation until node coordinates
  exist.
- `CAMPUS_NEAR_RADIUS_M`'s 300m heuristic (Phase 18, reused unchanged)
  still applies and is still not a surveyed boundary.
- No accessibility-only routing UI was added (the backend endpoint
  supports `accessible_only`, unused by the frontend this phase — a
  small, low-risk future addition, not attempted here to keep scope
  tight).
- Not visually verified in a browser (same environment limitation as
  Phase 17/18 — no Google Maps API key configured here).

## 12. Testing results

See the Phase 19 report for the exact pass count from
`scripts/ai/test_phase19_gps_navigation.py`. Also run:
`npm run type-check`/`lint`/`build` (frontend), `ruff check backend` /
`black --check backend` / `mypy backend` (the one new backend file), and
a direct live check of `GET /api/v1/navigate` with two real entrance
node IDs (Admin Block Entrance → CSE Block Entrance), which returned a
real 3-node, 52m route with correct turn-by-turn text on the first
attempt — confirming the reused engine still works exactly as it did
before Phase 9 disconnected its chat entry point.

## 13. Files created

- `backend/app/api/v1/navigate.py`
- `frontend/src/types/navigation.ts`
- `frontend/src/api/navigate.ts`
- `frontend/src/features/mapSatellite/findNearestCampusNode.ts`
- `frontend/src/features/mapSatellite/resolveDestinationNode.ts`
- `frontend/src/features/mapSatellite/useCampusNavigation.ts`
- `frontend/src/features/mapSatellite/NavigationPanel.tsx`
- `frontend/src/features/mapSatellite/RoutePolyline.tsx`
- `scripts/ai/test_phase19_gps_navigation.py`
- `docs/phase19_gps_navigation.md`

## 14. Files modified

- `backend/app/api/v1/__init__.py` — registered the new `navigate` router.
- `frontend/src/types/index.ts`, `frontend/src/api/index.ts` — barrel exports for the two new modules.
- `frontend/src/features/mapSatellite/GoogleSatelliteMap.tsx` — added `route`/`nodes` props, renders `RoutePolyline`.
- `frontend/src/features/mapSatellite/SatelliteCampusMap.tsx` — wires `useCampusNavigation`, adds the "Navigate" button and `NavigationPanel`.

## 15. Files intentionally untouched

`backend/app/navigation/*.py` (the engine itself), `backend/app/schemas/navigation.py`,
`scripts/ai/campus_tools.py`, `scripts/ai/navigation_agent.py`,
everything in `frontend/src/features/map3d/` (Phase 16),
`frontend/src/config/campusLocation.ts`, `CampusMarker.tsx`,
`BuildingMarker.tsx`, `BuildingGeoInfoPanel.tsx`, `SatelliteMapUnavailable.tsx`
(Phase 17), and `useUserLocation.ts`, `UserLocationMarker.tsx`,
`UserLocationStatusBanner.tsx`, `geoDistance.ts` (Phase 18) — all reused
by reference/import, none edited.

## 16. Future indoor-navigation integration

```
Phase 19 (this phase) — outdoor GPS -> nearest campus node -> route
        ↓
Phase 20 — Building -> Floor -> 360° Virtual Tour handoff
```

The conceptual model this phase establishes and does not cross:

```
REAL GPS -> OUTDOOR CAMPUS POSITION -> NEAREST KNOWN CAMPUS NODE
         -> CAMPUS NAVIGATION ROUTE -> BUILDING / ENTRANCE / DESTINATION
```

Once a route arrives at a building's entrance node, a future phase could
hand off from there into the existing indoor panorama/tour system
(`frontend/src/features/tour/`, untouched by this phase) using the same
node-ID vocabulary this phase already speaks — `RouteResponse`'s final
`path_node_ids` entry is already a real campus graph node, the same kind
of ID the Tour engine keys scenes on. No new indoor-positioning system
was built or implied here.
