# Phase 18 — User Location on the Real Satellite Campus Map

## 1. Objective

Show the user's real, live GPS position on top of Phase 17's satellite
map — a Google-Maps-style blue dot with an optional accuracy circle,
triggered by an explicit "My Location" button (never requested
automatically on page load), updated in real time via
`watchPosition()`, without ever fabricating a coordinate.

## 2. Inspection performed before implementing

Read `frontend/src/features/mapSatellite/GoogleSatelliteMap.tsx`,
`SatelliteCampusMap.tsx`, `CampusMarker.tsx`, and
`frontend/src/config/campusLocation.ts` in full before writing any code.
Confirmed: the satellite map's imperative ref pattern
(`GoogleSatelliteMapHandle` with `resetView()`/`panTo()`, exposed via a
null-rendering `ResetViewController` child that calls `useMap()` from
inside `<Map>`'s own context) was the exact seam this phase needed —
extended, not replaced. No existing user-location code, no existing
geolocation usage anywhere in the frontend before this phase (checked).

## 3. Components created

`frontend/src/features/mapSatellite/`:

- **`useUserLocation.ts`** — the state machine. Wraps
  `navigator.geolocation` directly; every reported coordinate comes from
  `geo.coords.latitude`/`geo.coords.longitude`/`geo.coords.accuracy` —
  nothing is ever hardcoded or defaulted to a fake value. States: `idle
  → requesting → available`, or `denied`/`unavailable`/`unsupported` on
  failure. Feature-detects `navigator.geolocation` on mount (passive,
  does not prompt) but does **not** call `getCurrentPosition` until
  `requestLocation()` is invoked — that only happens from the "My
  Location" button's click handler, so no permission prompt fires on
  page load.
- **`geoDistance.ts`** — a plain haversine distance function, used only
  to decide whether to show the "outside campus" hint (see Section 8).
- **`UserLocationMarker.tsx`** — the visual marker: a blue vector
  `Marker` (a `google.maps.Symbol` circle, white stroke) plus two
  `Circle` overlays — a static translucent accuracy circle (only
  rendered when the browser actually reported an accuracy) and an
  animated "pulse" circle whose radius/opacity oscillate via
  `requestAnimationFrame`. See Section 5 for why `Marker`+`Circle`
  rather than `AdvancedMarker`.
- **`UserLocationStatusBanner.tsx`** — the small dismissible message
  shown for denied/unavailable/unsupported states, and for the "outside
  campus" hint.

Modified:

- **`GoogleSatelliteMap.tsx`** — added a `userPosition` prop, renders
  `<UserLocationMarker>` as a `<Map>` child when present, and added
  `centerOnUser(latitude, longitude)` to `GoogleSatelliteMapHandle`
  (implemented in the same `ResetViewController` that already had
  `resetView`/`panTo`) — deliberately a **separate** method from
  `resetView()`, per this phase's explicit requirement that "My
  Location" and "Return to GAT Campus" stay two distinct actions.
- **`SatelliteCampusMap.tsx`** — wires `useUserLocation()`, a "My
  Location" button (next to the existing "Return to GAT Campus"
  button), the recenter-once-per-click logic (Section 7), and the
  status/outside-campus banner.
- **`frontend/src/config/campusLocation.ts`** — added
  `GAT_CAMPUS_USER_LOCATION_ZOOM` (19) and `CAMPUS_NEAR_RADIUS_M` (300,
  a heuristic — see Section 8).

Nothing in `map3d/` (the Phase 16 3D view) was touched — this feature is
scoped entirely to the satellite view, matching the phase's explicit
scope ("Do NOT create duplicate map implementations").

## 4. Geolocation API usage and permission handling

Directly `navigator.geolocation.getCurrentPosition()` for the first fix,
then `navigator.geolocation.watchPosition()` for live updates —
`enableHighAccuracy: true` on both. Exactly one watcher is ever active
(a second "My Location" click clears the previous watcher via
`clearWatch()` before starting a new one); the watcher is also cleared
on unmount via a `useEffect` cleanup. Errors are mapped from
`GeolocationPositionError.code`: `PERMISSION_DENIED` → the "denied"
message from the spec verbatim; anything else (`POSITION_UNAVAILABLE`,
`TIMEOUT`) → the "unavailable" message. Missing `navigator.geolocation`
entirely → the "unsupported" message, both from passive mount-time
feature detection and defensively inside `requestLocation()` itself.

