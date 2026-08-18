"""Phase 7/8 — POST /api/v1/chat.

Connects the completed Phase 1-6 AI pipeline (scripts/ai/) to the running
FastAPI application. Calls supervisor.route() — the same Supervisor
Phase 5/6 already built and tested — and never bypasses it: this router is
the application/API boundary, not a second AI router.

INTEGRATION APPROACH — read before assuming otherwise:
CLAUDE.md's folder conventions describe scripts/ as "operational scripts
only... never imported by the running application." That convention was
written for one-off setup/build/seed scripts, and the actual code has
already evolved past it: scripts/ai/ became a fully-built, tested
retrieval + reranking + confidence + LLM generation + multi-agent + tool
pipeline across Phases 1-6, all deliberately kept out of backend/app/ so
each phase stayed independently runnable and testable via plain `python
scripts/ai/test_*.py`. Phase 7 explicitly required connecting that
completed pipeline to the live app; rebuilding it inside backend/app/ from
scratch would directly violate the equally explicit "do not create
duplicate RAG, agent, navigation, panorama, or confidence implementations"
instruction. Given that direct conflict, this router imports scripts/ai/
via the same sys.path-insertion pattern Phase 6 already established for
the reverse direction (scripts/ai/campus_db.py inserting backend/ onto
sys.path) — the only change is which side initiates it. CLAUDE.md's own
preamble says "when the two disagree, this file and the actual code win,"
and its folder-convention line has been updated to reflect this.

SYNC HANDLER, NOT ASYNC — also deliberate: the entire Phase 1-6 pipeline
(ChromaDB queries, sentence-transformers encoding, SQLAlchemy ORM calls,
the Ollama HTTP call) is synchronous, blocking code — rewriting all of it
to async/await is exactly the "duplicate implementation" scope Phase 7
avoided and Phase 8's "no large unrelated refactor" instruction reaffirms.
Declaring this route as a plain `def` (not `async def`) is the correct
FastAPI-idiomatic answer: Starlette runs sync route handlers in a thread
pool automatically, so a slow request never blocks the event loop. This
also matches the ACTUAL existing convention in this codebase —
backend/app/api/v1/tour.py's handlers are sync `def` too.

PHASE 8 ADDITIONS — session persistence + hardening:
Session/history reads and writes go through app.session.store (now
PostgreSQL-backed via Depends(get_db), replacing Phase 7's in-process
dict) but are individually wrapped so a database hiccup degrades the
*persistence* of a conversation, never the answer itself — a user still
gets a fully grounded response even if session storage is briefly
unavailable, they just lose follow-up continuity for that one exchange.
Any exception this router doesn't explicitly catch is still handled
safely by the existing app-wide handlers in app.core.exceptions
(SQLAlchemyError -> 503 with a generic message, any other Exception -> 500
with a generic message) — no stack trace or internal detail ever reaches
the client, reusing that existing infrastructure rather than duplicating
it here.

PHASE 15 ADDITIONS — contextual conversation:
scripts/ai/conversation_context.py's resolve_reference() (pure, DB-
independent) is layered in front of the Phase 7/8 follow-up mechanism
below, using app.session.store.get_recent_active_entities() as its
candidate list. Three outcomes: "resolved" (exactly one active entity —
the follow-up is reformulated into a self-contained query and proceeds
through the normal pipeline below, unchanged); "ambiguous" (2+ distinct
active entities — the request is answered directly with a clarifying
question and NEVER reaches _supervisor.route() at all, per this phase's
"ask, don't guess" rule); "independent"/"no_context" (no cue, or a cue
with nothing to resolve against — falls through to the pre-existing
Phase 7/8 mechanisms below unchanged). The user's ORIGINAL message is
still what gets persisted and logged as the user turn (see `message` vs
`effective_message` below) — only the text handed to the routing/
retrieval pipeline changes.
"""

from __future__ import annotations

import logging
import re
import sys
import time
import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.exceptions import BadRequestError
from app.core.settings import settings
from app.models.chat_session import ChatSession
from app.schemas.chat import (
    ChatRequest,
    ChatResponse,
    ChatSourceOut,
    NavigationInfoOut,
    PanoramaInfoOut,
)
from app.session.store import (
    get_last_exchange,
    get_last_location,
    get_or_create_session,
    get_recent_active_entities,
    record_message,
)

logger = logging.getLogger(__name__)

# isort: off
# scripts/ai/ modules use flat sibling imports (e.g. `from supervisor
# import route`), so scripts/ai/ itself — not scripts/ — must be on
# sys.path. See this module's docstring for why this direction of
# integration was chosen.
_SCRIPTS_AI_DIR = Path(__file__).resolve().parents[4] / "scripts" / "ai"
if str(_SCRIPTS_AI_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_AI_DIR))

