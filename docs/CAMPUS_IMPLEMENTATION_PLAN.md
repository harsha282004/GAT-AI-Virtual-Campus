# Campus Intelligence — Implementation Plan (Phase 0 Audit)

**Scope:** transform `frontend/src/app/campus/page.tsx` from a static photo gallery
into an interactive "Campus Experience / Campus Intelligence" hub that surfaces the
**existing** AI, RAG, campus DB, 360° tour and A\* navigation through one interface.

**Audit basis:** the running project (frontend `:3001`, backend `:8000`), the live
API, the DB, and `data/`. Nothing was modified for this audit.

---

## 1. Current Campus page architecture

| File | What it does |
|---|---|
| `frontend/src/app/campus/page.tsx` | `PageContainer` + `SectionTitle` + `<CampusGallery/>`. ~20 lines. |
| `frontend/src/app/campus/[buildingId]/page.tsx` | Per-building drill-down: `useBuilding/useFloors/useRooms/useNodes/usePanoramas` → `<BuildingDetail/>` + `<BuildingPanoramas/>`. |
| `frontend/src/features/campus/CampusGallery.tsx` | **Hardcoded array of 16 images** from `frontend/public/images/1..16`. Real GAT photography, no data binding. |
| `frontend/src/features/campus/BuildingDetail.tsx` | Renders floors→rooms from props. |
| `frontend/src/features/campus/BuildingPanoramas.tsx` | Lists panorama titles for a building. |

The gallery is **not connected to any API**. The `[buildingId]` sub-route already
reuses the campus DB well and should be **kept as-is** (it is the natural target of
"Explore this building").

---

## 2. Existing reusable frontend components / infra

**Design system** (`frontend/src/components/ui/`, `globals.css`, `tailwind.config.ts`):
- `Button` (`href|onClick`, `variant` primary/secondary/outline/ghost, `size`, `icon`, ripple)
- `Card` (`hoverLift`), `FeatureCard` (icon + accent + `href`, spotlight hover), `Dialog` (`open/onClose/title`), `SectionTitle` (`eyebrow/title/subtitle`), `PageContainer`, `Skeleton`, `Spinner`, `ErrorState` (`onRetry`)
- Tokens: `brand #2344D4`, `accent-{purple,orange,green,pink,gold}`, themed `ink/muted/hairline/canvas`, `font-display`, `shadow-soft/glow/hero`, `bg-brand-gradient`
- Utilities: `.glass`, `.container-page`, `.section-padding`, `.text-gradient-brand`, `.gradient-underline[--center]`
- `framer-motion` (`whileInView` + `viewport={{once:true,margin:"-80px"}}` is the repo-wide reveal idiom), `animate-fade-in-up`, `animate-float`
- **`CountUp`** — animated number component, currently private inside `features/landing/CampusStatistics.tsx`. Extract for "Campus at a Glance".

**Landing patterns to mirror** (`features/landing/`): `Hero`, `Features` (FeatureCard grid), `CampusStatistics` (glass stat cards on `bg-brand-gradient`), `CampusShowcase`, `CallToAction` (`bg-brand-gradient` + two `Button`s). Home composes them as a flat list of `<section>`s in `app/page.tsx` — same approach for Campus.

**Data hooks** (`frontend/src/hooks/`, all TanStack Query, `staleTime` 5 min):
`useBuildings/useBuilding`, `useFloors`, `useRooms`, `useNodes`, `useEdges`,
`usePanoramas`, `useDocuments`, `useCrossFloorHotspots`, `useTourPanoramas`.

**AI hooks:** `useChatSend` (raw mutation → `chatApi.send`), `useChatConversation`
(adds shared persisted `chatStore` history — used by `/chat` page and `FloatingAssistant`).

**API client** (`frontend/src/api/`): `apiClient` (axios, baseURL `NEXT_PUBLIC_API_BASE_URL`, 10 s default / 25 s for chat), `getApiErrorMessage`. Clients: `buildings`, `floors`, `rooms`, `nodes`, `panoramas`, `edges`, `crossFloorHotspots`, `documents`, `tour` (`listFloors/listScenes/getScene`), `chat`. **No `navigate` client** (was deleted).

**Navbar** (`components/layout/Navbar.tsx`): `Campus → /campus` link already present — **no navbar change needed**.

---

## 3. Existing reusable backend APIs

Base `http://127.0.0.1:8000/api/v1`. All GET list routes are generic CRUD
(`crud_router.py`) and **default to `limit=100`** — pass `?limit=` for full sets.

