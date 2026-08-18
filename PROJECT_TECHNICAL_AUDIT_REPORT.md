# GAT Virtual Campus — Project Technical Audit Report

**Purpose**: A read-only, evidence-based technical record of the GAT Virtual Campus repository as it actually exists, for use as factual grounding for a future IEEE conference paper. This report describes what was built, not what was planned. No project files were modified, deleted, or refactored to produce this report.

**Methodology**: Three independent read-only audits were performed in parallel — frontend (`frontend/`), backend/RAG/database/navigation (`backend/`, `scripts/`, `database/`, `data/`), and data/docs/deployment/git-history (repo root, `docs/`, `.github/`, git log). Every claim below is drawn from those audits, which in turn are drawn from directly reading source files, running `grep`/`find`, querying the live PostgreSQL database, querying the live ChromaDB store, and reading `git log`. No fact in this report was invented, assumed, or carried over uncritically from the project's own documentation where that documentation could not be corroborated by code.

**Labeling legend** (used throughout):
- **[VERIFIED]** — directly confirmed by reading source code, running a query, or inspecting the filesystem.
- **[INFERRED]** — a reasonable conclusion from verified evidence, not itself directly stated anywhere.
- **[NOT VERIFIED IN EXISTING PROJECT]** — claimed or expected somewhere but could not be confirmed from the repository.
- **[PLANNED / NOT IMPLEMENTED]** — described in project documentation (usually `CLAUDE.md` or the build guide) but no implementing code exists.
- **[PARTIALLY IMPLEMENTED]** — some real code/infrastructure exists but it is incomplete, unused, or diverges materially from its documented design.

Secrets: no API keys, passwords, tokens, or credential values appear anywhere in this report. Where a variable name is discussed, only its name and format are given, never its value — marked `[REDACTED]` where relevant.

---

## Table of Contents

1. Complete Repository Inspection
2. Full Technology Stack by Category
3. System Architecture (Reconstructed ASCII Diagrams)
4. Frontend Implementation — Per-Page Breakdown
5. Campus Page
6. Map System
7. Virtual Tour System — Scene Graph & Cross-Floor Transition Mechanism
8. Virtual Tour — Actual User Workflow
9. Minimap / Navigation Overlay
10. Voice Assistant — Full Pipeline
11. AI Assistant — Full Pipeline (Frontend + Backend)
12. RAG Implementation — Extreme Detail
13. ML / Reranking Algorithms
14. Multi-Agent System
15. Database — Schema and ER-Style Diagram
16. API Documentation Table
17. Navigation Engine — A* Pathfinding, f(n) = g(n) + h(n)
18. Dataset / Campus Data — Exact Counts
19. Performance / Results — Measured Values Only
20. Recommended Experiments Still Required
21. Security / Privacy
22. Deployment
23. Limitations
24. Future Work
25. Research Contributions (Not Exaggerated)
26. Condensed Research-Paper-Ready Technical Summary
27. IEEE Structure (I–IX) Information Extraction
28. Source Evidence Index (File Paths per Claim)
29. Consistency / Quality Re-Scan Notes
30. Final Quality Check & Critical Information Still Required Before IEEE Paper Writing

---

## 1. Complete Repository Inspection

**[VERIFIED]** Top-level structure of `C:\Users\harsh\Desktop\Virtual Campus`:

```
.claude/                  Local Claude Code tooling (gitignored, not a deliverable)
.env / .env.example       Environment config (values redacted throughout this report)
.git/                     45 commits, 2026-07-24 → 2026-08-16, single author (harsha282004)
.github/workflows/ci.yml  Placeholder CI job only (echo statement, no real steps)
.gitignore
.mypy_cache/ .pytest_cache/ .ruff_cache/   Local tool-run artifacts (gitignored)
.vscode/
alembic.ini                Alembic config, root-level
assets/                    Empty placeholders (.gitkeep only)
backend/                   FastAPI application
CLAUDE.md                  AI-assistant guidance doc — STALE, see §29
data/                      KB source data, ChromaDB store, spatial knowledge, logs
database/                  Alembic env/migrations, seeds (empty), init SQL (placeholder)
docker-compose.yml         4 services: frontend, backend, db, ollama — no Redis
docs/                      Architecture + phase-specific docs (mixed currency, see §29)
GAT_Virtual_Tour_Build_Guide.md   7-phase master spec — never updated since first commit
frontend/                  Next.js 15 App Router application
pyproject.toml             pytest/ruff/black/mypy config
README.md                  STALE — describes an unimplemented skeleton (see §29)
requirements.txt           Python deps, range-pinned only (no lockfile)
screenshots/                Ad-hoc verification screenshots (gitignored, undocumented)
scripts/                   ai/, db/, media/, setup/, phase9_build_spatial_knowledge.py
tests/                     backend/, e2e/, frontend/ — all empty (.gitkeep only)
venv/                      Root Python virtualenv (gitignored)
```

**Notable structural findings**:
- A second, nested Python virtualenv exists at `backend/venv/` in addition to the root `venv/` **[VERIFIED]** — undocumented, not what setup instructions describe.
- `data/campus_graph.json`, named by `CLAUDE.md` as "the single source of truth for pathfinding, panorama hotspots, and the 3D map's points/routes," **does not exist anywhere in the repository** **[VERIFIED — absence, confirmed by full-repo search]**. The actual source of truth is a live PostgreSQL `nodes`/`edges` schema (§15, §17).
- No `LICENSE` file exists at repo root **[VERIFIED]**.
- No Kaggle CSV and no `scripts/build_kb.py` exist anywhere **[VERIFIED — absence]** — see §29 and §12 for what actually replaced this planned pipeline.

---

## 2. Full Technology Stack by Category

**[VERIFIED]** unless noted.

