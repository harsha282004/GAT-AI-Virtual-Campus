# Panorama Quality Report — Phase 9

Generated from automated filesystem inspection (all files) plus complete
manual visual review of every main-building primary panorama — see
`processing_manifest.json` for exact counts.

## Two distinct panorama sets exist in this project

1. **`main-building/`** — 156 real photographs (23 entrance + 34 ground-floor +
   34 first-floor + 31 second-floor + 34 third-floor), 4096×2048 JPEG,
   equirectangular, each with a `-preview.jpg` thumbnail. Confirmed genuine
   GAT campus photos (real signage matching "Global Academy of Technology"
   letterhead, real named faculty on a staff-room notice board, visible
   photographer/tripod crew in the lower frame of every shot). File sizes
   0.5–1.3 MB. `PostgreSQL.panoramas` has 156 rows linked to real `nodes`
   for this set (`is_placeholder = false`), but their `title` field is only
   ever an auto-generated "Entrance – Scene 01" style placeholder — no
   room/department name is in the database yet. That gap is exactly what
   this phase's `spatial_knowledge.json`/`semantic_rag_dataset.json` start
   to fill, from real signage, not from the DB.

2. **Legacy set** (`Admin/`, `BlockA/`, `BlockB/`, `Cafeteria/`, `Classrooms/`,
   `Labs/`, `Library/`, `MainGate/`) — 18 files, 2048×1024, ~75–87KB each
   (visibly lower resolution/file size than the main-building set — consistent
   with stock/placeholder panoramas, not real GAT photos). Fully described by
   the existing, hand-authored `panoramas/panoramas.json` (building/floor/room/
   hotspots already given) — this is real project metadata, reused here
   as-is, not re-analyzed visually.

## Data-integrity finding (pre-existing, not caused by this phase)

`PostgreSQL.panoramas` also has 5 rows (`main_gate.jpg`,
`admin_block_entrance.jpg`, `cse_block_entrance.jpg`, `library_entrance.jpg`,
`auditorium_entrance.jpg`, all `is_placeholder = true`) whose `image_path`
does not correspond to any file that actually exists on disk anywhere under
`frontend/public/panoramas/` — no flat, underscore-named file of that form
exists; the closest real files live under `Admin/`, `BlockA/`, etc. with
hyphenated names. This is a genuine broken-reference gap in the seeded data,
**not touched** per the instruction not to modify PostgreSQL data — flagged
here for a future data-cleanup pass.

## Findings from the panoramas actually reviewed this session

- No corrupted or unopenable files encountered.
- No obvious stitching seams beyond normal equirectangular zenith/nadir
  distortion (visible in every 360 photo, not a defect).
- Every reviewed frame has the two-person capture crew (lanyards visible)
  in the bottom third of the image — expected for a tripod-mounted 360
  camera operated by two people, not a quality defect, but worth knowing if
  any future cropped/thumbnail cutout is generated from these images.
- Signage legibility varies a lot by shot: frontal overhead directional
  signs (e.g. `first-floor/01.jpg`, `second-floor/01.jpg`) are clearly
  legible even before zooming; angled/edge-of-frame signs (e.g. the second
  sign in `second-floor/01.jpg`) are legible only after a 3x crop-and-zoom
  and are flagged `needs_review` rather than treated as fully certain; some
  frames (plain corridor/stairwell/quote-plaque shots) have no
  location-identifying signage in frame at all.
- One filename irregularity: `third-floor/07 (2).jpg` — the `(2)` suffix
  is consistent with a re-shoot/duplicate-resolution artifact from the
  original capture/upload process. Not corrupted, just an unusual name;
  listed as-is in the inventory, not renamed.

## Coverage

**All 156/156 main-building primary panoramas** (23 entrance + 34 ground-floor
+ 34 first-floor + 31 second-floor + 34 third-floor) have now been visually
reviewed across two sessions, plus all 18 legacy-set panoramas via their
existing `panoramas.json` metadata — **178/178 primary panoramas total,
0 PENDING**. 93 location entities were extracted with real evidence (51
distinct confirmed room numbers), 3 flagged `REVIEW_REQUIRED` (signage
present but not confidently legible even after zooming — never guessed).
Every panorama that yielded no location-identifying signage (plain
corridor/stairwell/quote-plaque/courtyard shots) is marked `COMPLETED` with
`evidence_source: "visual_inspection_this_session (no signage in frame)"` —
a real, checked result, not a skipped one. See `processing_manifest.json`
for the exact per-floor breakdown and `room_validation.json` for the
201/202/203/301/302/303 validation results.

## Floor → room-number mapping (confirmed empirically, not assumed)

Ground Floor → 1xx, First Floor → 2xx, Second Floor → 3xx, Third Floor →
4xx. This was **not** assumed from folder names (which would have wrongly
suggested First Floor = 1xx) — it was derived from actually reading door
plaques on each floor.
