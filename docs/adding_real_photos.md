# Adding Real 360° Photos to the Virtual Tour

This documents how the Main Building tour is built from real Insta360
equirectangular photos, and how to extend it — either with more photos for
Main Building (e.g. staircase/lift connections between floors) or with a
whole new building.

## Architecture

The tour is **backend-driven**, not a static frontend asset. It reuses the
same campus graph that indoor navigation uses — there is no separate
"tour scene" table:

| Concept | Backing model |
|---|---|
| A building | `Building` (`backend/app/models/building.py`) |
| A floor | `Floor` — one per building, ordered by `level` |
| A panorama scene | One `Node` + one `Panorama` row per photo. The `Node` is the graph vertex (used by the pathfinder too); the `Panorama` carries the image path and initial view (`sequence_index`, `initial_yaw`, `initial_pitch`, `hfov`) |
| A hotspot (the arrow you click to move) | An `Edge` row between two `Node`s. `direction` (forward/back/left/right/up/down) plus `yaw`/`hotspot_pitch` control where the hotspot renders in the 360° view; `edge_type` (corridor/stairs/elevator/…) plus `direction` control which icon the frontend shows |

`backend/app/api/v1/tour.py` exposes this as `GET /api/v1/tour/floors`,
`/scenes`, `/scenes/{node_id}`, `/neighbors/{node_id}` — thin read views over
the same tables `/api/v1/navigation` already uses. The frontend hook
`useTourPanoramas` (`frontend/src/hooks/useTourPanoramas.ts`) calls these and
maps the response into the `TourPanorama`/`TourHotspot` shape that
`PanoramaViewer`, `TourSidebar`, `TourControls`, `TourTopBar`, `FloorSelector`
and `Minimap` all consume — none of those components know the backend's
field names.

## Folder → database mapping

Real photos live outside the repo (they're large — see below) in a fixed
5-folder layout, numbered in real walking order:

```
campus photos/
└── main building/
      ├── entrance/       01.jpg, 02.jpg, ...
      ├── ground floor/   01.jpg, 02.jpg, ...
      ├── first floor/    01.jpg, 02.jpg, ...
      ├── seccond floor/  01.jpg, 02.jpg, ...   (source folder name — never renamed)
      └── third floor/    01.jpg, 02.jpg, ...
```

Each folder becomes a `Floor` (level 0–4, "Second Floor" spelled correctly
in the display name regardless of the source folder's typo). Each numbered
photo in a folder becomes one `Node` + `Panorama`, in a straight-line chain:
consecutive photos get a pair of directed `Edge`s (`FORWARD` one way,
`BACK` the other) so you can walk forward and backward through the sequence.

**No cross-floor edges are generated automatically** — nothing in the
filenames says which photo is standing at the staircase/lift to the next
floor, so floors are independently walkable sequences today, switchable via
the floor selector chip bar. See "Adding staircase/lift connections" below
to wire two floors together once you know the photo numbers.

## Regenerating the web-optimized images

Source photos are full-resolution Insta360 exports (8000×4000, ~17MB each)
— too large to serve directly, and too large to commit to git. They're
resized/compressed by a script and the *output* is what's gitignored, not
tracked:

```bash
python scripts/media/build_panoramas.py
# or, if your source folder is somewhere else:
python scripts/media/build_panoramas.py --source "D:\path\to\campus photos\main building"
```

This writes to `frontend/public/panoramas/main-building/{floor-slug}/` (a
primary 4096-wide progressive JPEG + a small preview JPEG per photo, used
for Pannellum's blur-up loading) and a `manifest.json` describing every
floor's ordered scene list. It never modifies, renames, or reorders your
source files — safe to re-run any time (e.g. after adding more photos to a
folder).

## Seeding the database

After generating the manifest, seed (or re-seed) the database:

```bash
alembic upgrade head          # applies the tour scene metadata migration
python scripts/db/seed.py     # idempotent — safe to re-run
```

`scripts/db/seed.py`'s `seed_main_building()` reads
`frontend/public/panoramas/main-building/manifest.json` and creates the
Building/Floors/Nodes/Panoramas/Edges described above. If the manifest is
missing, it logs a warning and skips that section rather than failing the
whole seed — run `build_panoramas.py` first.

## Adding staircase/lift connections between floors

Once you know which photo number on one floor is standing at the same
staircase/lift landing as a photo on the next floor, add a bidirectional
`Edge` pair between those two `Node`s (mirroring the sequential edges
`seed_main_building` already creates), e.g.:

```python
Edge(source_node_id=ground_floor_stair_node.id, target_node_id=first_floor_stair_node.id,
     distance=6, edge_type=EdgeType.STAIRS, direction=EdgeDirection.UP,
     floor_transition=True, accessible=False, yaw=0.0)
Edge(source_node_id=first_floor_stair_node.id, target_node_id=ground_floor_stair_node.id,
     distance=6, edge_type=EdgeType.STAIRS, direction=EdgeDirection.DOWN,
     floor_transition=True, accessible=False, yaw=180.0)
```

You can look up the right `Node` ids from `sequence_index` — e.g. "ground
floor photo 34" is the `Node` joined to the `Panorama` with
`sequence_index=34` under the "Ground Floor" `Floor`. The existing
`scripts/db/seed.py::seed()` function (Admin/CSE/Library/Auditorium section)
shows the same `Edge(...)` pattern for stairs if you want a worked example.

## Adding a whole new building

1. Drop the new building's photos in the same numbered-folder layout under
   a new top-level folder (e.g. `campus photos/library/`).
2. Extend `FLOORS` in `scripts/media/build_panoramas.py` — or better, make it
   accept a building name so the script can process more than one — and add
   a matching `seed_<building>()` function in `scripts/db/seed.py` following
   `seed_main_building()`'s pattern (both are intentionally small and
   self-contained so this is a copy-adapt, not a rewrite).
3. Re-run `build_panoramas.py` and `seed.py`.
4. `useTourPanoramas` currently hardcodes the Main Building (`code="MAIN"`)
   as the tour's subject — once a second building is seeded, that hook (or a
   building-picker UI above it) needs to let the user choose which one to
   view.