## 5. Marker design and why `Marker`+`Circle`, not `AdvancedMarker`

Google's `AdvancedMarkerElement` (what `@vis.gl/react-google-maps`'s
`AdvancedMarker` wraps) **requires** a Google Cloud "Map ID" to render
at all. Phase 17 deliberately kept this satellite map's only required
configuration to a single API key — introducing a Map ID requirement
now would break that promise for a feature this phase's own spec didn't
ask to add. So the blue dot uses a plain `Marker` with a vector
`google.maps.Symbol` icon (`SymbolPath.CIRCLE`, blue fill, white
stroke) — this is the same technique classic (non-Advanced) Google Maps
JS apps have used for a "my location" dot for years, and needs no image
asset. The "pulse" is a `Circle` overlay (a real vector shape, so its
`radius`/`fillOpacity` animate smoothly on every `requestAnimationFrame`
tick) rather than a CSS animation on a DOM element, since `Marker`
doesn't give you a real DOM node to animate.

Visually distinct from `BuildingMarker`/`CampusMarker` (both default red
map pins) by design — blue vs. red is an unambiguous "this is you, not
a place" signal, matching the spec's explicit requirement.

## 6. Real-time updates without aggressive re-centering

`watchPosition()` updates `useUserLocation`'s `position` state on every
GPS fix, which re-renders `UserLocationMarker` at its new coordinates —
this alone never moves the camera. Camera centering only happens via
`GoogleSatelliteMapHandle.centerOnUser()`, called from a `useEffect` in
`SatelliteCampusMap.tsx` that fires **once** per "My Location" click: a
`shouldRecenterOnNextFixRef` flag is set `true` in the click handler,
and the effect (watching `position`) pans+zooms and immediately resets
the flag to `false` the moment a position becomes available. Every
subsequent `watchPosition` tick updates `position` again, re-running the
effect, but the flag is already `false`, so the camera is left alone —
exactly the "don't fight the user's pan/zoom" behavior requested.
Clicking "My Location" again sets the flag and recenters once more.

## 7. Camera behavior — two distinct actions

```
"My Location" button  → GoogleSatelliteMapHandle.centerOnUser(lat, lng)
                         → pans to the REAL user GPS position, zoom 19

"Return to GAT Campus" → GoogleSatelliteMapHandle.resetView()
                         → pans to GAT_CAMPUS_CENTER (Phase 17), zoom 18
```

These were already separate before this phase (`resetView`); this phase
added `centerOnUser` as a sibling method on the same handle rather than
overloading `resetView` — clicking "Return to GAT Campus" never routes
through the user's location, and vice versa. Phase 17's default GAT
campus center/zoom constants are untouched.

## 8. Campus boundary handling

`CAMPUS_NEAR_RADIUS_M` (300m, in `campusLocation.ts`) is a documented
**heuristic**, not a surveyed campus boundary polygon — none exists (see
`phase17_satellite_campus_map.md` Section 6). GAT is roughly a 10-acre
campus (~200m across treated as a circle), so 300m gives a small margin
for normal GPS drift while genuinely on campus. `SatelliteCampusMap.tsx`
computes the haversine distance from the user's real position to
`GAT_CAMPUS_CENTER` on every update and shows "You are outside the
campus area." (dismissible) when it exceeds that radius. **The user's
real coordinate is never altered, clamped, or snapped** based on this
check — it only controls whether an informational message is shown. The
blue dot always renders at the real reported position, on-campus or
not.

## 9. Privacy considerations

