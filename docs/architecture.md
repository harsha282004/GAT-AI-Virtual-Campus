# GAT Virtual Campus Tour — Software Architecture Document

*Approved architecture. Note: this document was approved under an earlier tech-stack proposal (Claude API, ChromaDB + local embeddings, Redis for sessions). The project subsequently adopted a revised stack — Next.js 15, FastAPI, SQLAlchemy, Alembic, PostgreSQL, LangChain, ChromaDB, Ollama/Llama 3 — with no Redis. The high-level module boundaries, workflows, and design principles below still hold; where a section names a since-changed technology (e.g. "Claude API" as generator, "Redis" for session state), read it as superseded by PostgreSQL/SQLAlchemy for persistence and Ollama/Llama 3 (via LangChain) for generation. This document has not yet been rewritten against the new stack.*

---

## 0. Design Principles Guiding This Architecture

- **Separation of the two things the original spec conflated**: intent-classification (RNN) is never the answer-generator (LLM), and multi-agent routing is never the concurrency mechanism. Enforced by putting them in physically separate modules with no shared state.
- **Stateless backend, stateful store.** No per-user data lives in process memory beyond a request's lifetime. Everything that must persist across requests (conversation history, current tour position, rate-limit counters) lives in a durable store, not application memory.
- **Placeholder-swap, not placeholder-rebuild.** Every placeholder (panoramas, GPS coordinates, building footprints, campus distances) is isolated behind a stable interface (a file path convention, a JSON schema) so replacing it is a data change, never a code change.
- **Scope discipline for a demo/report project.** This is a college major project with a review panel, not a production SaaS. The architecture is deliberately not over-engineered (no Kubernetes, no microservices-per-agent, no managed cloud vector DB) — it's sized to be genuinely buildable phase-by-phase while still being technically defensible in a viva.

---

## 1. Folder Hierarchy

See the repository root for the current, authoritative folder structure (this skeleton was generated after this document's approval). Top-level: `frontend/`, `backend/`, `database/`, `docs/`, `assets/`, `tests/`, `scripts/`, `.github/`, `.vscode/`.

## 2. Backend Architecture

Layered, four tiers, strict downward dependency (a layer only calls the layer below it):

1. **API layer** (`api/v1/*`) — FastAPI routers. Owns HTTP/WebSocket concerns only: request validation (pydantic schemas), auth/rate-limit dependency checks, response shaping. Contains no business logic.
2. **Orchestration layer** (`agents/*`) — the Supervisor and specialists. Owns *decisions*: which agent handles a query, what system prompt to use, when to ask a clarifying question.
3. **Domain services** (`rag/*`, `navigation/*`, `intent_model/*`, `llm/*`) — reusable, agent-agnostic capabilities. The retriever doesn't know which agent called it; `pathfind.py` doesn't know it's serving a chat request.
4. **Data/infra layer** (`session/*`, ChromaDB, PostgreSQL via SQLAlchemy) — the only tier that talks to external stateful systems.

All I/O across all four tiers is `async`/`await`.

## 3. Frontend Architecture

Standard React component architecture with an explicit state/service split so pages stay thin: pages compose components and hooks; components are presentation-focused, organized by feature area; hooks encapsulate stateful browser behavior; services are the only layer allowed to call `fetch`/`WebSocket`; state stores are the shared source of truth (e.g. a tour store subscribed to by both the panorama viewer and the map view, keeping them in lockstep during a guided walk).

## 4. Database Architecture

- **ChromaDB** — vector store for KB chunks, embedded/local-mode inside the backend process, persisted to disk.
- **PostgreSQL (via SQLAlchemy + Alembic)** — the durable relational store: intended home for session/conversation state, routing-decision logs, and eval results, superseding the Redis + SQLite split originally proposed.
- **`campus_graph.json`** — static config: nodes, edges, distances, hotspot metadata. Not a database — a small, human-editable config file is the right tool at this scale.

## 5. AI Architecture

Five distinct AI/ML components, deliberately kept separable: intent classifier (RNN), router (deterministic, non-ML), retriever (embedding model + ChromaDB), generator (LLM via LangChain/Ollama/Llama 3), and judge (a separate, isolated LLM call used only in evaluation).

## 6. RAG Pipeline

Ingestion → chunking (~300 tokens, 50-token overlap, domain-tagged) → embedding → storage in ChromaDB → retrieval (top-5 similarity, optionally domain-filtered by intent label) → augmentation (system prompt + chunks + history + query) → generation (grounded, cites chunk IDs, refuses gracefully when nothing relevant is retrieved) → post-processing (citation mapping, confidence scoring) → feedback logging of refused/ungrounded questions.

## 7. Multi-Agent Workflow

A hand-rolled Python router (not a graph-orchestration framework) as the primary implementation: message → intent classification → supervisor routes by (label, confidence) → below-threshold confidence yields one clarifying question, otherwise dispatch to the matching specialist agent (admissions/academics/facilities/navigation/general), each grounding its answer in the same shared retriever and LLM client. The navigation agent is special-cased: it calls the pathfinding module, not the RAG retriever, for the substantive answer.

## 8. Navigation Workflow

Building-to-building (not room/floor-level) routing over a static graph: resolve target and start nodes → Dijkstra/A* pathfind → derive walk time → format turn-by-turn directions → return path to the frontend, which drives the panorama viewer and the 3D map off one shared piece of state so they advance in sync → update the session's current position as the guided walk progresses.

## 9. Panorama Workflow

1:1 mapping between graph nodes and panorama image files; per-edge yaw/pitch metadata for hotspot placement; guided-walk mode steps through a returned path, advancing both the panorama and the map marker from the same state; missing assets fall back to a labeled placeholder so the pipeline is demoable before real photos exist; swapping in real photos is a pure asset/metadata change.

## 10. Deployment Architecture

Sized for a demo/report project: Docker Compose services for frontend, backend, PostgreSQL, and Ollama; ChromaDB embedded in the backend process rather than a standalone service; all environment-specific values via `.env`; no Kubernetes, no managed vector DB, no multi-region.

## 11. API Communication

REST for stateless request/response operations (navigation, session bootstrap), versioned under `/api/v1/`; WebSocket/SSE reserved for the chat endpoint to allow token-by-token streaming.

## 12. Authentication Strategy

Anonymous, session-ID-based identity for the public-facing tour/chat (no user accounts, no PII); abuse protection via rate limiting, CORS restriction, and a server-side-only LLM/API configuration; a separate, minimally-authenticated admin surface is recommended if internal review tooling (flagged questions, eval reports) is added.

## 13–16. Module Responsibilities, Communication, Scalability, and Multi-User Handling

Every agent goes through the same shared retriever and LLM client — no agent holds a private connection — which is what structurally guarantees "no agent answers from memory." Scalability and multi-user isolation both depend on keeping the backend stateless and externalizing all per-user state to the durable store, so any number of backend replicas can serve any request without sticky sessions.

## 17. Suggested Improvements (as originally flagged)

Embedding model selection, API versioning, persistent logging/analytics, an admin auth surface, per-edge hotspot metadata in the graph schema, a decision on streaming transport, semantic response caching, a decision on indoor vs. building-level navigation scope, a defined confidence-scoring method, and an explicit session TTL/cleanup policy. These remain open design decisions to resolve during implementation, now against the PostgreSQL-backed stack rather than Redis.