| Category | Technology | Version (locked) | Status |
|---|---|---|---|
| Frontend framework | Next.js (App Router) | 15.5.21 | In use throughout `frontend/src/app/` |
| Frontend language | TypeScript, `strict: true` | 5.9.3 | In use |
| UI runtime | React / React DOM | 19.2.8 | In use |
| CSS | Tailwind CSS | 3.4.19 | In use (v3, not v4) |
| Server state | TanStack Query | 5.101.4 | In use — every data hook is `useQuery`/`useMutation` |
| Client state | Zustand | 4.5.7 | 3 stores (`chatStore`, `tourStore` mostly unused, `campusStore`) |
| Animation | Framer Motion | 11.18.2 | In use extensively |
| Icons | lucide-react | 0.451.0 | Sole icon library |
| Theme | next-themes | 0.4.6 | Light/dark toggle only |
| HTTP client | axios | 1.18.1 | Sole HTTP client, no streaming |
| 360° viewer | pannellum-react | 1.3.6 | In use, dynamically imported `ssr:false` |
| Maps | `@vis.gl/react-google-maps` (Google Maps JS SDK) | 1.9.0 | In use — satellite/hybrid view only |
| Maps (spec'd, not used) | MapLibre GL JS | — | **[PLANNED / NOT IMPLEMENTED]** — never used; a Three.js 3D map was built then deleted (commit `b3219d9`) |
| i18n | i18next / react-i18next | — | **[PLANNED / NOT IMPLEMENTED]** — not installed, empty locale folders only |
| Voice | Web Speech API (`SpeechRecognition`) | browser-native | STT only — no `SpeechSynthesis`/TTS anywhere |
| Backend framework | FastAPI | `>=0.115` (range-pinned) | In use |
| Backend validation | Pydantic / pydantic-settings | `>=2.9` / `>=2.5` | In use |
| ORM | SQLAlchemy | `>=2.0`, **synchronous** engine | In use, sync not async |
| Migrations | Alembic | `>=1.13` | 12 real revisions |
| Relational DB | PostgreSQL | `postgres:16-alpine` (Docker) | Live, connected, populated (§15) |
| DB driver | psycopg2-binary | `>=2.9` | In use (sync driver, confirming sync ORM) |
| RAG orchestration | LangChain (`langchain-ollama`, `langchain-community`) | `>=0.3` / `>=0.2` | In use in `scripts/ai/`, not `backend/app/rag/` (empty stub) |
| Vector DB | ChromaDB (`PersistentClient`) | `>=0.5` | Live, 1488 records in collection `gat_kb` |
| Embedding model | `all-MiniLM-L6-v2` (sentence-transformers) | `>=3.0` | In use |
| Lexical retrieval | `rank_bm25` (BM25Okapi) | `>=0.2` | In use, hand-built index over 1488 chunks |
| Reranking (declared) | scikit-learn `SVR` | `>=1.5` | Present but **never trained** — heuristic fallback is the only path exercised |
| LLM runtime | Ollama, model `llama3.2` | `>=0.3` | In use — note: NOT `llama3` as `CLAUDE.md`/`config.py` default states |
| Intent classifier | PyTorch LSTM | `torch>=2.0` | Real, trained (168 examples, 12 classes) |
| Multi-agent orchestration | Hand-rolled Python router (`scripts/ai/supervisor.py`) | — | Real, deterministic-rule-primary + LSTM fallback |
| Web scraping (KB source) | BeautifulSoup4, pypdf | `>=4.12` / `>=5.0` | In use — replaces the planned Kaggle CSV pipeline |
| Containerization | Docker Compose | — | 4 services: frontend, backend, db, ollama — **no Redis**, confirmed |
| Session/rate limiting | — | — | Session store real (Postgres); rate limiting **[NOT IMPLEMENTED]** |

---

## 3. System Architecture (Reconstructed ASCII Diagrams)

**[VERIFIED / INFERRED — reconstructed from actual imports and call sites, not a generic template]**

### 3.1 Runtime request flow — chat

```
Browser (Next.js /chat page)
   │  axios POST /api/v1/chat  { message, session_id? }
   ▼
FastAPI  backend/app/api/v1/chat.py   (sync def handler, thread-pool dispatched)
   │  1. get_or_create_session()  ──────────►  PostgreSQL (chat_sessions, chat_messages)
   │  2. conversation_context resolution (Phase 15) — may short-circuit with a
   │     clarifying question WITHOUT calling the supervisor, if ambiguous follow-up
   │  3. sys.path hack inserts scripts/ai/ on the import path
   │  4. _supervisor.route(message)
   ▼
scripts/ai/supervisor.py   (NOT backend/app/agents/, which is an empty stub)
   │  classify(): deterministic phrase/keyword rules FIRST,
   │              LSTM intent classifier only as fallback (threshold 0.6)
   │  logger.info("Routing decision: query=%r -> agent=%s (%s)")
   ▼
one of: admission_agent | academic_agent | facilities_agent |
        navigation_agent | general_agent   (scripts/ai/*_agent.py)
   │  all funnel into agent_base.run_specialist()
   ▼
scripts/ai/hybrid_retrieval.py
   │  dense (ChromaDB cosine) + BM25 lexical, weighted fusion 0.6/0.4, top-20→top-5
   ▼
scripts/ai/reranker.py
   │  heuristic_rerank_score() (SVR trained model does not exist — fallback only)
   ▼
scripts/ai/confidence.py
   │  confidence = 0.4·intent_component + 0.6·retrieval_component
   │  category: HIGH ≥0.58 / MEDIUM ≥0.48 / else LOW
   ▼
scripts/ai/llm_generator.py
   │  LOW → fixed refusal string, Ollama never called
   │  else → ChatOllama(model="llama3.2"), grounding-only system prompt
   ▼
scripts/ai/grounding.py
   │  post-hoc unsupported-claims check (phone/currency/room/year patterns)
   │  → discards answer + substitutes refusal if a claim can't be traced to context
   ▼
ChatResponse { answer, status, confidence, confidence_level, selected_agent,
               tool_used, sources[], navigation?, panorama?, session_id }
   │  record_message() ─────────────────────►  PostgreSQL (chat_messages)
   ▼
Browser renders answer + source citations
```

### 3.2 Knowledge base build pipeline (offline, `scripts/ai/`)

```
www.gat.ac.in (21-42 pages)        Official GAT/VTU PDFs (89-128 documents)
   │  collect_website.py                │  collect_pdfs.py
   ▼                                    ▼
data/raw/website/*.html+.meta.json   data/raw/pdfs/*.pdf+.meta.json+.pages.json
   │                                    │
   └──────────────┬─────────────────────┘
                   ▼
        scripts/ai/clean_and_chunk.py
        BeautifulSoup boilerplate strip / repeated-header strip
        RecursiveCharacterTextSplitter(chunk_size=800, overlap=120)
        SHA-256 dedup, per-chunk metadata (source, section, page, department)
                   ▼
        data/processed/chunks.jsonl   (1488 chunks)
                   ▼
        scripts/ai/build_embeddings.py
        all-MiniLM-L6-v2 → ChromaDB PersistentClient, collection "gat_kb"
                   ▼
        data/chroma_db/   (live, 1488 records, cosine space)
```

### 3.3 Frontend module boundaries (as actually structured)

```
frontend/src/
 ├─ app/            Next.js routes only — Home, Campus(+detail), Tour, Map, Chat
 ├─ features/        campus/  chat/  landing/  mapSatellite/  tour/(+engine/)
 ├─ components/      layout/  ui/  (generic presentational)
 ├─ api/             axios wrappers — the only place fetch/HTTP happens
 ├─ hooks/           TanStack Query hooks + browser-behavior hooks (speech, keyboard)
 ├─ store/           Zustand: chatStore (used), tourStore (largely unused),
 │                   campusStore (used by map)
 └─ types/           per-domain TS interfaces
```

### 3.4 Virtual Tour scene-graph structure (per floor, doubly linked list)

```
Floor "Ground Floor" (PanoramaLinkedList)
head → [gf_01] ⇄ [gf_02] ⇄ ... ⇄ [gf_34] ← tail
         each PanoramaNode also carries:
         - crossReferences (left/right/lift/floor_up/floor_down/room_entry/...)
         - crossFloorHotspots[] (hand-authored sightline layer)

Cross-floor stitching (3rd construction pass, PanoramaEngine.ts):
  TOUR_FLOOR_SEQUENCE = [Entrance, Ground Floor, First Floor,
                          Second Floor, Third Floor, Central Quadrangle]

  lower.tail.next  = { node: upper.head, entryYaw: upper.head.yaw, ... }
  upper.head.previous = { node: lower.tail, entryYaw: lower.tail.yaw+180, ... }

  → last scene of one floor's .next transparently points at first scene
    of the next floor; Next/Previous and Guided Tour auto-advance both
    just follow .next/.previous with no floor-boundary awareness needed.
```

---

## 4. Frontend Implementation — Per-Page Breakdown

**[VERIFIED]**, source: `frontend/src/app/*`.

| Route | File | Size | Data source | Notes |
|---|---|---|---|---|
| `/` (Home) | `app/page.tsx` | — | none (hardcoded sections) | Composes 8 landing sections: Hero, Features, CampusStatistics, WhyChooseGAT, LeadershipSection, CampusShowcase, Testimonials, CallToAction |
| `/campus` | `app/campus/page.tsx` | — | hardcoded `CAMPUS_IMAGES` array | Photo gallery, not DB-driven (§5) |
| `/campus/[buildingId]` | `app/campus/[buildingId]/page.tsx` | — | 5 parallel TanStack Query hooks | Per-building detail: floors, rooms, nodes, panoramas, all filtered client-side |
| `/tour` | `app/tour/page.tsx` | 494 lines | `useTourPanoramas()` → backend `/tour/scenes` | Largest page component; full engine detail in §7 |
| `/map` | `app/map/page.tsx` | 17 lines | Google Maps SDK + `useBuildings()` | Satellite/hybrid only; 3D map deleted (§6) |
| `/chat` | `app/chat/page.tsx` | 12 lines | `POST /api/v1/chat` | No sidebar, no suggested questions (removed in `fca125d`) |

No `admissions/`, `academics/`, `facilities/`, or `contact/` routes exist **[VERIFIED]**. "About" is an in-page anchor (`/#why-choose-gat`), not a route.

State management: server data via TanStack Query exclusively (no raw `fetch` in components); cross-component state via 3 Zustand stores; local UI state via `useState`. All HTTP calls funnel through `frontend/src/api/*.ts` **[VERIFIED]**.

---

## 5. Campus Page

**[VERIFIED]**, source: `frontend/src/features/campus/CampusGallery.tsx`, commit `2259633`.

- A hardcoded `CAMPUS_IMAGES` array of 16 entries (`{src, width, height}`), each pointing at `/images/1.png` through `/images/16.jpeg` — real campus photographs with hand-recorded intrinsic dimensions (up to 4096×2731), not database-driven.
- Responsive CSS grid (`grid-cols-1 sm:grid-cols-2`), Framer Motion scroll-reveal per tile.
- This replaced an earlier building-card listing (commit `2259633`: "replace building-card listing with a photo gallery").
- The separate route `/campus/[buildingId]` is the actual data-driven per-building detail view — the gallery and the detail view are two deliberately distinct experiences (§4).

---

## 6. Map System

**[VERIFIED]** There is exactly **one** live map implementation: a Google Maps satellite/hybrid view (`@vis.gl/react-google-maps`).

**What the spec (`CLAUDE.md` Phase 5) describes and what was actually built diverge substantially**:

| Spec'd | Actually built | Status |
|---|---|---|
| MapLibre GL JS + custom campus GeoJSON, extruded placeholder buildings | Google Maps JS SDK, `mapTypeId="hybrid"` | Spec never followed — MapLibre was never used |
| — | A full **Three.js 3D map** (`features/map3d/`: `CampusScene3D.tsx`, `BuildingMesh.tsx`, `NodeNetwork3D.tsx`, etc.) was built (commit `1c6b3f1`, "phase 16 interactive 3D campus map") | **Built, then deliberately deleted** (commit `b3219d9`) |
| — | Google satellite map + GPS "My Location" + turn-by-turn navigation UI (`NavigationPanel.tsx`, `RoutePolyline.tsx`, `UserLocationMarker.tsx`) built (commits `6539525`, `b76005c`, "phase 17/18/19") | **Built, then deliberately deleted** (commit `b3219d9`, same commit) |

**Current state** (`app/map/page.tsx` → `GoogleSatelliteMap.tsx`):
- Full-width Google Maps `hybrid` view, default center `{12.92727, 77.52622}` (default zoom 18, min 15/max 21) — sourced from `frontend/src/config/campusLocation.ts`, whose own docstring states this coordinate is from public third-party map data (Mapcarta), **not surveyed on-site** **[VERIFIED — self-documented as approximate]**.
- A single whole-campus marker; per-building markers only render if `latitude`/`longitude` are non-null — the frontend's own code comments assert **no building row currently has non-null coordinates**, so in practice only the one campus-wide marker renders **[INFERRED from frontend comments; backend-data fact not independently re-verified in this synthesis]**.
- Only remaining control: a single "Reset View" button.
- **No search bar, no GPS "My Location," no route/turn-by-turn navigation UI exist in the current code** — all deleted by `b3219d9`. The backend's `/api/v1/navigate` endpoint (§16, §17) is real and functional but has no frontend consumer today.

The Virtual Tour's Minimap (§9) is a separate, smaller schematic SVG widget — not the same component, not interchangeable with this satellite map.

---

## 7. Virtual Tour System — Scene Graph & Cross-Floor Transition Mechanism

**[VERIFIED]**, source: `frontend/src/features/tour/engine/{PanoramaEngine,PanoramaLinkedList,PanoramaNode}.ts`.

### 7.1 Data structure — a doubly linked list per floor, not a flat array

- **`PanoramaNode`**: one instance per scene. Holds `sceneId`, `imagePath`, `previewImagePath`, `yaw`/`pitch`/`hfov`, `sequenceIndex`, plus `previous`/`next` (`PanoramaLink = {node, entryYaw, entryPitch}`), `crossReferences` (graph-derived non-chain links: opposite corridor, floor up/down, lift, room entry, return-to-corridor, auditorium), and `crossFloorHotspots[]` (a separate hand-authored sightline layer).
- **`PanoramaLinkedList`**: one per floor. `head`/`tail` + `Map<sceneId, node>` for O(1) lookup. `toArray()` explicitly **stops at `this.tail`**, which matters because tails' `.next` is later made to point into the next floor.
- **`PanoramaEngine`**: `Map<floorName, PanoramaLinkedList>` + a flat cross-floor `Map`. Built once per tour-page render via `useMemo`, fed entirely from the backend response (`useTourPanoramas()`) — **never a hardcoded scene array**.

### 7.2 Cross-floor transition — quoted verbatim from `PanoramaEngine.ts`

```ts
const TOUR_FLOOR_SEQUENCE = [
  "Entrance", "Ground Floor", "First Floor",
  "Second Floor", "Third Floor", "Central Quadrangle",
] as const;

for (let i = 0; i < TOUR_FLOOR_SEQUENCE.length - 1; i++) {
  const lower = engine.getFloor(TOUR_FLOOR_SEQUENCE[i]);
  const upper = engine.getFloor(TOUR_FLOOR_SEQUENCE[i + 1]);
  if (!lower?.tail || !upper?.head) continue;

  const boundaryDown = lower.tail;
  const boundaryUp = upper.head;

  boundaryDown.next = { node: boundaryUp, entryYaw: boundaryUp.yaw, entryPitch: boundaryUp.pitch };
  boundaryUp.previous = { node: boundaryDown, entryYaw: boundaryDown.yaw + 180, entryPitch: boundaryDown.pitch };
}
```

This is a **third construction pass**, run after all 6 per-floor DLLs already exist independently. It wires the lower floor's tail node to the upper floor's head node exactly like an ordinary same-floor link. Entry orientation follows the same rule as every other link (forward = target's own calibrated yaw/pitch; backward = source yaw + 180°, never a separately stored/stale edge value).

Because both Manual Tour's Next/Previous (`goToOffset(1)`) and Guided Tour's auto-advance (`runNodeSequence`) only ever read `node.next`/`node.previous`, a scene reaching the end of its own floor transparently continues into the next floor's first scene, **with no code path aware that a boundary was crossed**. This replaces an earlier flat-array modulo wraparound design (explicit in-code comment).

**Documented gap**: there is no wraparound from the last floor (Central Quadrangle) back to Entrance — Next is a no-op there, by design.

### 7.3 The "Central Quadrangle" special case

Ground Floor's calibrated scene #5 is reclassified at read time from `floor: "Ground Floor"` into its own single-scene `floor: "Central Quadrangle"` bucket, because it is a standalone courtyard view. This is why `TOUR_FLOOR_SEQUENCE` has 6 entries despite only 5 physical floor directories on disk. The underlying scene data is untouched — only its floor-bucket grouping changes.

### 7.4 Panorama asset structure

`frontend/public/panoramas/main-building/`: entrance 23, ground-floor 34, first-floor 34, second-floor 31, third-floor 34 scenes (each with a paired `-preview.jpg`). This tree is gitignored ("too large to track in git") and regenerated via `scripts/media/build_panoramas.py`. Legacy/orphaned panorama sets also exist (`Admin/`, `BlockA/`, `BlockB/`, etc., 8 folders, ~20-23 files) but are not referenced anywhere in current frontend source — shadowed leftovers from an earlier phase (§18).

---

## 8. Virtual Tour — Actual User Workflow

**[VERIFIED]**, source: `frontend/src/hooks/useGuidedTour.ts`, `features/tour/engine/{guidedTour,hotspotEngine}.ts`, `app/tour/page.tsx`.

Only the two modes actually implemented are described here (no aspirational steps).

### 8.1 Manual Tour
- Every navigable hotspot is derived purely from the current node's own DLL links and `crossReferences` — **no hardcoded hotspot array anywhere**.
- Forward/back hotspots sit at the node's own calibrated `(yaw, yaw+180)`.
- Junction types (opposite corridor, floor up/down, lift, enter/exit room, return-to-corridor) come from real backend edge data.
- Lift hotspots with more than one reachable floor render a floor-select submenu.
- Next/Previous buttons walk exactly one DLL link (`goToOffset(±1)`).

### 8.2 Guided Tour
An automatic node-to-node walk driven entirely by `PanoramaNode.next` object references (never array indexing, never a backend call while running). At each node, a fixed 6-phase sequence runs in order:

```
pause (900ms) → look-left (900ms) → return-center-1 (800ms) →
look-right (900ms) → return-center-2 (800ms) → moving (400ms)
```

Look angle: fixed 40°. Speed multipliers: slow ×1.6, normal ×1, fast ×0.55.

- **Start**: rejects if the seed node has no image path; seeds a cancellation token, resets a cycle-guard visited set, sets status to `"playing"` synchronously via both a ref and React state (explicitly documented as fixing a stale-ref bug that previously broke Resume).
- **Pause**: freezes at the current phase index after the in-flight camera animation finishes (not mid-animation).
- **Resume**: resumes from the exact phase index it paused at, not from the node's start.
- **Stop**: increments the cancellation token, orphaning any in-flight timer chain.
- **Restart**: rewinds to the original start node (not the current node), resets state, re-runs from phase 0.
- After all 6 phases at a node, it reads `node.next`; if absent → `"completed"`; if the next node is unusable or already visited (corrupted-graph guard) → `"error"`; otherwise it advances via the **same `goToScene` navigation path** used by Manual Tour's hotspot clicks, so the fade transition is identical between modes.

### 8.3 Fullscreen, compass, zoom, reset
Fullscreen and Reset View use Pannellum's native APIs (`R` keyboard shortcut resets to the scene's calibrated resting view). A custom heading-degree compass badge is computed relative to the scene's own calibrated `initial_yaw`, with a press-and-hold-to-look-behind interaction layered on top (purely visual, never persisted). Zoom uses Pannellum's native controls; no custom zoom UI.

---

## 9. Minimap / Navigation Overlay

**[VERIFIED, PARTIALLY IMPLEMENTED]**, source: `frontend/src/features/tour/Minimap.tsx`.

- Rendering technology: **inline SVG** (`<svg viewBox="0 0 280 150">`) — not canvas, not an external map library.
- **Spatial mode**: if the current floor has ≥2 real positioned nodes (`Node.pos_x`/`pos_y` from the backend), it projects those real coordinates and real edges into an SVG sub-region — genuine navigation-graph data.
- **Fallback mode**: if fewer than 2 positioned nodes exist for the current floor, an evenly-spaced strip layout is used instead — explicitly documented in-code as "never invents a coordinate."
- The outer visual frame (a schematic "Entrance zone"/"Main Building zone" two-box layout with a dashed line and gate glyph) is explicitly documented as **decorative, not survey-derived**.
- Live heading needle reads directly from the Pannellum viewer's current yaw via `requestAnimationFrame`, deliberately bypassing React state to avoid 60fps re-renders.
- White-theme redesign confirmed by commit `804068f` ("redesign mini-map to white theme").
- Clicking/keyboard-activating a scene marker performs a schematic jump (opens the target's resting orientation), not a walked transition.

---

## 10. Voice Assistant — Full Pipeline

**[VERIFIED / PARTIALLY IMPLEMENTED]**. Frontend: `frontend/src/hooks/useSpeechRecognition.ts`, `features/chat/ChatInput.tsx`. Backend: confirmed **zero voice code** anywhere in `backend/app` or `scripts/ai` (grep for `voice|speech|stt|tts` returns zero matches).

**What exists**: Speech-to-text only, via the browser-native `SpeechRecognition`/`webkitSpeechRecognition` API.
- Feature-detected post-mount (avoids SSR/hydration mismatch).
- Single-utterance recognition (`continuous: false`), 15-second hard timeout guard.
- Error mapping for permission-denied, no-speech, no-mic, network, and aborted cases.
- Mic button in `ChatInput.tsx` supports two interaction modes: **press-and-hold** (start on pointer-down, stop on pointer-up) and **quick tap** (<350ms → hands-free toggle mode, added specifically for mobile ergonomics).
- On a successful transcript: text populates the input field and **auto-submits after a 350ms delay**, through the exact same send pipeline as typed text. Voice never talks to the backend directly.
- Voice language is hardcoded `"en-US"` — no UI-language linkage (consistent with i18n not being implemented, §29).

**What does not exist [PLANNED / NOT IMPLEMENTED]**:
- **No text-to-speech / "read answers aloud" feature** — no `SpeechSynthesis`/`SpeechSynthesisUtterance` call anywhere in the codebase, despite `chatStore`'s `voiceEnabled` flag being defined and persisted with no consuming behavior.
- **No voice navigation commands** ("take me to X") — the transcript is only ever passed to the chat-send pipeline, never parsed for navigation intent.
- No backend voice endpoints or server-side STT/TTS libraries — entirely consistent with the browser-only design intent, just narrower in scope than `CLAUDE.md`'s Phase 4 description.

---

## 11. AI Assistant — Full Pipeline (Frontend + Backend)

**[VERIFIED]**. See §3.1 for the full request-flow diagram; this section covers the endpoints/contracts precisely.

### 11.1 Frontend send path
`frontend/src/hooks/useChatConversation.ts` is the single funnel for both typed input and voice transcripts:
1. Trims/guards empty or in-flight sends.
2. Appends a user message to `chatStore`, sets `isAssistantTyping = true`.
3. `chatSend.mutate({message, sessionId})` → a TanStack Query `useMutation` wrapping a single `axios.post("/chat", ...)`. **No `EventSource`, no `WebSocket`, no token-by-token streaming** anywhere in the frontend — contradicts `CLAUDE.md`'s API-conventions section, which reserves WebSocket/SSE specifically for chat.
4. On success: stores the server-issued `session_id` (replayed on next request), appends the assistant response.
5. On error: appends an error-flagged message with a human-readable string extracted from FastAPI's `detail` field.

### 11.2 Contract (as implemented, both sides verified)
```ts
// Request
{ message: string; session_id?: string | null }

// Response
{
  answer: string; status: string; confidence: number; confidence_level: string;
  selected_agent: string; tool_used: string | null;
  sources: { title: string | null; source_url: string | null; page: number | null }[];
  navigation: {...} | null; panorama: {...} | null; session_id: string | null;
}
```
This is richer than `CLAUDE.md`'s documented contract (`{answer, sources: [chunk_ids], confidence}`) — confirming the backend really does have multi-agent routing and richer metadata wired through.

### 11.3 Persistence
`chatStore` uses Zustand's `persist` middleware (`localStorage`, key `"gat-chat"`) — messages and session ID survive a page reload. Message IDs use `crypto.randomUUID()` specifically to avoid collisions with IDs already persisted from a prior session.

### 11.4 Backend orchestration
`backend/app/api/v1/chat.py` (466 lines) is the single entry point. It is a **synchronous** `def` handler (not `async def`) — a deliberate, documented tradeoff (Starlette's thread-pool dispatch for sync handlers), not an oversight, but it does contradict `CLAUDE.md`'s blanket async-I/O rule. It performs session resolution, Phase-15 contextual follow-up resolution (may short-circuit with a clarifying question without ever calling the supervisor), then routes into `scripts/ai/supervisor.py` via a `sys.path` import hack. Raw user chat messages are logged **unredacted** at INFO level (`logger.info("Chat request (session=%s): %r", session_id, message)`) — a **direct deviation** from `CLAUDE.md`'s PII-logging rule.

---

## 12. RAG Implementation — Extreme Detail

**[VERIFIED]**, source: `scripts/ai/{clean_and_chunk,build_embeddings,hybrid_retrieval,reranker,confidence,llm_generator,grounding}.py`. All logic lives in `scripts/ai/`, not `backend/app/rag/`/`backend/app/llm/` (both empty stub packages) — a deliberate, documented architectural choice per `chat.py`'s own module docstring.

### 12.1 Knowledge base source — real, not the Kaggle CSV the spec describes
`CLAUDE.md`'s Phase 2 description (`scripts/build_kb.py` relabeling a Kaggle CSV) is **[PLANNED / NOT IMPLEMENTED]** — no such script or CSV exists anywhere in the repository. The actual pipeline scrapes real institutional sources: `data/raw/pdfs/` (128 PDFs currently on disk) and `data/raw/website/` (42 scraped pages from `www.gat.ac.in`). The cumulative collection ledger `data/metadata/source_manifest.json` records 186 total unique source URLs ever attempted (141 PDFs: 70 chunked/71 failed; 45 website pages: 40 chunked/5 failed) — failures are typed (e.g., "no extractable text (likely scanned/image-only PDF)"), not silently dropped.

### 12.2 Chunking — `scripts/ai/clean_and_chunk.py`
- Website pages: BeautifulSoup strips `nav/header/footer/script/style/noscript/form/iframe` plus class-hint boilerplate; tracks nearest preceding heading as `section` metadata.
- PDFs: `strip_repeated_lines()` drops any line appearing on more than half a document's pages (running headers/footers); chunked per-page so `page` metadata is exact.
- Splitter: `langchain_text_splitters.RecursiveCharacterTextSplitter`, **`CHUNK_SIZE = 800`**, **`CHUNK_OVERLAP = 120`**, separators `["\n\n", "\n", ". ", " "]`.
- Deduplication: SHA-256 hash of normalized (whitespace-collapsed, lowercased) chunk text; first occurrence wins.
- Per-chunk metadata: `chunk_id`, `text`, `source_url`, `source_title`, `source_type`, `section`, `page`, `document_name`, `department` (matched via a 13-entry URL-slug→department dict), `collection_date`, `knowledge_category="official_institutional"`.
- Output: `data/processed/chunks.jsonl` — **1488 chunks** (verified via line count and cross-referenced in retrieval-module comments).

### 12.3 Embedding — `scripts/ai/build_embeddings.py`
- Model: **`all-MiniLM-L6-v2`** (sentence-transformers).
- Store: ChromaDB `PersistentClient`, collection name **`gat_kb`**, `hnsw:space: "cosine"` — matches `CLAUDE.md`'s spec exactly.
- Batched upsert (`BATCH_SIZE=64`) with deterministic chunk IDs (re-runs update rather than duplicate).
- **Live-verified**: direct query against the persisted ChromaDB confirms collection `gat_kb` holds exactly **1488 records** — the pipeline has actually been run end-to-end.

### 12.4 Retrieval — `scripts/ai/hybrid_retrieval.py` (242 lines)
- **Hybrid fusion**: dense ChromaDB cosine search + BM25 lexical search (`rank_bm25.BM25Okapi`, lowercase alphanumeric tokenizer, no stemming/stopwords) over all 1488 chunks.
- **Fusion weights** (module constants): `DENSE_WEIGHT = 0.6`, `BM25_WEIGHT = 0.4`.
- Each method independently returns its top-20 candidates (`DEFAULT_CANDIDATE_N = 20`); scores min-max normalized to [0,1] before weighted sum:
  ```
  hybrid_score = 0.6 · norm(dense_score) + 0.4 · norm(bm25_score)
  ```
- **`DEFAULT_TOP_K = 5`** final chunks — matches `CLAUDE.md`'s "top-5 chunks."
- Query expansion (Phase 12 addition) runs a small hand-checked synonym list before candidate generation (e.g. "branches" ↔ "departments") **[NOT VERIFIED in full detail — file exists, not fully read in the underlying audit]**.
- Both the BM25 index and the SentenceTransformer model are loaded once per process (singleton pattern), explicitly warmed at FastAPI startup because cold-start latency was blowing past the frontend's 10-second axios timeout.

### 12.5 Prompt construction and generation — `scripts/ai/llm_generator.py` (343 lines)
- LLM: Ollama via `langchain_ollama.ChatOllama`, model **`llama3.2`** (note: diverges from `CLAUDE.md`/`config.py`'s stated default of `llama3` — an explicit in-code comment notes `llama3.2` is "confirmed pulled" on the dev machine).
- No explicit `temperature` set — library default used.
- A `threading.Semaphore` (default 1, env-overridable) serializes Ollama calls — a documented fix for measured CPU contention under concurrent load (two simultaneous requests measured at 17s/45s instead of ~8s each).
- **System prompt (verbatim)**:
  > "You are the GAT Virtual Campus Assistant, answering questions about Global Academy of Technology (GAT) using ONLY the official GAT context supplied to you below.
  >
  > Rules you must follow exactly:
  > - Answer only using the supplied CONTEXT. Do not invent GAT facts.
  > - Do not assume information that is not present in the CONTEXT.
  > - Do not use general knowledge, prior training data, or assumptions about colleges in general to fill in missing GAT-specific information.
  > - If the CONTEXT does not contain enough information to answer confidently, say so explicitly — state that the available official GAT information does not provide a reliable answer to this specific question, rather than guessing.
  > - Never invent faculty names, phone numbers, departments, fees, timings, locations, rules, courses, or facilities that are not explicitly stated in the CONTEXT.
  > - Be concise and useful. Preserve important factual details (numbers, names, dates) exactly as given in the CONTEXT.
  > - If multiple context passages provide information, combine them carefully without contradicting each other; if they conflict, note the discrepancy rather than picking one arbitrarily.
  > - Do not mention chunk IDs, retrieval scores, or internal system implementation details in your answer — write for a prospective student or visitor, not a developer."
- **Prompt assembly**: each chunk rendered as `[{i}] (Source: {title})\n{text}`, joined with blank lines; final user prompt: `"CONTEXT:\n{context_block}\n\nQUESTION: {query}\n\nAnswer using only the CONTEXT above."`
- **LOW-confidence short-circuit**: Ollama is **never called** when `category == "LOW"`; a fixed refusal string is returned directly.
- **No-context path**: identical refusal if retrieval returns zero chunks.
- **Ollama unreachable / model unavailable**: explicitly probed before generation; each returns a distinct typed status rather than crashing or fabricating.
- **Sources**: built exclusively from retrieved-chunk metadata, never parsed from the LLM's free text — a citation can never exist without tracing to a real retrieved chunk.

### 12.6 Post-generation grounding check — `scripts/ai/grounding.py` (129 lines, Phase 14)
`find_unsupported_claims()` extracts phone-number/currency/room-number/year patterns from the generated answer and checks whether their digit sequences appear anywhere in the retrieved context. Any unsupported claim discards the LLM's answer entirely and substitutes a fixed refusal:
> "The generated answer contained a specific detail (such as a number, date, or contact detail) that could not be verified against the retrieved official GAT information, so it has been withheld rather than risk showing unverified information. Please check the official GAT website (https://www.gat.ac.in/) or contact the institution directly for accurate information."

This confirms `CLAUDE.md`'s hallucination-mitigation intent is not merely aspirational — refusal strings, confidence gating, and a second independent post-hoc grounding check are all real, layered, and independently triggerable.

---

## 13. ML / Reranking Algorithms

**[VERIFIED / PARTIALLY IMPLEMENTED]**, source: `scripts/ai/reranker.py` (245 lines), `backend/app/intent_model/`.

### 13.1 Reranker — a two-stage design where only the fallback stage is ever exercised
- `SVRReranker` (`sklearn.svm.SVR`, kernel="rbf") is fully implemented (`fit`/`predict`/`save`/`load`) **but never trained** — no `data/models/reranker_svr.joblib` file exists on disk, so `Reranker.__init__`'s load call always fails and falls through.
- **Actual scoring path used today**: `heuristic_rerank_score()`, a deterministic weighted sum over 4 of 7 computed features:
  ```
  HEURISTIC_WEIGHTS = {
      "hybrid_score": 0.55,
      "query_term_coverage": 0.25,
      "exact_phrase_match": 0.10,
      "length_score": 0.10,
  }
  ```
  (`semantic_score`, `bm25_score`, `lexical_overlap` are computed and reported but carry zero weight in this formula.)
- Every result carries a `rerank_mode` field (`"svr_trained"` or `"heuristic_fallback"`) — `"heuristic_fallback"` is the only mode ever exercised in this repository **[INFERRED from absence of a trained model file]**.
- `DEFAULT_TOP_K = 5` (reranked-to count feeding the LLM prompt).

### 13.2 Intent classifier — a real trained PyTorch LSTM, not a stub
```python
class IntentLSTM(nn.Module):
    def __init__(self, vocab_size, num_classes, embed_dim=32, hidden_dim=32, pad_idx=0):
        self.embedding = nn.Embedding(vocab_size, embed_dim, padding_idx=pad_idx)
        self.lstm = nn.LSTM(embed_dim, hidden_dim, batch_first=True)
        self.dropout = nn.Dropout(0.2)
        self.classifier = nn.Linear(hidden_dim, num_classes)
```
Forward pass: embed → `pack_padded_sequence` → LSTM → final hidden state → dropout → linear classifier → raw logits.

**Trained weights exist and load successfully** (`backend/app/intent_model/artifacts/intent_lstm.pt`, `vocab.json`, `intents.json`, `training_metadata.json`, all present on disk). Training metadata (verbatim):
```json
{
  "train_accuracy": 1.0,
  "val_accuracy": 0.529411792755127,
  "best_epoch": 147,
  "num_train_examples": 134,
  "num_val_examples": 34,
  "vocab_size": 283,
  "num_classes": 12,
  "epochs": 150,
  "note": "Trained on a small synthetic seed dataset (dataset.py) — see that module's honesty note. Held-out accuracy measured on a random 80/20 split, not cross-validated. Checkpoint saved is the best-val-accuracy epoch (early stopping), not the final epoch."
}
```
Train accuracy 1.0 vs. validation accuracy ~0.53 on only 168 total examples is a clear sign of overfitting on a tiny synthetic dataset — the model's own metadata is explicit about this, and the dataset module self-labels itself "a small, hand-authored SYNTHETIC seed dataset, not logged real user queries."

**Actual classes (12, not the 5 `CLAUDE.md` specifies)**:
```
ADMISSIONS, COURSES, DEPARTMENTS, ACADEMICS, FACILITIES, ROOM_LOCATION,
DEPARTMENT_LOCATION, LABORATORY_LOCATION, VIRTUAL_TOUR, CAMPUS_INFO, GENERAL, UNKNOWN
```
These collapse many-to-one onto the 5 agent names inside `supervisor.py`'s `_INTENT_TO_AGENT` dict.

`classify_intent(text)` is real and called, but only as a **fallback signal** — see §14 for the primary deterministic routing logic. It is never used to generate free text (the RNN≠generator architectural boundary from `CLAUDE.md` is honored).

**Confidence threshold discrepancy**: `CLAUDE.md` claims 0.55; the real constant in `supervisor.py` is `_RNN_CONFIDENCE_THRESHOLD = 0.6` **[VERIFIED discrepancy]**.

**Confidence-formula gap [NOTABLE]**: `scripts/ai/confidence.py`'s `intent_component` is documented as a placeholder that reuses `retrieval_component` as a stand-in ("no intent classifier implemented yet") — this comment is stale relative to the rest of the codebase (a real LSTM does exist), but functionally still accurate: the LSTM's output is never wired into `compute_confidence()`'s `intent_probability` parameter. This is a real, current gap in the implementation, not merely stale prose.

---

## 14. Multi-Agent System

**[VERIFIED — real, not a stub]**, source: `scripts/ai/supervisor.py` (401 lines), `agent_base.py`, `{admission,academic,facilities,navigation,general}_agent.py`.

- **Location**: `scripts/ai/`, not `backend/app/agents/` (which is an empty stub). Filenames mostly follow `CLAUDE.md`'s `<domain>_agent.py` convention (`admission_agent.py`/`academic_agent.py` are singular, not `admissions_agent.py`/`academics_agent.py` — a minor naming discrepancy).
- **Every specialist is real**: all 5 agents route into the shared `agent_base.run_specialist()`, which runs the full retrieval → rerank → confidence → generation pipeline (§12). `general_agent.py` is the thinnest (pure passthrough, appropriate for a "no clear domain" fallback). `navigation_agent.py` is the most complex — it layers two deterministic tool paths (spatial-knowledge lookup, PostgreSQL-backed location resolution) in front of the shared RAG fallback, forcing confidence to 1.0/HIGH for exact DB/JSON hits.
- **Routing mechanism (`supervisor.classify()`) is primarily deterministic, not ML-first**:
  1. A 23-phrase `NAVIGATION_PHRASES` list checked first via substring match ("where is", "how do i get to", "take me to", etc.).
  2. A bare room-number regex.
  3. Keyword-set scoring across 4 domain keyword lists; highest-scoring non-empty bucket wins.
  4. **Only if no deterministic rule matched at all**: falls back to the trained LSTM; if `rnn_confidence >= 0.6`, its predicted intent maps to one of the 5 agents via `_INTENT_TO_AGENT`; otherwise defaults to `general_agent`.
  This is an explicit, documented design choice in `supervisor.py`'s own docstring — not a shortfall relative to `CLAUDE.md`'s "RNN feeds the router" framing, but a more precise description of it (RNN is a fallback signal for uncovered phrasings, not the primary router).
- **Routing IS logged at INFO**, satisfying `CLAUDE.md`'s explicit functional requirement — verbatim:
  ```
  logger.info("Routing decision: query=%r -> agent=%s (%s)", query, agent_name, reason)
  ```
  `reason` embeds which keyword/phrase/RNN-intent+confidence triggered the choice.
- **Multi-domain query splitting** (Phase 13): queries with an explicit "and"/";" conjunction are split into clauses, each independently classified; if 2+ clauses land on different agents, each clause's answer is generated independently and concatenated (no second LLM merge call) — real, working logic.
- **Chat endpoint wiring confirmed real, not bypassed**: `chat.py` line 439, `result = _supervisor.route(effective_message)`, is the one and only path from the HTTP layer into the AI pipeline — there is no shortcut that calls RAG directly.
- All 5 agents ground every answer in the same shared ChromaDB retrieval/LLM client — no agent has a private connection, honoring `CLAUDE.md`'s architectural rule.

---

## 15. Database — Schema and ER-Style Diagram

**[VERIFIED]**, source: `backend/app/models/*.py`, live PostgreSQL query (`gat_campus_tour` database, connectable and populated), `database/migrations/versions/` (12 real Alembic revisions).

### 15.1 ER-style diagram (textual, reconstructed from actual SQLAlchemy relationships)

```
Campus (1) ──< Building (1) ──< Floor (1) ──< Room (0..1) ──(1:1)── Node
   │                │                              │                 │
   │                └──< Node (nullable FK) ────────┘                 │
   │                                                                   ├──< Panorama (1:N, cascade)
   └──< Document (nullable FK)                                        ├──< Edge (source_node_id)
                                                                       ├──< Edge (target_node_id)
                                                                       └──< CrossFloorHotspot (source/target)

ChatSession (1) ──< ChatMessageRecord (N, cascade delete-orphan)
```

### 15.2 Models table

| Model | Table | Key fields | Notes |
|---|---|---|---|
| `Campus` | `campuses` | name (unique), description, address | Root of hierarchy |
| `Building` | `buildings` | campus_id FK, name, code, latitude/longitude (nullable) | No building currently surveyed (all lat/long null, per frontend comments) |
| `Floor` | `floors` | building_id FK, level, name; unique(building_id, level) | — |
| `Room` | `rooms` | floor_id FK, node_id FK (nullable, unique), room_number, room_type, department, capacity | 1:1 with Node |
| `Node` | `nodes` | campus_id/building_id/floor_id FK, name, node_type (13-value enum), pos_x/pos_y, latitude/longitude | Central graph vertex — pathfinding, panoramas, minimap all key off this |
| `Edge` | `edges` | source/target node_id FK, distance, is_bidirectional, edge_type (6-value enum), direction (6-value enum), accessible, entry_yaw/entry_pitch | Pathfinding graph edge |
| `Panorama` | `panoramas` | node_id FK, image_path, is_placeholder, sequence_index, initial_yaw/pitch, hfov (default 110.0) | Tour scene data |
| `Document` | `documents` | campus_id FK (nullable), title, content, domain (5-value enum) | Explicitly "no embedding or retrieval logic lives here" per its own docstring — disjoint from the ChromaDB RAG store |
| `CrossFloorHotspot` | `cross_floor_hotspots` | source/target node_id FK, yaw, pitch, label | Explicitly "not part of the pathfinding graph" — visual-only overlay |
| `ChatSession` | `chat_sessions` | session_id (unique, indexed) | — |
| `ChatMessageRecord` | `chat_messages` | session_id FK, role, content, resolved_location | Cascade delete on session removal |

### 15.3 Live data volumes (direct query against the running database)

```
buildings 5   campuses 1        chat_messages 1400   chat_sessions 378
cross_floor_hotspots 849        documents 5          edges 325
floors 10     nodes 180         panoramas 161         rooms 11
```

**1400 chat messages across 378 sessions** is direct evidence the `/api/v1/chat` endpoint has been extensively exercised against a live backend+Ollama+ChromaDB stack, not merely written and never run.

### 15.4 Migrations
12 real Alembic revisions exist under `database/migrations/versions/`, including an "add visibility zones" migration later reverted by a "remove visibility zones" migration, and a "chat_sessions" migration matching the Phase-8 session-persistence work. `database/seeds/` itself is empty (`.gitkeep` only) — real seeding logic instead lives in `scripts/db/seed.py` (782 lines, not fully read in the underlying audit).

### 15.5 `data/campus_graph.json` does not exist
Confirmed absent by full-repository search. The database (`nodes`/`edges` tables, §15.2/15.3) is the actual, live source of truth for the navigation graph, contradicting `CLAUDE.md`'s stated single-file design.

---

## 16. API Documentation Table

**[VERIFIED]**, source: `backend/app/api/v1/__init__.py` (router registration) and every router file.

| Method | Path | Request | Response | Touches DB | Frontend consumer |
|---|---|---|---|---|---|
| POST | `/api/v1/chat` | `{message, session_id?}` | `ChatResponse` (§11.2) | Yes (session persistence) | Assistant page |
| GET/POST/PUT/DELETE | `/api/v1/campuses[/{id}]` | `CampusCreate/Update` | `CampusRead` | Yes | admin/data |
| GET/POST/PUT/DELETE | `/api/v1/buildings[/{id}]` | `BuildingCreate/Update` | `BuildingRead` | Yes | Map, Tour |
| GET/POST/PUT/DELETE | `/api/v1/floors[/{id}]` | `FloorCreate/Update` | `FloorRead` | Yes | Tour |
| GET/POST/PUT/DELETE | `/api/v1/rooms[/{id}]` | `RoomCreate/Update` | `RoomRead` | Yes | Building detail |
| GET/POST/PUT/DELETE | `/api/v1/nodes[/{id}]` | `NodeCreate/Update` | `NodeRead` | Yes | Tour, Minimap, Navigation graph |
| GET/POST/PUT/DELETE | `/api/v1/edges[/{id}]` | `EdgeCreate/Update` | `EdgeRead` | Yes | Minimap, Navigation graph |
| GET/POST/PUT/DELETE | `/api/v1/panoramas[/{id}]` | `PanoramaCreate/Update` | `PanoramaRead` | Yes | 360 Tour |
| PUT | `/api/v1/panoramas/{id}/orientation` | `PanoramaOrientationUpdate` | `PanoramaRead` | Yes | Dev-only orientation calibration panel |
| GET/POST/PUT/DELETE | `/api/v1/cross-floor-hotspots[/{id}]` | `CrossFloorHotspotCreate/Update` | `CrossFloorHotspotRead` | Yes | Dev-only hotspot placement panel |
| GET/POST/PUT/DELETE | `/api/v1/documents[/{id}]` | `DocumentCreate/Update` | `DocumentRead` | Yes | Unclear consumer — disjoint from RAG |
| GET | `/api/v1/tour/floors?building_id=` | query params | `list[FloorRead]` | Yes | Tour |
| GET | `/api/v1/tour/scenes?building_id=&floor_id=` | query params | `list[SceneRead]` | Yes (Node+Panorama join) | Tour (Pannellum scene list) |
| GET | `/api/v1/tour/scenes/{node_id}` | path param | `SceneRead` | Yes | Tour |
| GET | `/api/v1/tour/neighbors/{node_id}` | path param | `list[SceneHotspot]` | Yes | Tour (prefetch) |
| GET | `/api/v1/navigate?start_node_id=&destination_node_id=&accessible_only=` | query params | `RouteResponse` (§17) | Yes | Backend-complete; **no current frontend consumer** (§6) |
| GET | `/health` | — | `{"status": "ok"}` | No | Ops health check |

**Contract deviations from `CLAUDE.md`, all verified in code**:
- `/api/v1/navigate` is documented as `POST {from, to}`; the real endpoint is **GET** with integer query params `start_node_id`/`destination_node_id` — an explicit, documented deviation in `navigate.py`'s own docstring, justified as matching "this codebase's actual existing convention."
- No `POST /api/v1/session` bootstrap endpoint exists — session bootstrap happens implicitly inside `POST /api/v1/chat`.
- No WebSocket/SSE endpoint exists anywhere — chat is plain synchronous REST.

---

## 17. Navigation Engine — A* Pathfinding, f(n) = g(n) + h(n)

**[VERIFIED]**, source: `backend/app/navigation/{pathfinding,graph_builder}.py`.

- **Algorithm**: real A* (`find_shortest_path`), implemented with a binary heap (`heapq`), degrading automatically to Dijkstra behavior whenever no coordinate-based heuristic is available (heuristic returns 0.0, which the code comments correctly note keeps A* admissible). A separate plain-Dijkstra function (`single_source_distances`) handles nearest-neighbor queries with no single fixed destination.

- **Heuristic h(n) — verbatim**:
  ```python
  def _heuristic(a: Node, b: Node) -> float:
      if a.pos_x is not None and a.pos_y is not None and b.pos_x is not None and b.pos_y is not None:
          return math.hypot(a.pos_x - b.pos_x, a.pos_y - b.pos_y)
      if (a.latitude is not None and a.longitude is not None
              and b.latitude is not None and b.longitude is not None):
          mean_lat_rad = math.radians((a.latitude + b.latitude) / 2)
          dx = (a.longitude - b.longitude) * 111_320 * math.cos(mean_lat_rad)
          dy = (a.latitude - b.latitude) * 110_540
          return math.hypot(dx, dy)
      return 0.0
  ```
  Prefers planar floor-plan coordinates (`pos_x`/`pos_y`); falls back to a small-scale-planar GPS approximation (111,320 m/degree longitude scaled by cos(mean latitude), 110,540 m/degree latitude); falls back to 0 (pure Dijkstra) otherwise.

- **Cost accumulation g(n)**: `tentative_g = g_score[current] + graph_edge.distance` — `graph_edge.distance` comes directly from the `Edge.distance` DB column (a stored float set at seed/authoring time, not computed from coordinates).

- **Priority function**: `f_score = tentative_g + _heuristic(...)` — standard A* `f = g + h`.

- **Graph representation**: `CampusGraph` dataclass, `adjacency: dict[int, list[GraphEdge]]` (adjacency **list**), built fresh from the live PostgreSQL `nodes`/`edges` tables on every call to `build_graph()` — no persistent in-process cache. Bidirectional edges expand into both adjacency directions; `accessible_only=True` filters out any edge not flagged `Edge.accessible`.

- **Live graph size**: 180 nodes, 325 edges (§15.3).

- **Endpoint wiring**: `navigate.py` calls `build_graph()` → `find_shortest_path()` → `format_directions()`, returning a fully populated `RouteResponse {path_node_ids, path_node_names, total_distance, estimated_walk_time_minutes, is_accessible, turn_by_turn}`. This engine is real and functional, "fully intact and tested since Phase 5" per its own docstring.

- **Scope note**: turn-by-turn routing was deliberately removed from the **chat/agent path** in an internal "Phase 9" (chat-based "how do I get to X" now falls through to ordinary grounded RAG, on the stated grounds that "this project is a virtual campus tour + AI information assistant, not an indoor navigation/routing system"). The pathfinder itself survives only via the direct `/api/v1/navigate` REST endpoint and internal tool use (nearest-panorama lookups) — it currently has **no frontend UI consumer** (§6).

---

## 18. Dataset / Campus Data — Exact Counts

**[VERIFIED]**, cross-referenced across all three audits.

| Asset | Count | Source |
|---|---|---|
| KB text chunks (embedded, queryable) | 1488 | `data/processed/chunks.jsonl`, live ChromaDB `gat_kb` collection |
| Source PDFs currently on disk | 128 | `data/raw/pdfs/` |
| Source website pages currently on disk | 42 | `data/raw/website/` |
| Cumulative unique source URLs ever attempted | 186 (141 PDFs + 45 website pages) | `data/metadata/source_manifest.json` |
| Successfully chunked PDFs / failed | 70 / 71 | same manifest |
| Successfully chunked website pages / failed | 40 / 5 | same manifest |
| Database nodes | 180 | live PostgreSQL query |
| Database edges | 325 | live PostgreSQL query |
| Database panoramas | 161 | live PostgreSQL query |
| Database rooms | 11 | live PostgreSQL query |
| Database floors | 10 | live PostgreSQL query |
| Database buildings | 5 | live PostgreSQL query |
| Database campuses | 1 | live PostgreSQL query |
| Cross-floor hotspots | 849 | live PostgreSQL query |
| Documents (relational, non-RAG) | 5 | live PostgreSQL query |
| Chat sessions (accumulated) | 378 | live PostgreSQL query |
| Chat messages (accumulated) | 1400 | live PostgreSQL query |
| Panorama image files (`main-building/`, primary) | 178 | direct directory count (entrance 23, ground-floor 34, first-floor 34, second-floor 31, third-floor 34) |
| Panorama image files total (incl. previews + legacy) | ~330–334 (two independent counts differ slightly by counting method) | direct directory count, both audits |
| Gallery images (`frontend/public/images/`) | 27 | direct directory count |
| Video assets | 3 | direct directory count |
| Intent classifier training examples | 168 total (134 train / 34 val) | `training_metadata.json` |
| Intent classifier classes | 12 | `artifacts/intents.json` |

---

## 19. Performance / Results — Measured Values Only

**[VERIFIED — only figures actually captured in code comments/logs are reported here; nothing extrapolated]**

- Two simultaneous chat requests measured at **17s and 45s** response time (vs. an estimated ~8s each in isolation) before the Ollama concurrency semaphore was added — cited directly in `llm_generator.py`'s own comments as the reasoning for serializing Ollama calls.
- Confidence thresholds (`HIGH ≥ 0.58`, `MEDIUM ≥ 0.48`) were "derived empirically" from a **9-query manual sample** (6 in-domain + 3 out-of-domain) — the surrounding comment explicitly flags this as "thresholds fitted to one 9-query sample, not a validated statistical boundary."
- Intent classifier: **train accuracy 1.0, validation accuracy 0.529** on an 80/20 split of 168 total synthetic examples (§13.2) — the only quantitative ML metric present anywhere in the repository.
- Frontend dev-server cold start after switching to Turbopack: **~2 seconds** to "Ready" (measured this session, not part of the repository's own artifacts — included here only as a development-environment note, not a research result).

**No other quantitative performance data exists in the repository** — no latency percentiles, no throughput numbers, no retrieval precision/recall, no user-study data, no A/B comparisons, no load-test results (`scripts/load_test.py` does not exist).

---

## 20. Recommended Experiments Still Required

**[NOT YET RUN — explicitly not part of this audit]**

1. **Retrieval quality**: precision@k / recall@k / MRR for the hybrid BM25+dense retriever against a held-out labeled query set (does not currently exist).
2. **Confidence-threshold validation**: replace the 9-query empirical threshold derivation (§19) with a statistically sized held-out set and report threshold sensitivity.
3. **Reranker ablation**: train the existing but unused `SVRReranker` and measure whether it outperforms the heuristic fallback currently in production.
4. **Intent classifier generalization**: evaluate the LSTM (currently overfit at 168 examples) against real logged user queries rather than only the synthetic seed set; report a proper confusion matrix across all 12 classes.
5. **End-to-end faithfulness/relevancy evaluation**: `CLAUDE.md`'s Phase 7 `eval/` pipeline (LLM-judge faithfulness + relevancy scoring on 25 fixed questions) does not exist and has never been run (§29) — this is the single most valuable missing measurement for an IEEE paper's results section.
6. **Concurrency/load testing**: `scripts/load_test.py` does not exist; no measured figures exist for concurrent-session behavior beyond the single 2-request anecdote in §19.
7. **A* pathfinding performance**: no measured routing latency exists for the live 180-node/325-edge graph; a straightforward benchmark (path length vs. computation time) is not yet run.
8. **User study**: no user-facing usability/satisfaction data exists anywhere in the repository.

---

## 21. Security / Privacy

**[VERIFIED]**

- **CORS**: `backend/app/main.py` sets a finite, non-wildcarded `allow_origins` list from `CORS_ALLOWED_ORIGINS` (default `localhost:3000`/`3003` variants) — matches `CLAUDE.md`'s "never wildcard" rule. `allow_methods`/`allow_headers` are wildcarded (`["*"]`), which `CLAUDE.md` doesn't explicitly forbid.
- **No authentication/authorization anywhere** — no `Authorization` header checks, no JWT/session-cookie auth, no auth-related library in `requirements.txt`. `ChatSession`'s own model docstring states explicitly: "No user/auth concept is attached — this project has no login system." Every CRUD endpoint, including destructive `DELETE`, is open and unauthenticated.
- **PII/logging deviation**: raw user chat messages are logged **unredacted, verbatim** at INFO level in `chat.py` — a direct violation of `CLAUDE.md`'s own logging rule requiring truncation/hashing of PII-bearing content.
- **Error handling**: 4 global exception handlers (`AppError`, `RequestValidationError`, `SQLAlchemyError`, catch-all `Exception`) never leak stack traces or internal exception text to the client — all return hardcoded generic messages while logging full detail server-side via `logger.exception`.
- **Dev-only admin panels** (Orientation Calibration, Cross-Floor Hotspot placement) are gated only by client-side `NEXT_PUBLIC_*` boolean flags (both default `false`), which are build-time-baked, not a runtime auth check — if a production build ever shipped with these flags true, the corresponding write endpoints (`panoramasApi.updateOrientation`, `crossFloorHotspotsApi.*`) would be reachable by any visitor, since the backend also has no auth on these routes.
- **Secrets**: no hardcoded API keys, passwords, or tokens found in any source file read across all three audits. `.env`/`.env.example` variable *names* were confirmed present; no values were read or printed. The Google Maps API key is a client-exposed `NEXT_PUBLIC_*` variable by necessity (standard practice, restriction happens in Google Cloud Console, outside this repository's scope to verify).
- **Rate limiting**: absent (§14 of the backend audit, cross-referenced) — `CLAUDE.md`'s Phase 3 requirement is **[NOT IMPLEMENTED]**.

---

## 22. Deployment

**[VERIFIED]**

`docker-compose.yml` (58 lines) defines exactly 4 services:

| Service | Image/Build | Ports | Volumes |
|---|---|---|---|
| `frontend` | `./frontend`, Dockerfile, `npm run dev` | 3000:3000 | bind mount + anonymous `node_modules` |
| `backend` | repo root context, `backend/Dockerfile`, `uvicorn --reload` | 8000:8000 | bind mount, `env_file: .env` |
| `db` | `postgres:16-alpine` | 5432:5432 | named volume `postgres_data`, `database/init` mounted |
| `ollama` | `ollama/ollama:latest` | 11434:11434 | named volume `ollama_data` |

No Redis service, matching the architecture decision. No `networks:` section (implicit default bridge). `depends_on` is startup-order only, not readiness/healthcheck-based.

**No hosted-deployment configuration exists** — searched for `vercel.json`, `Procfile`, `render.yaml`, `netlify.toml`, `fly.toml`: zero matches. `.github/workflows/ci.yml` is a single placeholder job that only echoes a string; no lint/test/build steps are wired up despite `pyproject.toml` configuring ruff/black/mypy/pytest and the frontend having lint/type-check scripts available. **The only functioning deployment path is local Docker Compose.**

---

## 23. Limitations

**[VERIFIED, drawn directly from the audits — not editorializing beyond what the code/data shows]**

- No automated test suite exists (`tests/backend`, `tests/frontend`, `tests/e2e` are all empty placeholders) — correctness is currently unverified by any repeatable automated process.
- No evaluation pipeline exists (`eval/` does not exist) — RAG answer quality (faithfulness, relevancy) has never been formally measured.
- The intent classifier is trained on only 168 synthetic examples and is measurably overfit (train 1.0 / val 0.53) — and even so, it is only a fallback signal behind deterministic keyword/phrase rules, not the primary classifier the architecture document implies.
- The SVR reranker exists in code but was never trained — the system runs on a heuristic fallback exclusively.
- No rate limiting and no concurrency load testing exist, despite documented (anecdotal) evidence of latency degradation under concurrent Ollama calls.
- No authentication exists on any endpoint, including destructive CRUD operations.
- Async I/O was scoped as a requirement but the implementation is deliberately synchronous throughout the AI/chat/navigation request path.
- Building GPS coordinates are entirely absent (all null) — only a single, third-party-sourced, unsurveyed campus-level coordinate exists.
- A working 3D map and GPS turn-by-turn navigation UI were built and then deliberately removed; the backend navigation engine (`/api/v1/navigate`) is fully functional but currently has no frontend consumer.
- i18n/multi-language support is not implemented at all (no library installed, empty locale folders).
- Voice output (text-to-speech) and voice navigation commands are not implemented — voice is input-only (speech-to-text) feeding the existing chat pipeline.
- The project's own top-level documentation (`README.md`, `CLAUDE.md`'s project-status section, the build guide, `docs/architecture.md`) is stale relative to the actual, far more advanced implementation, and several phase-specific docs (`docs/phase16-19_*.md`) describe features that were subsequently deleted from the codebase on the same day they were documented.

---

## 24. Future Work

**[PLANNED / NOT IMPLEMENTED — items with real, partial scaffolding already in the codebase, drawn from explicit in-code comments, not invented]**

- Train the existing `SVRReranker` on logged query/relevance data and compare against the heuristic reranker.
- Wire the trained LSTM intent classifier's probability into `confidence.py`'s `intent_component` (currently a documented placeholder reusing the retrieval score).
- Build `eval/` per `CLAUDE.md`'s Phase 7 design (25 fixed questions, LLM-judge faithfulness/relevancy scoring) — no part of this exists today.
- Implement `scripts/load_test.py` and per-session rate limiting (`CLAUDE.md` Phase 3, not implemented).
- Reconnect the fully functional `/api/v1/navigate` A* endpoint to a frontend UI (the map's GPS/turn-by-turn UI was built once and deliberately removed — reintroducing a UI layer would not require backend changes).
- Survey and populate real building `latitude`/`longitude` values (currently entirely null) to enable per-building map markers.
- Implement text-to-speech ("read answers aloud") and voice navigation commands, both scoped in `CLAUDE.md`'s Phase 4 but never built.
- Implement i18next-based UI translation (en/kn/hi) — no library is installed and locale folders are empty placeholders.
- Remove or reconcile the three confirmed dead-code frontend components (`SuggestedQuestions.tsx`, `useDocuments.ts`/`api/documents.ts`, `FloorSelector.tsx`) that are built and exported but never rendered.
- Reconcile `CLAUDE.md`, `README.md`, and `docs/architecture.md` with the actual implementation, or replace them with `docs/RAG_ARCHITECTURE.md`-style living documentation (which is current as of the RAG work).
- The tour engine's own comments note it is "ready to support additional named routes" (Annex Route, Back Door Route, Auditorium Entrance Route) "the moment scene data for them exists" — currently no such data exists.

---

## 25. Research Contributions (Not Exaggerated)

**[VERIFIED — stated conservatively, tied directly to evidence above]**

1. A working, grounded RAG pipeline over **real, scraped institutional data** (not a synthetic or repurposed public dataset) — 1488 chunks from 128 PDFs and 42 web pages, hybrid BM25+dense retrieval with documented fusion weights, and a **layered hallucination-mitigation design**: confidence-gated LLM invocation, a grounding-only system prompt, and an independent post-hoc claim-verification pass that discards ungrounded numeric/contact claims.
2. A **deterministic-rule-primary, ML-fallback** multi-agent routing architecture — a documented, reasoned alternative to a pure-ML router, with full INFO-level routing-decision logging satisfying an explicit auditability requirement.
3. A **doubly-linked-list-per-floor scene graph** for 360° tour navigation with a demonstrated, code-verified mechanism for seamless cross-floor traversal (tail-to-head stitching across a 6-zone `TOUR_FLOOR_SEQUENCE`), replacing an earlier flat-array-modulo design — a concrete, reproducible data-structure contribution distinct from generic "we built a tour."
4. A real A* pathfinding engine operating over a live, database-backed 180-node/325-edge graph, with a heuristic that gracefully degrades from planar floor coordinates → GPS approximation → pure Dijkstra depending on data availability — a genuine algorithmic component, not a stub.
5. A trained (if data-limited) PyTorch LSTM intent classifier integrated as a documented fallback signal within a larger deterministic routing system — an honest, moderate claim given the small (168-example) training set and measured overfitting.
6. Evidence of substantial real-world usage during development (378 chat sessions, 1400 messages against a live Ollama+ChromaDB+Postgres stack) — the system was not merely written but exercised.

**Explicitly not a contribution to claim**: the reranker's SVR model (never trained), the async-I/O concurrency architecture (deliberately not implemented), formal evaluation results (no `eval/` pipeline exists), or any comparison against baseline systems (none performed).

---

## 26. Condensed Research-Paper-Ready Technical Summary

**GAT Virtual Campus** is a full-stack virtual campus tour and AI assistant system built on Next.js 15/FastAPI/PostgreSQL/ChromaDB/Ollama. Its core contribution is a grounded retrieval-augmented generation pipeline: 1488 text chunks derived from 128 real institutional PDFs and 42 scraped web pages are indexed via `all-MiniLM-L6-v2` embeddings in ChromaDB and BM25 lexical search, fused with weights 0.6/0.4, reranked with a 4-feature heuristic formula, scored for confidence via a 0.4/0.6 intent/retrieval blend, and answered by a locally-hosted Llama 3.2 model constrained by a strict grounding-only system prompt and a post-hoc numeric-claim verification pass that withholds ungrounded answers. Query routing is handled by a deterministic phrase/keyword-first supervisor with a fallback to a small trained PyTorch LSTM intent classifier (12 classes, 168 training examples). A separate subsystem implements 360° panoramic campus touring via a doubly-linked-list-per-floor scene graph (330+ panorama images across 5 real floors) with verified seamless cross-floor transitions, and a live A* pathfinding engine over a 180-node/325-edge PostgreSQL-backed campus graph. The system has been exercised in development to the extent of 378 recorded chat sessions and 1400 messages. Known gaps, honestly reported: no automated test suite, no formal evaluation pipeline, an untrained reranker model, no authentication, no rate limiting, and a deliberately synchronous backend I/O model.

---

## 27. IEEE Structure (I–IX) Information Extraction

**[VERIFIED / INFERRED — mapping existing material onto IEEE section conventions; no content invented for sections where evidence does not exist]**

- **I. Introduction** — Problem: campus wayfinding + information access for prospective/current students at GAT. Evidenced by: landing page copy, `CLAUDE.md`'s stated goals, the RAG/tour/navigation subsystems actually built.
- **II. Related Work** — **[NOT VERIFIED IN EXISTING PROJECT]** — no literature review, citations, or related-work comparison exists anywhere in the repository. Must be authored separately by the user.
- **III. System Architecture** — Directly available: §3 of this report (diagrams), §4–§17 (component detail).
- **IV. Methodology / Implementation** — Directly available: §12 (RAG), §13 (ML), §14 (multi-agent), §17 (navigation) — all with verbatim code/config evidence.
- **V. Dataset** — Directly available: §18 (exact counts, provenance).
- **VI. Experiments / Evaluation** — **[NOT VERIFIED IN EXISTING PROJECT]** — no formal evaluation exists; only the anecdotal figures in §19 are real. §20 lists what must be run before this section can be written.
- **VII. Results** — **[NOT VERIFIED IN EXISTING PROJECT]** — blocked on §VI; only §19's measured values exist today.
- **VIII. Discussion / Limitations** — Directly available: §23.
- **IX. Conclusion / Future Work** — Directly available: §24, §25.

---

## 28. Source Evidence Index (File Paths per Claim)

**[VERIFIED]** Primary files consulted, grouped by subsystem (not exhaustive — see the three underlying scratchpad audits for full per-line citations):

- **Frontend routing/pages**: `frontend/src/app/{page,campus/page,campus/[buildingId]/page,tour/page,map/page,chat/page}.tsx`
- **Tour engine**: `frontend/src/features/tour/engine/{PanoramaEngine,PanoramaLinkedList,PanoramaNode,hotspotEngine,guidedTour}.ts`, `frontend/src/hooks/useGuidedTour.ts`, `frontend/src/features/tour/Minimap.tsx`
- **Map**: `frontend/src/features/mapSatellite/{SatelliteCampusMap,GoogleSatelliteMap,BuildingMarker,CampusMarker}.tsx`, `frontend/src/config/campusLocation.ts`
- **Chat/voice**: `frontend/src/hooks/{useChatConversation,useSpeechRecognition}.ts`, `frontend/src/features/chat/{ChatWindow,ChatInput}.tsx`, `frontend/src/store/chatStore.ts`
- **Backend API**: `backend/app/api/v1/{chat,navigate,tour,panoramas,cross_floor_hotspots,crud_router}.py`, `backend/app/main.py`
- **RAG pipeline**: `scripts/ai/{clean_and_chunk,build_embeddings,hybrid_retrieval,reranker,confidence,llm_generator,grounding,query_expansion,conversation_context}.py`
- **Multi-agent**: `scripts/ai/{supervisor,agent_base,admission_agent,academic_agent,facilities_agent,navigation_agent,general_agent}.py`
- **Intent classifier**: `backend/app/intent_model/{model,classify,dataset,train,vocab}.py`, `backend/app/intent_model/artifacts/*`
- **Navigation**: `backend/app/navigation/{pathfinding,graph_builder}.py`
- **Database**: `backend/app/models/*.py`, `database/migrations/versions/*.py`, live PostgreSQL query against `gat_campus_tour`
- **Data**: `data/raw/{pdfs,website}/`, `data/processed/chunks.jsonl`, `data/metadata/source_manifest.json`, `data/chroma_db/` (live ChromaDB query)
- **Config/deployment**: `docker-compose.yml`, `.env.example`, `.github/workflows/ci.yml`, `backend/Dockerfile`, `frontend/Dockerfile`
- **Docs (for staleness cross-checking)**: `README.md`, `CLAUDE.md`, `GAT_Virtual_Tour_Build_Guide.md`, `docs/architecture.md`, `docs/RAG_ARCHITECTURE.md`, `docs/adding_real_photos.md`, `docs/phase15-19_*.md`
- **Git history**: `git log --oneline` (45 commits), `git show --stat` on `b3219d9` (map/GPS deletion) and other key commits

---

## 29. Consistency / Quality Re-Scan Notes

**[VERIFIED — cross-checked across all three underlying audits during synthesis]**

- All three audits independently confirm `data/campus_graph.json` does not exist and that the real graph lives in PostgreSQL — consistent, no contradiction.
- All three audits independently confirm no Kaggle CSV / `scripts/build_kb.py` exists — consistent, no contradiction. The correction was applied to the backend audit mid-task after the data/docs audit surfaced it first; both now agree.
- The frontend audit's `ChatResponse` TypeScript contract and the backend audit's actual Pydantic `ChatResponse` schema were cross-checked and match field-for-field.
- The frontend audit's panorama counts (334 total / 178 primary) and the data/docs audit's count (330 total) differ slightly — both are labeled as approximate due to different counting methodologies (glob patterns vs. `find`), and both explicitly flag this themselves; this report reports the range rather than picking one arbitrarily (§18).
- `CLAUDE.md`'s "no phase implementation has started yet" claim is independently and unanimously refuted by all three audits (24 frontend commits, 45 total commits, a populated live database, a working RAG pipeline) — this is the single most load-bearing correction this report makes relative to the project's own documentation, and it is treated consistently throughout (never described as "planned" or "in progress" anywhere above where it is in fact implemented).
- Where `CLAUDE.md` and the actual code disagree (map technology, chat streaming, async I/O, RNN confidence threshold, OLLAMA_MODEL default, navigate endpoint method, intent class count), this report always defers to the code, per the user's explicit instruction and per `CLAUDE.md`'s own stated tie-breaking rule.

---

## 30. Final Quality Check & Critical Information Still Required Before IEEE Paper Writing

### 30.1 Final quality check
This report was assembled from three independently-conducted, evidence-cited audits, cross-referenced against each other in §29 for contradictions (none found beyond minor counting-methodology variance, disclosed). Every numeric claim in §18–§19 traces to either a live database/ChromaDB query or a direct file/line count. No section above describes a planned feature as completed; every "PLANNED / NOT IMPLEMENTED" and "NOT VERIFIED" label was carried through from the underlying audits rather than softened.

### 30.2 Critical information still required before IEEE paper writing — only the user can supply these

1. **Real experimental results**: retrieval precision/recall, confidence-threshold validation, reranker A/B comparison, intent-classifier confusion matrix on real (non-synthetic) queries — none of this exists yet (§20).
2. **A formal evaluation run**: `CLAUDE.md`'s Phase 7 `eval/` pipeline (25 fixed questions, LLM-judge faithfulness/relevancy scores) has never been built or run. This is very likely the single highest-priority gap for any IEEE results section.
3. **User study / usability data**: none exists in the repository.
4. **Load/concurrency test results**: `scripts/load_test.py` does not exist; only one anecdotal 2-request timing exists (§19).
5. **Comparison baselines**: no comparison against any other campus-assistant or general-purpose RAG system has been performed.
6. **Exact hardware specs** used for development/any future benchmarking (CPU/GPU, RAM, whether Ollama ran on CPU or GPU) — not derivable from the repository.
7. **Final, precise dataset counts** if a stricter single number is needed for publication — this report gives ranges/multiple cross-checked counts (§18) rather than picking one arbitrarily; the user should decide which count (e.g., 178 vs ~334 panoramas, 128 vs 141 attempted PDFs) is the "headline" figure and why.
8. **Conference-specific requirements**: page limits, anonymization requirements, required IEEE template fields — not something this repository can supply.
9. **Author/affiliation details** for the paper itself.
10. **Literature references** for §II (Related Work) — this audit performed no literature search and none exists in the repository.
11. **A decision on how to characterize the deliberately-deleted 3D map/GPS-navigation subsystem** (§6) — whether to present it as a design iteration (built, evaluated, and consciously simplified) or omit it entirely; the repository shows only that it was built then removed, not the reasoning beyond a commit message.

**This report does not generate the IEEE paper itself, per explicit instruction.** It is intended solely as the factual grounding document for that future, separate task.
