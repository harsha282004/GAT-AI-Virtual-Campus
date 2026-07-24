# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

Architecture is approved and the project skeleton has been scaffolded (`frontend/`, `backend/`, `database/`, `docs/`, `assets/`, `tests/`, `scripts/`, plus root config). **No phase implementation has started yet** — no routes, no models, no agents, no RAG pipeline, no pages beyond the framework-mandated Next.js bootstrap. `GAT_Virtual_Tour_Build_Guide.md` remains the authoritative phase-by-phase spec; `docs/architecture.md` is the approved system architecture (note: that document predates the final stack below in a few places — Ollama/Llama 3 and PostgreSQL/SQLAlchemy supersede any mention there of the Claude API or Redis). This file is kept up to date with whichever is currently true; when the two disagree, this file and the actual code win.

## Tech stack (final, approved)

| Layer | Choice |
|---|---|
| Frontend | Next.js 15 (App Router) + React + TypeScript + Tailwind CSS |
| Backend | FastAPI (async) + Pydantic |
| Relational DB | PostgreSQL, via SQLAlchemy (ORM) + Alembic (migrations) |
| Vector DB | ChromaDB (embedded/local-mode, persisted to disk) |
| RAG orchestration | LangChain |
| LLM (RAG generator, translation, judge) | Ollama running Llama 3, called via LangChain — local, no external API key |
| Intent classifier | PyTorch LSTM (embedding → LSTM → dense → softmax) |
| Multi-agent orchestration | Hand-rolled Python router (Supervisor + specialists) — LangGraph is an optional future upgrade, not a dependency today |
| 360° viewer | Pannellum |
| 3D map | MapLibre GL JS + custom campus GeoJSON |
| Voice | Web Speech API (browser-native) |
| Multi-language | i18next (UI) + LLM-driven answer translation |
| Containerization | Docker Compose (`frontend`, `backend`, `db`, `ollama` services) |

**No Redis.** Earlier drafts of the architecture used Redis for session/rate-limit state; the approved stack has no Redis service or dependency. Session/conversation state, when implemented, lives in PostgreSQL — this is an open design point to resolve in Phase 3, not something to silently reintroduce Redis for.

## How this project is meant to be built

The build guide is organized into **7 sequential phases**, each independently runnable and demoable. The user drives this one phase at a time — do not jump ahead to a later phase's work unless explicitly asked, even if it seems efficient to combine steps. After finishing a phase, the expectation is that the user actually runs and clicks through the feature before moving to the next phase's prompt.

1. **Phase 1 — Frontend shell**: Next.js App Router pages (Home, Tour, Assistant, Admissions, Academics, Facilities, Contact) and shared components (Navbar, Footer, LanguageSwitcher). No backend yet.
2. **Phase 2 — RAG knowledge base + RNN intent classifier**: `scripts/build_kb.py` relabels a Kaggle CSV into GAT-branded content, chunks/embeds it into a local ChromaDB collection (`gat_kb`). FastAPI `POST /api/v1/chat` retrieves top-5 chunks and calls Llama 3 (via LangChain + Ollama) to answer strictly from retrieved context, returning `{answer, sources, confidence}`. A PyTorch LSTM in `backend/app/intent_model/` classifies queries into `admissions | academics | facilities | navigation | general` via `classify_intent(text)`.
3. **Phase 3 — Multi-agent supervisor + concurrency**: `backend/app/agents/supervisor.py` routes by intent to `admissions_agent.py`, `academics_agent.py`, `facilities_agent.py`, `navigation_agent.py` (stubbed until Phase 5 — does not call the LLM, will call pathfinding instead), and `general_agent.py`. Every agent grounds answers in the same ChromaDB retrieval; none answer from memory. Low RNN confidence (<0.55) triggers one clarifying question instead of a guess. Separately: decide and implement where session state lives (PostgreSQL, per the no-Redis decision above), ensure truly async I/O, add per-session rate limiting, and write `scripts/load_test.py` (asyncio + httpx, 50 concurrent sessions).
4. **Phase 4 — Voice**: Web Speech API only (browser STT/TTS, no server-side voice cost). Mic control in the Assistant page, "read answers aloud" toggle, voice nav commands ("take me to X"), graceful degradation on unsupported browsers.
5. **Phase 5 — 360° tour, pathfinding, 3D map**: `data/campus_graph.json` (node/edge graph of campus locations, plus per-edge yaw/pitch for hotspot placement) feeds `backend/app/navigation/pathfind.py` (Dijkstra/A*) exposed as `POST /api/v1/navigate`. Pannellum-based Tour view maps each graph node to a panorama in `frontend/public/panoramas/{node_id}.jpg`, with hotspot navigation and auto-advance along computed paths. MapLibre-based map view renders a custom GeoJSON campus footprint with extruded placeholder buildings and animates a marker along routes. Panoramas and GPS/building data are explicitly placeholder — code must be structured so dropping in real Insta360 equirectangular exports and surveyed coordinates later requires no logic changes, only asset swaps (see `docs/adding_real_photos.md`).
6. **Phase 6 — Multi-language**: i18next/react-i18next for static UI strings (English, Kannada, Hindi), served from `frontend/public/locales/{en,kn,hi}/`. The AI assistant is not pre-translated: it retrieves from the English KB but is instructed via system prompt to answer in the user's selected language via Llama 3, keeping proper nouns (GAT, VTU, department names) untranslated. Voice STT/TTS language follows the UI language selection.
7. **Phase 7 — Evaluation**: `eval/test_questions.json` (25 fixed questions: in-domain, out-of-scope, ambiguous). `eval/run_eval.py` sends each to `/api/v1/chat`, then uses a separate LLM call (Llama 3, isolated prompt) as a judge to score faithfulness and answer relevancy (1-5), and flags correct refusal/clarification behavior. Outputs `eval/results.csv` and `eval/report.md`.