| Endpoint | Use for Campus |
|---|---|
| `GET /campuses`, `/buildings`, `/floors`, `/rooms`, `/nodes`, `/edges`, `/panoramas` | stats, facility catalog, building drill-down |
| `GET /documents` | 5 hand-authored blurbs only (see §4) |
| `GET /tour/floors?building_id=` | floor list for a building |
| `GET /tour/scenes?building_id=&floor_id=` | full scene list w/ `node_id`, `image_path`, `initial_yaw/pitch`, hotspots — the 360° source of truth |
| `GET /tour/scenes/{node_id}` | one scene by node id |
| `GET /cross-floor-hotspots` | 2125 authored sightline hotspots (nav graph enrichment) |
| `GET /navigate?start_node_id=&destination_node_id=&accessible_only=` | **A\* route** → `RouteResponse{path_node_ids, path_node_names, total_distance, estimated_walk_time_minutes, is_accessible, turn_by_turn:[{instruction,node_id,node_name,distance,edge_type}]}`. Works, **zero callers today**. |
| `POST /chat` `{message, session_id, language}` | the **only** AI entry point → `ChatResponse{answer, status, confidence, confidence_level, selected_agent, tool_used, sources:[{title,source_url,page}], navigation, panorama, session_id}` |

**Chat pipeline (unchanged, reuse verbatim):** message → `supervisor.route()` →
smalltalk / multi-domain / intent classify → specialist agent → hybrid retrieval
(ChromaDB + BM25) → rerank → confidence/grounding → Llama 3.2 naturalization →
response. `navigation`/`panorama` response fields exist but Phase 9 removed the
tools that populate them — **in practice both are `null`** (verified live). Do not
depend on them; use `sources` (real URLs, always present) and derive location
actions client-side from the facility catalog.

---

## 4. Existing relevant data structures

### 4a. Relational DB (live counts)

| Table | Rows | Notes for Campus |
|---|---|---|
| `campuses` | 1 | GAT, `campus_id = 1` |
| `buildings` | 5 | `MAIN`(id 6), `ADMIN`(1), `CSE`(2), `LIB`(3), `AUD`(4). Only MAIN has real tour scenes. lat/long NULL. |
| `floors` | 10 | MAIN: Entrance/Ground/First/Second/Third (ids 6–10) |
| `rooms` | 11 | e.g. *Main Auditorium Hall* `AUD001` node 24, *CSE Seminar Hall* `C101` node 16, *Server Room* `C102`, *Reading Hall* `L001`. Each has `department`, `room_type`, `node_id`. |
| `nodes` | 180 | `node_type`: corridor 75, junction 6, entrance 5, office 4, classroom 2, library 2, room 2, staircase 2, lab 1, outdoor 1 (+ MAIN tour corridor nodes). `pos_x/pos_y` for A\* heuristic. |
| `edges` | 325 | A\* graph |
| `panoramas` | 161 | 156 real MAIN scenes + 5 legacy placeholders (`is_placeholder`) |
| `cross_floor_hotspots` | 2125 | authored, final (locked read-only) |
| `documents` | 5 | *About GAT / Admission Process / Departments / Campus Facilities / Getting Around* — short hand-authored strings, `domain` enum. **Not** syllabi/calendars. |
| `curated_answers` | 7, `fee_information` | 16 | AI fallback tiers (server-side only) |

### 4b. Knowledge base (`data/`, server-side — feeds RAG, not a REST resource)

- `data/processed/chunks.jsonl` — **1507 chunks**, metadata `{source_url, source_title, source_type, page, document_name, department, knowledge_category}`. `source_type`: `official_website` 168 / `official_pdf` 1339. `department` tagged with real GAT dept names.
- `data/metadata/source_manifest.json` — **187 sources** keyed by URL: 45 `official_website` + 142 `official_pdf`, each `{source_url, title, source_type, chunk_count, status}`.
- `data/campus_spatial/*.json` (consumed by the AI `spatial_knowledge` tool, **no API**): `department_locations` (14), `facility_locations` (19), `laboratory_locations` (7), `room_locations` (70), `landmarks` (2) — each with `name`, `floor_slug`, `panorama_file`, `evidence`, `confidence`, `verified`.
- `data/raw/website/` (84 HTML) + `data/raw/pdfs/` (~142 PDF) — the crawl corpus.

