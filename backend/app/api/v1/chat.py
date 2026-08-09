"""Phase 7 — POST /api/v1/chat.

Connects the completed Phase 1-6 AI pipeline (scripts/ai/) to the running
FastAPI application. Calls supervisor.route() — the same Supervisor
Phase 5/6 already built and tested — and never bypasses it: this router is
the application/API boundary, not a second AI router (per Phase 7's
explicit instruction).

INTEGRATION APPROACH — read before assuming otherwise:
CLAUDE.md's folder conventions describe scripts/ as "operational scripts
only... never imported by the running application." That convention was
written for one-off setup/build/seed scripts, and the actual code has
already evolved past it: scripts/ai/ became a fully-built, tested
retrieval + reranking + confidence + LLM generation + multi-agent + tool
pipeline across Phases 1-6, all deliberately kept out of backend/app/ so
each phase stayed independently runnable and testable via plain `python
scripts/ai/test_*.py`. Phase 7 explicitly requires connecting that
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
to async/await is exactly the "duplicate implementation" scope this phase
avoids. Declaring this route as a plain `def` (not `async def`) is the
correct FastAPI-idiomatic answer: Starlette runs sync route handlers in a
thread pool automatically, so a slow request never blocks the event loop.
This also matches the ACTUAL existing convention in this codebase —
backend/app/api/v1/navigation.py's handlers are sync `def` too, despite
CLAUDE.md's aspirational "all I/O is async" note; the real code, not the
aspiration, is what's actually running everywhere else in this API.
"""

from __future__ import annotations

import logging
import re
import sys
import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter

from app.core.exceptions import BadRequestError
from app.schemas.chat import (
    ChatRequest,
    ChatResponse,
    ChatSourceOut,
    NavigationInfoOut,
    PanoramaInfoOut,
)
from app.session.store import get_last_location, record_turn

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

# Simple "take me there" / "how do I get there" style follow-ups — resolved
# to the most recently discussed location for this session_id (Step 6).
# Anything more elaborate (pronoun resolution, multi-turn topic tracking)
# is out of scope for this lightweight mechanism — see
# backend/app/session/store.py's docstring.
_FOLLOWUP_THERE_PATTERN = re.compile(
    r"how (?:do|can) i (?:get|reach) there|take me there|navigate there|"
    r"directions there|how far is (?:it|that)",
    re.IGNORECASE,
)


def _resolve_followup_message(message: str, session_id: str | None) -> str:
    if not session_id or not _FOLLOWUP_THERE_PATTERN.search(message):
        return message
    last_location = get_last_location(session_id)
    if not last_location:
        return message
    logger.info(
        "Resolved follow-up %r -> location %r (session=%s)", message, last_location, session_id
    )
    return f"How do I get to {last_location}?"


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
def chat(payload: ChatRequest) -> ChatResponse:
    message = payload.message.strip()
    if not message:
        raise BadRequestError("message must not be empty")

    # A session_id is always returned, generated here if the caller didn't
    # send one, so a client can opt into follow-up support just by
    # replaying whatever session_id the previous response included.
    session_id = payload.session_id or str(uuid.uuid4())
    effective_message = _resolve_followup_message(message, payload.session_id)

    logger.info("Chat request (session=%s): %r", session_id, message)
    result = _supervisor.route(effective_message)

    record_turn(session_id, message, _extract_location_mentioned(result))

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