## Architectural decisions to preserve

Two conflations in the original spec were deliberately corrected — do not undo these when implementing:

- **RNN ≠ the RAG answer generator.** Llama 3 (via LangChain + Ollama) generates grounded natural-language answers. The RNN is a separate, small PyTorch LSTM used only as an *intent classifier* upstream of retrieval — it tags queries into one of 5 classes and feeds the multi-agent router. Never wire the LSTM up to generate free-text answers.
- **Multi-agent ≠ concurrency.** "Multi-agent" refers to the Supervisor + specialist-agent routing architecture (an intent-driven design decision). Handling many simultaneous users is a separate backend concern (async I/O, per-session isolation, rate limiting, connection pooling). Keep these two concerns in distinct code paths; don't spawn a new agent instance per user session.

All specialist agents must ground every answer in ChromaDB-retrieved chunks and cite sources — no agent should answer from its own memory/training data, including the `general_agent` fallback. Every agent goes through the same shared retriever and LLM client module — no agent gets its own private ChromaDB connection or Ollama client.

## Commands

```bash
# one-time setup
python -m venv venv && source venv/bin/activate   # venv\Scripts\activate on Windows
pip install -r requirements.txt

# environment
cp .env.example .env   # then also copy NEXT_PUBLIC_* into frontend/.env.local for non-Docker frontend dev

# frontend (Phase 1+)
cd frontend && npm install && npm run dev

# backend (Phase 2+)
uvicorn app.main:app --reload --app-dir backend

# database migrations
cd backend && alembic revision --autogenerate -m "message" && alembic upgrade head

# local LLM
ollama pull llama3

# knowledge base build (Phase 2)
python scripts/build_kb.py

# concurrency load test (Phase 3)
python scripts/load_test.py

# evaluation pipeline (Phase 7)
python eval/run_eval.py

# full stack via Docker
docker-compose up --build

# lint / format / type-check (backend)
ruff check backend && black backend && mypy backend

# tests
pytest                 # backend, per pyproject.toml testpaths
cd frontend && npm run lint && npm run type-check
```

## Key data/API contracts

- `POST /api/v1/chat` — `{session_id, message}` → `{answer, sources: [chunk_ids], confidence}`
- `POST /api/v1/navigate` — `{from, to}` → `{path: [node names], total_distance, estimated_walk_time, turn_by_turn: [...]}`
- `data/campus_graph.json` — node/edge graph of campus locations with walking distances and per-edge hotspot yaw/pitch; the single source of truth for pathfinding, panorama hotspots, and the 3D map's points/routes
- `frontend/public/panoramas/{node_id}.jpg` — panorama assets keyed by campus graph node ID; swapping these for real Insta360 exports (matched by filename to `node_id`) is meant to be the *only* step required to go from placeholder to real photos

## Folder conventions

