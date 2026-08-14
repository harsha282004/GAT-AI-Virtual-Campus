# Phase 15 — Contextual Conversation + Follow-Up Questions

## Purpose

Lets the chatbot understand follow-up questions that depend on earlier
turns in the same conversation ("Which floor is it on?" after "Where is
the CSE department?"), without the user having to repeat themselves —
while never guessing when the reference is genuinely ambiguous.

## How conversation sessions work

Unchanged from Phase 8: `POST /api/v1/chat` accepts an optional
`session_id`; the backend creates or reuses a `ChatSession` row
(`backend/app/models/chat_session.py`) and records every user/assistant
turn as a `ChatMessageRecord`. No new tables, no schema migration — see
"Why no database migration" below.

## How context is stored

Each assistant turn already carries a `resolved_location` column
(`ChatMessageRecord.resolved_location`), populated whenever a specialist
agent resolved the query to one real, named entity — not just spatial
locations despite the column's name: `facilities_agent`'s supplementary
DB lookup and `navigation_agent`'s spatial/tool paths both populate it
(see `backend/app/api/v1/chat.py`'s `_extract_location_mentioned()`).
Phase 15 reuses this column as-is; it does not track a separate
"conversation history" structure.

`backend/app/session/store.py::get_recent_active_entities()` (new in
Phase 15) reads the last `MAX_ACTIVE_ENTITIES` (2) *distinct* values of
this column from recent, non-expired (`CONTEXT_TTL_SECONDS`, 30 minutes,
unchanged from Phase 8) assistant turns — this is the "active entity"
candidate list every follow-up is resolved against.

## How follow-ups are detected

`scripts/ai/conversation_context.py::has_reference_cue()` — a set of
regex patterns for bare pronouns/demonstratives (it, that, this, they,
them, these, those, here, there), possessives (its, their), topic
continuations ("what about X", "how about X", "and (the) X"), "tell me
more", and bare spatial adjuncts ("which/what floor/building?"). A
message matching none of these is always treated as an ordinary,
independent query — this is a deliberate, conservative gate: it means
topic changes are handled correctly *by construction* (a genuinely new
topic like "What are the admission requirements?" contains none of these
cues and is never touched by this layer).

## How referents are resolved

`conversation_context.py::resolve_reference(message, active_entities)`
returns one of four outcomes:

- **`independent`** — no reference cue; `message` is used as-is.
- **`no_context`** — a cue was found but there is no active entity to
  resolve it against (e.g. a follow-up to a plain RAG-generated academic
  answer, which today resolves no structured entity). Falls through to
  the pre-existing Phase 8 mechanism: prepend the raw previous question as
  extra retrieval context.
- **`resolved`** — exactly one active entity; the message is
  deterministically reformulated (bare-referent substitution, possessive
  substitution, or an "X in {entity}" / "Tell me more about {entity}"
  template depending on which pattern matched) into a self-contained
  query, e.g. "Which floor is it on?" + `["CSE department"]` → "Which
  floor is CSE department on?".
- **`ambiguous`** — 2+ distinct active entities. See below.

No LLM call anywhere in this resolution step — every decision is a plain
regex match or list operation, per this phase's "avoid unnecessary LLM
calls, prefer deterministic resolution" requirement.

## How ambiguity is handled

When `resolve_reference()` returns `ambiguous`,
`backend/app/api/v1/chat.py::chat()` short-circuits the entire request:
it never calls `supervisor.route()`, never touches retrieval or
generation, and returns a clarifying question directly (e.g. "I can help
with that. Do you mean Library or Power System Simulation Lab?"),
persisting both turns for continuity. This is the system's core
behavioral rule for this phase: **correct clarification over a wrong
contextual guess.**

## How context is passed into RAG / how it interacts with multi-agent routing

A `resolved` reformulated query is handed to `_supervisor.route()`
exactly like any other query — Phase 13's supervisor re-classifies it
fresh, so a follow-up can legitimately switch specialist agents from
its parent turn (e.g. a spatial "Where is the library?" followed by a
possessive "What are its timings?" naturally routes wherever the
reformulated text's own keywords point). Phase 15 never hand-wires
domain continuity and never bypasses BM25/dense retrieval, query
expansion, fusion, reranking, or context selection (Phases 2/11/12) —
it only ever changes what *text* enters that unmodified pipeline.

## How grounding remains active

The reformulated query flows through the exact same
`agent_base.run_specialist()` → `llm_generator.generate_answer()` →
`grounding.find_unsupported_claims()` pipeline as any other query
(Phase 14, unmodified). A contextual follow-up that tempts the LLM to
invent specifics (e.g. "What equipment does it have?" for a room with no
equipment data) is still subject to the same post-generation grounding
check and the same confidence-gated refusal behavior — Phase 15 adds no
new generation path and no new confidence formula.

## Why no database migration

Section 16 of the Phase 15 spec explicitly says: create a migration only
if genuinely required, otherwise don't. Everything Phase 15 needs —
recent entity names, freshness windowing, distinct-candidate detection —
is already representable with the existing `resolved_location` column
read across multiple rows, so no new table or column was added.

## Known limitations

- **Entity tracking is name-only, not typed.** There is no persisted
  "domain"/"category" per turn (e.g. "this was an ACADEMIC entity") —
  only the entity's display name. This is sufficient for every scenario
  this phase's own test suite exercises (the re-classification approach
  above naturally recovers the right domain), but a future phase wanting
  richer per-turn metadata would need a real schema change.
- **Reformulation grammar is not perfect English**, only good enough for
  retrieval purposes (e.g. "Which floor is CSE department on?" omits
  "the"). These reformulated strings are retrieval/routing inputs, not
  text ever shown to the user.
- **Structured-entity resolution requires a prior turn that resolved a
  named entity.** A follow-up to a plain RAG-generated answer with no
  structured entity (e.g. a generic academic aggregation) falls back to
  Phase 8's raw-question-prepend strategy, which is a real, tested,
  but less precise mechanism than direct substitution.
- **The reference-cue list is hand-curated, not exhaustive.** A
  follow-up with no pronoun and no obviously-matching domain keyword of
  its own (e.g. a bare "What documents do I need?" with zero prior
  context) is treated as independent and answered on its own merits —
  deliberately conservative, per this phase's "prefer clarification/
  independence over a wrong guess" rule.