import supervisor as _supervisor  # noqa: E402
from conversation_context import (  # noqa: E402
    ResolutionResult,
    format_clarification_question,
    resolve_reference,
)
from llm_generator import RESPONSE_LANGUAGE  # noqa: E402

# isort: on

router = APIRouter()

# Development-only diagnostic mode (Task 9 of the RAG audit): a per-request
# trace of intent/agent/tool/retrieval/rerank/confidence/model/latency,
# logged server-side only — never returned in the HTTP response, so normal
# users never see it. Gated on ENVIRONMENT rather than LOG_LEVEL so it can't
# accidentally light up in production just because someone turns log
# verbosity up.
_RAG_DEBUG_ENABLED = settings.ENVIRONMENT == "development"


def warmup() -> None:
    """Eagerly builds the retrieval/rerank singletons (BM25 index over all
    1488 chunks + the SentenceTransformer embedding model + the ChromaDB
    collection handle) once, at process startup — see main.py's lifespan.

    Without this, HybridRetriever/Reranker are true singletons (built once
    and reused — see hybrid_retrieval.get_retriever()/reranker.get_reranker())
    but are built LAZILY, on whichever request first reaches
    agent_base.run_specialist(). Any query that falls through to the RAG
    path — including a navigation_agent query whose tool lookup misses
    (e.g. an unseeded room number) — pays that one-time cold-start cost
    (observed: several seconds to load the embedding model + tokenize/index
    1488 chunks for BM25) inline, inside the request, which routinely
    exceeds the frontend's 10s axios timeout (frontend/src/api/client.ts).
    Calling this during startup moves that cost to server boot, where a
    slow response doesn't strand a user.
    """
    from hybrid_retrieval import get_retriever
    from reranker import get_reranker

    start = time.perf_counter()
    get_retriever()
    get_reranker()
    logger.info("RAG pipeline warmup complete in %.1fs", time.perf_counter() - start)


def _log_rag_debug_trace(message: str, result: dict[str, Any], elapsed_ms: float) -> None:
    if not _RAG_DEBUG_ENABLED:
        return
    top_chunks = [
        {
            "source_url": c.get("source_url"),
            "hybrid_score": c.get("hybrid_score"),
            "rerank_score": c.get("rerank_score"),
        }
        for c in (result.get("retrieved_context") or [])[:5]
    ]
    logger.info(
        "[RAG_DEBUG] question=%r agent=%s reason=%s tool_used=%s status=%s "
        "confidence=%s(%s) model=%s rerank_mode=%s context_chunks=%s/%s top_chunks=%s "
        "latency_ms=%.1f",
        message,
        result.get("selected_agent"),
        result.get("agent_reason"),
        result.get("tool_used"),
        result.get("generation_status"),
        result.get("confidence_score"),
        result.get("confidence_level"),
        result.get("model"),
        result.get("rerank_mode"),
        result.get("context_chunks_used"),
        result.get("context_chunks_considered"),
        top_chunks,
        elapsed_ms,
    )


# Precise "take me there" / "how do I get there" follow-ups — resolved to
# the most recently discussed *location* (Phase 7's original mechanism,
# now backed by app.session.store's persisted history).
_FOLLOWUP_THERE_PATTERN = re.compile(
    r"how (?:do|can) i (?:get|reach) there|take me there|navigate there|"
    r"directions there|how far is (?:it|that)",
    re.IGNORECASE,
)

# Phase 8 addition: broader topic-continuation follow-ups ("which one is
# closest?", "another option?") that name no single substitutable entity —
# resolved by prepending the previous *question* (not the answer) as
# retrieval/prompt context. Deliberately narrow (a fixed indicator-word
# list) and now the FALLBACK tier behind Phase 15's structured
# conversation_context.resolve_reference() below, not the primary
# mechanism — kept as-is (not merged into conversation_context.py's own
# pattern set) because "one/ones/closest/nearest/also/another/instead"
# describe a comparison/alternative, not a substitutable entity reference,
# so a raw-question prepend remains the right strategy for them, same as
# Phase 8 originally found. The old Phase 11 bare-floor-follow-up pattern
# that used to live here is now subsumed by conversation_context.py's own
# broader bare-adjunct pattern (which/what floor/building), so it isn't
# duplicated in this file anymore.
_FOLLOWUP_INDICATOR_PATTERN = re.compile(
    r"\b(it|that|this|those|these|one|ones|closest|nearest|also|another|instead)\b",
    re.IGNORECASE,
)