Location handling is 100% client-side: `useUserLocation.ts` never calls
`fetch`/`apiClient`, so no coordinate is ever sent to the backend. No
`console.log` of `latitude`/`longitude`/`accuracy` anywhere in the new
code (checked). Location state lives only in React component state —
nothing is persisted to `localStorage`, cookies, or any store; refreshing
the page or navigating away clears it, and a fresh "My Location" click
is required to re-share it. Repeats Phase 17's grep check that no Google
Maps API key is hardcoded anywhere in the repo (see
`scripts/ai/test_phase18_user_location.py`'s `case_e`).

## 10. Testing performed

- `npm run type-check` — clean (including `google.maps.SymbolPath` and
  `Circle`/`Marker` prop typing, resolved via the `@types/google.maps`
  package `@vis.gl/react-google-maps` already depends on — no new
  type-only dependency needed).
- `npm run lint` — clean, no warnings.
- `npm run build` — succeeds; `/map`'s bundle size is essentially
  unchanged from Phase 17 (still ~198 kB First Load JS — the new code is
  small and already inside the dynamically-loaded satellite chunk).
- `scripts/ai/test_phase18_user_location.py` (new) — structural checks
  (all new files exist), a real-API-usage check (greps
  `useUserLocation.ts` for actual `navigator.geolocation.
  getCurrentPosition`/`watchPosition`/`clearWatch` calls and confirms
  reported coordinates trace back to `geo.coords.latitude`/`longitude`,
  not a literal), a check that no mount-time effect calls
  `getCurrentPosition`/`watchPosition` (confirms no auto permission
  prompt on load), the Section 12 no-hardcoded-key check, and a full
  regression re-run of `test_phase17_satellite_map.py` (which itself
  cascades through Phase 13-16). See the Phase 18 report for the exact
  pass count — the only expected non-pass is the same already-documented
  Phase 16 route-check staleness from the Phase 17 report (not a new
  regression; nothing about Phase 18 touched that file).
- **NOT independently verified:** actual browser permission-prompt
  behavior, the blue dot's real on-screen appearance/animation, and
  real device GPS accuracy — this environment has no browser automation
  available for a live permission-grant flow, and (same as Phase 17) no
  Google Maps API key is configured here, so the satellite tiles
  themselves haven't been visually confirmed either. Manually testing in
  a browser with a real key — clicking "My Location", granting/denying
  the permission prompt, watching the dot update while walking — is
  recommended before considering this phase visually confirmed.

## 11. Known limitations

- Per this phase's own explicit instruction: **browser GPS is not
  accurate enough for classroom/room-level indoor positioning.** This
  phase deliberately provides only the user's real outdoor/geographic
  GPS position — not a location on any indoor floor plan. A future
  indoor-navigation phase would need to map this GPS fix (once inside
  the accuracy-circle's real uncertainty) onto the nearest entrance node
  in the existing campus graph, then hand off to indoor logic — that
  mapping does not exist yet and was not attempted here.
- `CAMPUS_NEAR_RADIUS_M` is a heuristic, not a surveyed boundary
  (Section 8) — a user standing just past a real campus boundary might
  not trigger the "outside campus" hint, or a user near the edge might
  trigger it while still genuinely on campus, depending on real GPS
  error at that moment.
- The pulse animation runs continuously via `requestAnimationFrame`
  while the blue dot is visible — a deliberately simple implementation
  (see Section 5); a very large number of simultaneous animated
  overlays would not scale, but this phase only ever renders one.
- No mobile/touch-specific testing was performed for the permission
  prompt or button tap target (same caveat as Phase 16/17's own
  unverified-on-device limitations).
- Not tested against browsers/devices with GPS entirely disabled at the
  OS level (distinct from browser permission denial) — this should
  surface as `POSITION_UNAVAILABLE` → the "unavailable" message, per
  the Geolocation API spec, but wasn't hardware-tested.

## 12. Future integration with indoor navigation

```
Phase 18 (this phase)     — real outdoor GPS position
        ↓
Phase 19 — Navigation Engine Integration
        ↓
Phase 20 — Building → Floor → 360° Virtual Tour indoor handoff
```

The clean seam this phase leaves: `useUserLocation()`'s `position`
(`{ latitude, longitude, accuracy }`) is already exactly the shape a
future "snap to nearest entrance node" function would consume — it
would compare the user's real position against the existing
`Node`/`Edge` graph's entrance-type nodes (once those carry real
`latitude`/`longitude` too, per `Building.latitude`/`longitude` from
Phase 17) and hand off to `backend/app/navigation/`'s existing
pathfinding from there. No changes to this phase's components would be
required — a future phase would add a consumer of `useUserLocation`,
not modify it.

## 13. Distinguishing the three location concepts

Per this phase's explicit requirement, these are three separate values
and must never be conflated:

| Concept | Source | Where it lives |
|---|---|---|
| **Real user GPS location** | `navigator.geolocation` (this phase) | `useUserLocation()`'s `position`, client-only, never persisted |
| **GAT campus center** | Public map data, Phase 17 | `GAT_CAMPUS_CENTER` in `campusLocation.ts` — the "Return to GAT Campus" target |
| **Future indoor navigation location** | Not implemented | Would be a campus-graph `Node`, derived from the GPS fix above, once a future phase builds that mapping |