### 4c. Official GAT resource URLs found in the crawl (real, authoritative)

| Category | URL(s) — base `https://www.gat.ac.in/` |
|---|---|
| Department pages (HTTP 200) | `computer-science-engineering.html`, `information-science-engineering.html`, `computer-science-engineering-ai-ml.html`, `artificial-intelligence-machine-learning.html`, `artificial-intelligence-data-science.html`, `electronics-communication-engineering.html`, `electrical-electronics-engineering.html`, `mechanical-engineering.html`, `civil-engineering.html`, `aeronautical-engineering.html`, `master-of-computer-science-and-engineering.html`, `master-of-structural-engineering.html`, `master-of-business-administration.html`, `phd-program.html` |
| Programs | `undergraduate-programs.html`, `postgraduate-programs.html` |
| Scheme / syllabus PDFs | CSE `documents/cs/{22,23,24,25}Syllabus.pdf`; ISE `documents/2024-25_Batch_Scheme.pdf`; ECE `documents/ece2023.pdf`; EEE `documents/2023_BATCH_I_to_VIII_Sem_SCHEME_1.pdf`; ME `documents/Approved_1st_to_8th_Semester_Scheme_2023.pdf`; AI-ML `documents/ai_ml/AIML_2022/2023/2024...pdf`; AI-DS `documents/AI&DS Scheme and syllabus 2023/2024.pdf`; CSE-AIML `documents/cs_ai_ml/2022/2023/2024...pdf`. *(Some return 403 to direct hotlinks — always also link the department page, which is 200 and hosts these links.)* |
| Brochures / program outcomes | `documents/CSE_Brochure.pdf`, `documents/Program_outcomes_cs.pdf`, … per dept |
| Academic calendar | `academic-calendar.html` (200); `documents/Academic Calendar - 2026-27 (3,5,7).pdf`; `documents/Calender Of Eevents 2nd Semester.pdf`; `documents/Tentative Calendar of Events of 8th Sem - Even.pdf` |
| Circulars | `academic-circulars.html` (200); many `documents/Circular_Absentee_*.pdf`, exam-fee circulars |
| Newsletter / magazine | `documents/Magazine and Newsletter Cell_new.pdf` |
| Research / rankings | `nirf.html`, `naac.html`, `nba-accrediation.html`, `iqac.html`, `gat.ac.in/downloads/NIRF-{2022..2025}-Engineering.pdf` (well-embedded, 38–45 chunks each) |
| Campus life / placements / library | `campus-life.html`, `placements.html`, `library.html` |

**NOT present anywhere:** structured subject/course lists (codes, credits, teaching
hours, per-semester tables); a news/events feed; structured calendar dates.

---

## 5. Virtual Tour integration points

- Route: `/tour`. Component: `frontend/src/app/tour/page.tsx` (client). Manages
  `currentId` (a node id string) in local state; **opens at `allPanoramas[0]`**.
- **No deep-link support today** (no `useSearchParams`). Data via `useTourPanoramas()`
  → `buildingsApi.list()` finds `code === "MAIN"` → `tourApi.listScenes(mainId)`.
- Scene identity = `panorama.id` = the **campus graph `node_id`** (string). Hotspots
  navigate by `targetId` (node id). `TourSidebar` / `FloorSelector` jump by floor name.
- **Integration change required (small, contained):** add optional
  `?scene=<nodeId>` (and/or `?floor=<name>`) query-param handling to `tour/page.tsx`
  that seeds `currentId` — nothing else in the tour engine changes. A room/facility
  with a `node_id` that exists in the MAIN scene set gets an "Enter 360° View" link
  to `/tour?scene=<node_id>`; one without → hide the action.
- Rooms/facilities map to scenes via `rooms.node_id` → check membership in
  `GET /tour/scenes?building_id=6`. `campus_spatial` `panorama_file` values
  (`"first-floor/01.jpg"`) correspond to MAIN scene `image_path`s and can be matched
  to a `node_id` server-side only — prefer the DB `rooms.node_id` path on the client.

---

## 6. Navigation (A\*) integration points

- Engine: `backend/app/navigation/` (`build_graph`, `find_shortest_path` A\*,
  `format_directions`) — intact, tested. Exposed at `GET /api/v1/navigate`.