- `frontend/src/app/` — Next.js App Router routes only (layouts, pages, route handlers). No business logic here — routes compose components and hooks.
- `frontend/src/components/` — presentation components, grouped by feature area (`tour/`, `map/`, `assistant/`, `layout/`, `common/`), not a flat bag.
- `frontend/src/hooks/`, `frontend/src/lib/` — `hooks/` for stateful browser behavior (speech, chat lifecycle, navigation), `lib/` for the service/API-client layer. `lib/` is the *only* place allowed to call `fetch`/`WebSocket`.
- `backend/app/api/v1/` — FastAPI routers only: request validation, dependency wiring, response shaping. No business logic.
- `backend/app/agents/`, `rag/`, `llm/`, `navigation/`, `intent_model/`, `session/` — one package per domain concern, mirroring `docs/architecture.md`'s module boundaries. A new capability gets its own module here, not a grab-bag file.
- `backend/app/models/` — SQLAlchemy ORM models. `backend/app/schemas/` — Pydantic request/response schemas. Keep these separate; a schema is not a model and vice versa.
- `backend/app/db/` — engine/session/declarative-base plumbing the running app uses. `database/migrations/` — Alembic's environment and generated migrations. `database/seeds/`, `database/init/` — data seeding and container bootstrap SQL. These are deliberately separate: `backend/app/db/` is runtime code, `database/` is migration/ops tooling.
- `data/campus_graph.json` and KB source docs live at repo root under `data/` (created when Phase 2/5 lands), not inside `backend/` or `frontend/` — both the backend and any tooling script need to reference it independently of either app.
- `scripts/` — operational scripts only (setup, KB build, load test, seeding), never imported by the running application.
- `eval/` — the groundedness evaluation pipeline (Phase 7), independent of `tests/`.
- `tests/backend/`, `tests/frontend/`, `tests/e2e/` — see Testing strategy below.

## Naming conventions