def _resolve_followup_message(
    message: str, db: Session, session: ChatSession, reference_result: ResolutionResult
) -> str:
    """`reference_result` is computed once by the caller (chat()) via
    conversation_context.resolve_reference() — passed in rather than
    recomputed here so the "ambiguous" branch (handled entirely by the
    caller, before this function is even called — see chat()) and this
    function's own "resolved"/"no_context"/"independent" handling always
    agree on the same classification of `message`."""
    if _FOLLOWUP_THERE_PATTERN.search(message):
        last_location = get_last_location(db, session)
        if last_location:
            logger.info(
                "Resolved follow-up %r -> location %r (session=%s)",
                message,
                last_location,
                session.session_id,
            )
            return f"How do I get to {last_location}?"
        # No resolved location to substitute (e.g. the previous turn was
        # itself an unresolved/ambiguous location) — fall through rather
        # than guess; a plain topic-continuation prepend below may still
        # help, and if not, the message is routed as-is.

    if reference_result.status == "resolved" and reference_result.resolved_query:
        logger.info(
            "Phase 15 context resolution: %r -> %r (entity=%r, session=%s)",
            message,
            reference_result.resolved_query,
            reference_result.entity_used,
            session.session_id,
        )
        return reference_result.resolved_query

    # Reached when: a reference cue was found but no active entity exists
    # to resolve it against (status "no_context" — e.g. "What about the AI
    # course?" after a plain academic RAG answer that resolved no
    # structured entity), OR the older, narrower indicator list above
    # matches a phrasing conversation_context.py doesn't cover ("which one
    # is closest?"). Both fall back to the same Phase 8 strategy: prepend
    # the raw previous question as extra retrieval context.
    if reference_result.status == "no_context" or _FOLLOWUP_INDICATOR_PATTERN.search(message):
        exchange = get_last_exchange(db, session)
        if exchange:
            last_user_message, _last_answer = exchange
            logger.info(
                "Prepending prior question for follow-up context (session=%s)", session.session_id
            )
            return f"{last_user_message} {message}"

    return message


def _extract_location_mentioned(result: dict[str, Any]) -> str | None:
    """Pulls a human-readable location name out of whichever tool result
    shape the routed agent produced, for the session store to remember —
    only ever a name that a real tool actually resolved, never guessed.

    Four real shapes to handle (all from campus_tools.py, Phase 6, unless
    noted):
    - navigation_tool's route_found: {"to_label": "..."}
    - resolve_location's resolved (bare "where is X" lookup):
      {"detail": {"name": "..."}}
    - panorama_lookup's *_found: {"panorama": {"title": "..."}}
    - spatial_knowledge.search_spatial()'s resolved/low_confidence result:
      {"status": "resolved"/"low_confidence", "record": {"name": "..."}}
      (spatial_knowledge.py, Phase 10/11 addition) — only for those two
      statuses, since "ambiguous"/"not_found"/"not_found_confirmed" never
      resolved to one real place worth remembering for a follow-up.
    """
    tool_result = result.get("tool_result")
    if isinstance(tool_result, dict):
        if tool_result.get("to_label"):
            return str(tool_result["to_label"])
        detail = tool_result.get("detail")
        if isinstance(detail, dict) and detail.get("name"):
            return str(detail["name"])
        panorama = tool_result.get("panorama")
        if isinstance(panorama, dict) and panorama.get("title"):
            return str(panorama["title"])
        record = tool_result.get("record")
        if (
            isinstance(record, dict)
            and record.get("name")
            and tool_result.get("status") in ("resolved", "low_confidence")
        ):
            return str(record["name"])
    resolved_location = result.get("resolved_location")
    if isinstance(resolved_location, dict):
        detail = resolved_location.get("detail")
        if isinstance(detail, dict) and detail.get("name"):
            return str(detail["name"])
    return None


def _build_navigation_info(result: dict[str, Any]) -> NavigationInfoOut | None:
    if result.get("tool_used") != "navigation_tool":
        return None
    tool_result = result.get("tool_result")
    if not isinstance(tool_result, dict) or tool_result.get("status") != "route_found":
        return None
    return NavigationInfoOut(
        from_label=tool_result["from_label"],
        to_label=tool_result["to_label"],
        total_distance=tool_result["total_distance"],
        estimated_walk_time_minutes=tool_result["estimated_walk_time_minutes"],
        is_accessible=tool_result["is_accessible"],
        turn_by_turn=list(tool_result["turn_by_turn"]),
    )


def _build_panorama_info(result: dict[str, Any]) -> PanoramaInfoOut | None:
    if result.get("tool_used") != "panorama_lookup":
        return None
    tool_result = result.get("tool_result")
    if not isinstance(tool_result, dict):
        return None
    panorama = tool_result.get("panorama")
    if not isinstance(panorama, dict):
        return None
    return PanoramaInfoOut(
        node_id=panorama["node_id"],
        title=panorama.get("title"),
        image_path=panorama["image_path"],
        distance=tool_result.get("distance"),
    )