- **No frontend client, no caller, no "start location" concept in the UI.**
- For Campus "Get Directions": add a thin `navigateApi.route(start, dest)` client and
  use a **fixed, real origin node** (the MAIN building entrance node — resolve from
  `GET /tour/scenes?building_id=6&floor_id=6`, sequence 1) → destination = the
  facility's `node_id`. Render `turn_by_turn` in a `Dialog`, plus an "Open in 360°"
  button to `/tour?scene=<dest>`. If the destination has no graph node or no path →
  hide "Get Directions", keep "Enter 360°"/"Ask AI".
- Do **not** rebuild pathfinding or add a GPS/location system.

---

## 7. AI integration points

- **One** entry: `POST /api/v1/chat` via `chatApi.send()` / `useChatSend()`.
- Campus "AI Campus Explorer" = a **self-contained panel** using `useChatSend`
  directly with local `useState` (question, loading, answer, sources). This keeps
  the Campus Explorer conversation separate from the persisted `/chat` history while
  using the identical endpoint, pipeline, grounding and refusal behaviour.
  (`useChatConversation` is an option if shared history is wanted — not recommended
  here.)
- Response handling: show `answer`; render `sources[]` as "Official source" chips
  (`source_url`); respect `status`/`confidence_level` (`low_confidence_refusal` /
  `clarification_needed` render as-is — no override).
