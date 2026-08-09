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
backend/app/api/v1/navigation.py's handlers are sync `def` too.

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
"""

from __future__ import annotations

import logging
import re
import sys
import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.exceptions import BadRequestError
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

# isort: on

router = APIRouter()

# Precise "take me there" / "how do I get there" follow-ups — resolved to
# the most recently discussed *location* (Phase 7's original mechanism,
# now backed by app.session.store's persisted history).
_FOLLOWUP_THERE_PATTERN = re.compile(
    r"how (?:do|can) i (?:get|reach) there|take me there|navigate there|"
    r"directions there|how far is (?:it|that)",
    re.IGNORECASE,
)

# Phase 8 addition: broader topic-continuation follow-ups ("which one is
# closest?", "what about that one?") — resolved by prepending the previous
# *question* (not the answer) as retrieval/prompt context, rather than
# trying to substitute a single entity name the way the pattern above
# does. Deliberately narrow (a fixed indicator-word list), not general
# pronoun resolution — see backend/app/session/store.py's docstring for
# why that scope was chosen.
_FOLLOWUP_INDICATOR_PATTERN = re.compile(
    r"\b(it|that|this|those|these|one|ones|closest|nearest|also|another|instead)\b",
    re.IGNORECASE,
)


def _resolve_followup_message(message: str, db: Session, session: ChatSession) -> str:
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

    if _FOLLOWUP_INDICATOR_PATTERN.search(message):
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

    Three real shapes to handle, all from campus_tools.py (Phase 6):
    - navigation_tool's route_found: {"to_label": "..."}
    - resolve_location's resolved (bare "where is X" lookup): {"detail": {"name": "..."}}
    - panorama_lookup's *_found: {"panorama": {"title": "..."}}
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


@router.post("", response_model=ChatResponse, summary="Ask the GAT AI Campus Assistant")
def chat(payload: ChatRequest, db: Session = Depends(get_db)) -> ChatResponse:
    message = payload.message.strip()
    if not message:
        raise BadRequestError("message must not be empty")

    # Session persistence is best-effort: a database problem here degrades
    # to Phase 7's original stateless behavior (a locally-generated,
    # non-persisted session_id) rather than failing the whole request —
    # the user still gets a fully grounded answer either way.
    session: ChatSession | None = None
    try:
        session = get_or_create_session(db, payload.session_id)
    except SQLAlchemyError:
        logger.warning("Session persistence unavailable; continuing statelessly.", exc_info=True)

    effective_message = message
    if session is not None:
        try:
            effective_message = _resolve_followup_message(message, db, session)
        except SQLAlchemyError:
            logger.warning("Follow-up context lookup failed; using the raw message.", exc_info=True)

    session_id = (
        session.session_id if session is not None else (payload.session_id or str(uuid.uuid4()))
    )
    logger.info("Chat request (session=%s): %r", session_id, message)
    result = _supervisor.route(effective_message)

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