def _build_sources(result: dict[str, Any]) -> list[ChatSourceOut]:
    sources = result.get("sources") or []
    return [
        ChatSourceOut(title=s.get("title"), source_url=s.get("source_url"), page=s.get("page"))
        for s in sources
    ]


def _build_clarification_response(clarification: str, session_id: str) -> ChatResponse:
    """Phase 15: the answer for a genuinely ambiguous contextual reference
    (2+ equally plausible active entities) — never a guess. Confidence is
    1.0/HIGH for the same reason navigation_agent.py's own real-entity
    ambiguity responses already use that value: this is a case the system
    is CERTAIN is ambiguous, not an uncertain probabilistic answer, so
    Phase 14's "never artificially inflate confidence" rule isn't in
    tension with it — no retrieval or generation happened to inflate."""
    return ChatResponse(
        answer=clarification,
        status="clarification_needed",
        confidence=1.0,
        confidence_level="HIGH",
        selected_agent="conversation_context",
        tool_used="conversation_context",
        sources=[],
        navigation=None,
        panorama=None,
        session_id=session_id,
    )


@router.post("", response_model=ChatResponse, summary="Ask the GAT AI Campus Assistant")
def chat(payload: ChatRequest, db: Session = Depends(get_db)) -> ChatResponse:
    message = payload.message.strip()
    if not message:
        raise BadRequestError("message must not be empty")

    # Selected UI language, threaded to llm_generator.generate_answer()
    # via a ContextVar (same thread, plain synchronous call chain below —
    # see RESPONSE_LANGUAGE's docstring) so the generated answer is
    # produced in that language. Defaults to English when absent.
    RESPONSE_LANGUAGE.set(payload.language or "en")

    # Session persistence is best-effort: a database problem here degrades
    # to Phase 7's original stateless behavior (a locally-generated,
    # non-persisted session_id) rather than failing the whole request —
    # the user still gets a fully grounded answer either way.
    session: ChatSession | None = None
    try:
        session = get_or_create_session(db, payload.session_id)
    except SQLAlchemyError:
        logger.warning("Session persistence unavailable; continuing statelessly.", exc_info=True)

    session_id = (
        session.session_id if session is not None else (payload.session_id or str(uuid.uuid4()))
    )

    # Phase 15: classify the reference BEFORE anything else. "ambiguous" is
    # handled entirely here — it short-circuits the whole request (never
    # reaches _supervisor.route(), never touches retrieval/generation) —
    # exactly the "ask, don't guess" rule. Every other outcome
    # ("resolved"/"no_context"/"independent") is resolved into a single
    # effective_message string by _resolve_followup_message() below and
    # proceeds through the ordinary pipeline unchanged.
    effective_message = message
    reference_result = ResolutionResult(status="independent")
    if session is not None:
        try:
            active_entities = get_recent_active_entities(db, session)
            reference_result = resolve_reference(message, active_entities)
        except SQLAlchemyError:
            logger.warning("Context lookup failed; treating as independent.", exc_info=True)

    if reference_result.status == "ambiguous":
        clarification = format_clarification_question(reference_result.candidates)
        logger.info(
            "Ambiguous contextual reference %r -> candidates=%s (session=%s)",
            message,
            reference_result.candidates,
            session_id,
        )
        if session is not None:
            try:
                record_message(db, session, role="user", content=message)
                record_message(db, session, role="assistant", content=clarification)
            except SQLAlchemyError:
                logger.warning("Failed to persist this chat turn.", exc_info=True)
        return _build_clarification_response(clarification, session_id)

    if session is not None:
        try:
            effective_message = _resolve_followup_message(message, db, session, reference_result)
        except SQLAlchemyError:
            logger.warning("Follow-up context lookup failed; using the raw message.", exc_info=True)

    logger.info("Chat request (session=%s): %r", session_id, message)
    if effective_message != message:
        logger.info("Effective (resolved) query (session=%s): %r", session_id, effective_message)
    _start = time.perf_counter()
    result = _supervisor.route(effective_message)
    _log_rag_debug_trace(message, result, (time.perf_counter() - _start) * 1000)

    if session is not None:
        try:
            record_message(db, session, role="user", content=message)
            record_message(
                db,
                session,
                role="assistant",
                content=result["answer"] or "",
                resolved_location=_extract_location_mentioned(result),
            )
        except SQLAlchemyError:
            logger.warning("Failed to persist this chat turn.", exc_info=True)

    return ChatResponse(
        answer=result["answer"] or "",
        status=result["generation_status"],
        confidence=result["confidence_score"],
        confidence_level=result["confidence_level"],
        selected_agent=result["selected_agent"],
        tool_used=result.get("tool_used"),
        sources=_build_sources(result),
        navigation=_build_navigation_info(result),
        panorama=_build_panorama_info(result),
        session_id=session_id,
    )