- Contextual actions are **derived client-side**: after an answer, scan the question
  + answer for known department names / facility names from the Campus catalog; if a
  match has a department page URL → "View Department", a `node_id` in MAIN scenes →
  "Open 360°" + "Get Directions", a syllabus URL → "View Syllabus". Never fabricate a
  link; if nothing matches, show only generic CTAs ("Explore Facilities", "Open
  Virtual Tour").
- Suggested questions: reuse the prompt's list but drop/soften the ones the data
  can't answer well (structured subject lists → "Tell me about the ISE department").

---

## 8. Feature → existing-functionality mapping

| # | Campus feature | Backed by | New work |
|---|---|---|---|
| 1 | Dynamic Campus Hero | design system, `frontend/public/images/*` | new section component (visual only) |
| 2 | Campus at a Glance | `buildings/floors/rooms/nodes/edges/panoramas` counts | extract `CountUp`; **1 tiny endpoint** `GET /campuses/{id}/stats` (avoids fetching 180+325+161 rows to count) |
| 3 | Academic Journey | dept names (chunks), dept page URLs + syllabus/scheme/brochure PDFs (§4c), `POST /chat` for "Ask AI" | **static `academicPrograms.ts` catalog** of real dept → {page URL, scheme PDFs, brochure}. **No Year/Semester/Subject cards** — that data doesn't exist; degrade to dept card + "View Official Syllabus" + "Ask AI". |
| 4 | Academic Resources | §4c URLs (calendar, circulars, newsletter, NIRF/NAAC), `POST /chat` | **static `academicResources.ts`** of real official links + a card grid |
| 5 | Interactive Facilities | `rooms` (11) + `nodes` + `buildings` + `campus_spatial` names + `frontend/public/images/*` for imagery | facility catalog built from `rooms` (+ a curated `campusFacilities.ts` for the well-known ones: Library, Auditorium, Labs, Departments — all real, from DB/spatial data); category filter; modal |
| 6 | Campus → Virtual Tour | `/tour` + `rooms.node_id` ∈ MAIN scenes | **add `?scene=` param to `tour/page.tsx`**; "Enter 360°" links; hide when no scene |
| 7 | Academic Calendar | `academic-calendar.html` + calendar PDFs (§4c) | link to official doc; a **generic, date-free** semester-phase illustration (Begins → Activities → CIA → Events → SEE → Ends) labelled "typical flow — see official calendar for dates" |
| 8 | What's Happening at GAT | **no events feed exists** | graceful empty state **or** repurpose to surface real Calendar-of-Events + circular PDFs + newsletter as "Campus Updates" (recommended — honest, real official content) |
| 9 | AI Campus Explorer | `POST /chat` (§7) | self-contained panel + client-side contextual actions |
| 10 | Unified Campus Intelligence | all of the above | in-page anchor nav, consistent section rhythm, contextual "next action" links between sections |

---

## 9. What genuinely needs to be created

**Backend (minimal):**
1. `GET /api/v1/campuses/{campus_id}/stats` → `{buildings, floors, rooms, nodes, edges, panoramas, tour_scenes}`. One small read-only router; no new model/table. *(Alternative: skip it and call existing lists with `?limit=5000` client-side — acceptable but wasteful; the endpoint is cleaner.)*

**Frontend:**
2. `frontend/src/api/navigate.ts` — thin client for the existing `GET /navigate` (returns `RouteResponse`). `frontend/src/hooks/useCampusStats.ts`, `useCampusRoute.ts`.
3. `frontend/src/features/campus/data/` — hand-curated **from real sources**:
   - `academicPrograms.ts` — dept → { name, code, officialPageUrl, schemeYears:[{year, syllabusUrl?}], brochureUrl? }
   - `academicResources.ts` — official resource links grouped by category
   - `campusFacilities.ts` — curated facilities → { name, category, buildingCode, floor?, roomNumber?, nodeId?, image, description } (every field traceable to DB/`campus_spatial`/photos)
4. Section components under `frontend/src/features/campus/`:
   `CampusHero`, `CampusAtAGlance`, `AcademicJourney`, `AcademicResources`,
   `CampusFacilities` (+ `FacilityCard`, `FacilityModal`), `AcademicCalendar`,
   `CampusUpdates`, `AiCampusExplorer`, `EnterVirtualCampusCTA`, plus a
   `CampusSectionNav` (sticky in-page anchors).
5. Rewrite `frontend/src/app/campus/page.tsx` to compose the sections (keep
   `PageContainer`? — Hero should be full-bleed like the landing `Hero`, so the page
   composes `<section>`s directly, matching `app/page.tsx`).
6. **Tour deep-link:** ~15 lines in `frontend/src/app/tour/page.tsx` reading
   `?scene` / `?floor` on mount to seed `currentId`. No engine change.
7. `CampusGallery.tsx` imagery → keep, reuse inside `CampusFacilities` / Hero.

**No new dependencies.** No new AI/RAG/tour/nav systems. `[buildingId]` sub-route
untouched. Home/Tour/Map/Chat/About untouched except the tour deep-link.

---

## 10. Recommended implementation order

Matches the master prompt; each phase is independently shippable.

| Phase | Deliverable | Depends on |
|---|---|---|
| **1** | Visual redesign — `campus/page.tsx` composes 8 section shells (Hero + 7 placeholders), scroll reveals, `CampusSectionNav`, responsive. No section logic yet. | design system |
| **2** | Campus at a Glance — `GET /campuses/1/stats` + `useCampusStats` + `CountUp` extracted → `CampusAtAGlance`. | Phase 1 |
| **3** | Academic Journey — `academicPrograms.ts` + `AcademicJourney` (dept picker → scheme picker → official syllabus / brochure / "Ask AI"). Honest degradation for missing subject data. | Phase 1 |
| **4** | Academic Resources — `academicResources.ts` + `AcademicResources` card grid. | Phase 1 |
| **5** | Facilities — `campusFacilities.ts` + `CampusFacilities` grid + filter + `FacilityModal` ("View 360°" / "Ask AI" / "Get Directions" — actions wired in 6/9). | Phases 1, (rooms/nodes hooks) |
| **6** | Tour integration — `?scene=` param in `tour/page.tsx`; `navigate.ts` client + `useCampusRoute`; wire "Enter 360°" + "Get Directions" into `FacilityModal`; hide when unmapped. | Phase 5 |
| **7** | Academic Calendar — `AcademicCalendar` (date-free phase timeline + official links). | Phases 1, 4 |
| **8** | Campus Updates — `CampusUpdates` from real Calendar-of-Events/circulars/newsletter (or empty state). | Phases 1, 4 |
| **9** | AI Campus Explorer — `AiCampusExplorer` (self-contained `useChatSend` panel) + client-side contextual actions using the Campus catalogs. | Phases 3, 5, 6 |
| **10** | Unified integration — cross-section "next action" links, anchor nav polish, loading/empty/error states, a11y pass, `EnterVirtualCampusCTA`. Build + smoke test. | all |

---

## Key constraints carried into implementation

- **Never fabricate** subjects / course codes / credits / dates / events / panorama or
  node IDs / document URLs / stats. Missing data → graceful UI + link to official source.
- The AI is **only** `POST /api/v1/chat`. Grounding/refusal behaviour is preserved.
- The 360° tour is **only** `/tour` + its existing engine (+ a `?scene=` param).
- Pathfinding is **only** `GET /api/v1/navigate` + the existing A\* engine.
- `cross_floor_hotspots` data is final/locked — read-only, do not touch.
- Do not modify Home / Map / Chat / About or backend services beyond the one small
  `/stats` endpoint and the tour `?scene=` param.