- **Python**: `snake_case` for files, functions, and variables; `PascalCase` for classes. One module per single responsibility — e.g. `admissions_agent.py`, not `agent1.py` or a catch-all `agents.py`. Agent modules are always named `<domain>_agent.py`.
- **TypeScript/React**: components in `PascalCase.tsx` matching their exported component name (`PanoramaViewer.tsx` exports `PanoramaViewer`); hooks in `camelCase.ts` prefixed `use` (`useChat.ts`); everything else (`lib/`, `utils`) in `camelCase.ts`.
- **API routes**: `/api/v1/<resource>`, versioned, resource names as lowercase nouns (`chat`, `navigate`, `session`) — not verbs.
- **Database**: `snake_case` table and column names, tables named as plural nouns (`sessions`, `conversation_messages`), Alembic revision files use the auto-generated slug plus a short human-readable message.
- **Environment variables**: `SCREAMING_SNAKE_CASE`, grouped by section in `.env.example` (see that file's comments) — don't add a new var without a matching section/comment there.
- **Git branches**: `type/short-description` (`feature/`, `fix/`, `chore/`) — see Git workflow below.

## API conventions

- All HTTP endpoints are versioned under `/api/v1/`. A breaking contract change gets a new version prefix, not a silent change to `v1`.
- REST for stateless request/response (`/api/v1/navigate`, session bootstrap). Reserve WebSocket/SSE specifically for chat, so the LLM's answer can stream token-by-token — don't add WebSocket elsewhere without a specific reason.
- Use FastAPI's `response_model` (Pydantic schemas from `backend/app/schemas/`) on every route — never return raw dicts from a handler.
- Every response that includes an AI-generated answer includes its grounding sources (`chunk_ids`) — this is a contract, not an optional field.
- CORS is restricted to the configured frontend origin(s) (`CORS_ALLOWED_ORIGINS`) — never wildcard `*` even in development scaffolding.

## Coding standards

- **Python**: type hints on all function signatures; formatted with `black`, linted with `ruff`, type-checked with `mypy` (configs already in `pyproject.toml`) — run all three before considering backend work done. All I/O (DB, ChromaDB, Ollama) is `async`/`await`; a synchronous call in a request path is a bug, not a style nit.
- Respect the four-tier backend dependency direction: API layer → agents/orchestration → domain services (`rag/`, `navigation/`, `intent_model/`, `llm/`) → data/infra. A layer only calls the layer below it — an API route never calls ChromaDB directly, for instance.
- **TypeScript**: `strict` mode is on (`tsconfig.json`) — keep it on, don't add `any` to work around a type error. Functional components and hooks only, no class components. State stores (`sessionStore`, `chatStore`, `tourStore`) are the single source of truth for cross-component state — a component reading tour position must read it from `tourStore`, never duplicate it in local state.
- Don't introduce a new top-level dependency (Python or npm) without updating `requirements.txt`/`package.json` accordingly and noting why in the PR/commit — especially anything that would reintroduce Redis or an external paid API, both deliberately excluded from this stack.

## Git workflow

- Branch per phase (or per meaningful unit of work within a phase): `feature/phase2-rag-pipeline`, `fix/navigation-graph-cycle`, etc. Don't commit multiple phases' work to one branch.
- Commits are scoped and descriptive (what changed and why in the message, not just "wip" or "updates") — conventional-commit-style prefixes (`feat:`, `fix:`, `chore:`, `docs:`) are welcome but not mandatory.
- Never force-push or rewrite history on a shared/main branch. Never commit `.env`, `venv/`, `node_modules/`, `.next/`, `data/chroma_db/`, or anything else covered by `.gitignore`.
- Before starting a new phase's work, make sure the previous phase's branch is merged (or explicitly parked) — the build guide's "one phase at a time, verify before moving on" discipline applies to git history too.

## Logging

- Python backend: standard library `logging`, one logger per module via `logging.getLogger(__name__)` — no bare `print()` in application code.
- The Supervisor **must** log every routing decision (`agent_name`, `intent_label`, `confidence`) at `INFO` level — this is a functional requirement from Phase 3 (the report/demo needs to show routing decisions), not just a debugging nicety.
- Never log secrets, API keys, or full raw user messages containing PII at a level that ends up in shared logs — log message length/hash or a truncated preview if content needs to be traced.
- Frontend: don't leave `console.log` debugging statements in committed code; surface user-facing errors through UI state, not just the browser console.

## Error handling

- FastAPI: raise `HTTPException` (or a registered exception handler) for expected failure cases; never let an unhandled exception in an agent, retriever, or LLM call bubble up as a raw 500 — catch at the agent boundary and degrade gracefully (e.g., the RAG refusal string when nothing is grounded, a clarifying question when intent confidence is low).
- A failure in one domain service (e.g. Ollama unreachable) must produce a clear, typed error response — not crash the request handler or leave a hanging connection.
- Frontend: every service call (`lib/`) that can fail is wrapped so the calling component can render a distinct loading/error/empty state — no unhandled promise rejections, no silently-swallowed fetch errors.
- Validate at system boundaries only (incoming HTTP requests via Pydantic schemas, external API responses) — don't add defensive checks for conditions internal code already guarantees.

## Testing strategy

- **Backend** (`tests/backend/`, pytest): unit tests per domain module (retriever, pathfinding, intent classifier) plus integration tests for each API endpoint (`/api/v1/chat`, `/api/v1/navigate`). Configured via `pyproject.toml` (`testpaths = ["tests/backend"]`).
- **Frontend** (`tests/frontend/`): component/hook tests (runner — Jest or Vitest — to be chosen when Phase 1 lands).
- **End-to-end** (`tests/e2e/`): full user flows across the running stack (ask a question and get a cited answer; say "take me to the library" and see the panorama/map advance) — tool (Playwright or Cypress) to be chosen when Phase 4/5 land.
- **`eval/`** is a distinct, separate concern from the above: it measures answer *quality* (faithfulness, relevancy) via an LLM judge, not code correctness. Don't conflate it with unit/integration tests — a green `pytest` run and a good `eval/report.md` are two different signals.
- **`scripts/load_test.py`** is a manual concurrency check (50 concurrent sessions), run before a demo, not part of the automated test suite.

## Content facts to use verbatim when populating pages/KB

Global Academy of Technology (GAT): established 2001, ~10-acre campus in Rajarajeshwari Nagar, Bangalore. VTU-affiliated, NAAC A grade, AICTE approved. Offers BE/MTech/MSc/MBA. Admission via KCET/COMEDK/PGCET/GATE/KMAT. Departments: CSE/ISE/ECE/EEE/ME/CE. Hostel with separate boys/girls blocks. 450-seat auditorium + 2 seminar halls (90+ seats each). Campus bus routes from Majestic/Shivajinagar/Kengeri/Jayanagar. Tagline: "Growing Ahead Of Time." Theme: deep navy/maroon + gold accent.
