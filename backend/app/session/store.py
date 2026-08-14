"""Phase 8 — PostgreSQL-backed conversation memory.

Replaces Phase 7's in-process dict (lost on restart, not shared across
workers) with real persistence via the existing SQLAlchemy/PostgreSQL
infrastructure (`app.models.chat_session.ChatSession`/`ChatMessageRecord`,
the same `Session` object every other router already uses via
`Depends(get_db)`). A conversation now survives a backend restart, and
multiple server processes would all see the same session state (the one
real production gap Phase 7 explicitly flagged as unresolved).

Still intentionally NOT a general conversation-memory/context-window
system: it stores messages and exposes narrow, explainable helpers
(`get_last_location` for "how do I get there?"-style follow-ups,
`get_last_exchange` for topic-continuation follow-ups like "which one is
closest?") — the same scope Phase 7 had, just durable now. No
authentication/user concept is attached, per Phase 8's explicit
instruction not to add one.

PHASE 15 ADDITION — `get_recent_active_entities` reads the SAME
`resolved_location` column `get_last_location` already reads, just
returning up to a small bounded number of recent DISTINCT values instead
of only the single latest one. No schema change: `resolved_location`
already generalizes past pure "location" (facilities_agent's supplementary
DB lookup and navigation_agent's spatial/tool paths both populate it for
non-navigation queries too — see backend/app/api/v1/chat.py's
`_extract_location_mentioned()`), so the existing column already carries
what Phase 15's conversational-entity tracking needs.
"""

from __future__ import annotations

import time
import uuid

from sqlalchemy.orm import Session

from app.models.chat_session import ChatMessageRecord, ChatSession

# Bounded history: a session's stored messages are trimmed to this many
# rows (most recent kept) every time a new message is recorded, so a
# long-running conversation cannot grow the table without limit.
MAX_MESSAGES_PER_SESSION = 20

# How far back a resolved location / previous exchange is still considered
# relevant for a follow-up question — an old, cold session shouldn't have
# its stale context silently reused.
CONTEXT_TTL_SECONDS = 30 * 60


def get_or_create_session(db: Session, session_id: str | None) -> ChatSession:
    """Reuses an existing session if `session_id` was supplied and is
    found; otherwise creates a new one — using the supplied id if given
    (so a client-supplied but not-yet-known session_id is honored rather
    than rejected, per "handle invalid/nonexistent session IDs safely"),
    or a fresh UUID if none was supplied at all."""
    if session_id:
        existing = db.query(ChatSession).filter(ChatSession.session_id == session_id).first()
        if existing is not None:
            return existing
        new_session = ChatSession(session_id=session_id)
    else:
        new_session = ChatSession(session_id=str(uuid.uuid4()))

    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    return new_session


def record_message(
    db: Session,
    session: ChatSession,
    *,
    role: str,
    content: str,
    resolved_location: str | None = None,
) -> ChatMessageRecord:
    message = ChatMessageRecord(
        session_id=session.id, role=role, content=content, resolved_location=resolved_location
    )
    db.add(message)
    db.commit()
    _trim_history(db, session)
    return message


def _trim_history(db: Session, session: ChatSession) -> None:
    """Deletes the oldest rows beyond MAX_MESSAGES_PER_SESSION for this
    session — bounds the table's growth per-session regardless of how long
    a single conversation runs."""
    count = db.query(ChatMessageRecord).filter(ChatMessageRecord.session_id == session.id).count()
    excess = count - MAX_MESSAGES_PER_SESSION
    if excess <= 0:
        return
    oldest_ids = [
        row.id
        for row in db.query(ChatMessageRecord.id)
        .filter(ChatMessageRecord.session_id == session.id)
        .order_by(ChatMessageRecord.id.asc())
        .limit(excess)
        .all()
    ]
    db.query(ChatMessageRecord).filter(ChatMessageRecord.id.in_(oldest_ids)).delete(
        synchronize_session=False
    )
    db.commit()


def _recent_messages(db: Session, session: ChatSession, limit: int) -> list[ChatMessageRecord]:
    rows = (
        db.query(ChatMessageRecord)
        .filter(ChatMessageRecord.session_id == session.id)
        .order_by(ChatMessageRecord.id.desc())
        .limit(limit)
        .all()
    )
    return list(reversed(rows))


def _is_fresh(message: ChatMessageRecord) -> bool:
    age_seconds = time.time() - message.created_at.timestamp()
    return age_seconds <= CONTEXT_TTL_SECONDS


def get_last_location(db: Session, session: ChatSession) -> str | None:
    """Most recent non-expired, non-empty resolved_location from an
    assistant turn in this session — the "the place we were just talking
    about" for a "how do I get there?" style follow-up."""
    for message in reversed(_recent_messages(db, session, MAX_MESSAGES_PER_SESSION)):
        if not _is_fresh(message):
            break
        if message.role == "assistant" and message.resolved_location:
            return message.resolved_location
    return None


# Phase 15: how many recent DISTINCT entities count as "still active" for
# conversational-reference resolution. Deliberately small and bounded (see
# CONTEXT_TTL_SECONDS above for the time dimension of the same "controlled
# context window" requirement) — 2 is enough to both resolve the common
# single-entity case AND detect the simplest real ambiguity (two distinct
# entities recently discussed, e.g. "Where is the CSE department?" then
# "Where is the library?" then a bare "Where is it?"); a third, older,
# distinct entity is unlikely to still be the intended referent and is
# deliberately excluded rather than added as a third guess.
MAX_ACTIVE_ENTITIES = 2


def get_recent_active_entities(
    db: Session, session: ChatSession, max_distinct: int = MAX_ACTIVE_ENTITIES
) -> list[str]:
    """Up to `max_distinct` most-recent DISTINCT resolved_location values
    from assistant turns in this session, most-recent-first, honoring the
    same freshness/TTL rule as get_last_location() above — reuses the
    exact same column Phase 6/8 already populate, no new schema. This is
    the candidate list scripts/ai/conversation_context.resolve_reference()
    disambiguates a follow-up reference against: exactly 1 distinct
    candidate resolves unambiguously, 2+ requires asking the user rather
    than guessing (Phase 15's core behavioral rule), 0 means there is
    nothing to resolve against at all."""
    entities: list[str] = []
    for message in reversed(_recent_messages(db, session, MAX_MESSAGES_PER_SESSION)):
        if not _is_fresh(message):
            break
        if message.role == "assistant" and message.resolved_location:
            if message.resolved_location not in entities:
                entities.append(message.resolved_location)
            if len(entities) >= max_distinct:
                break
    return entities


def get_last_exchange(db: Session, session: ChatSession) -> tuple[str, str] | None:
    """Most recent (user_message, assistant_answer) pair, for topic-
    continuation follow-ups ("which one is closest?"). None if there is no
    prior exchange, or the most recent one has aged out of relevance."""
    recent = _recent_messages(db, session, MAX_MESSAGES_PER_SESSION)
    last_assistant = next((m for m in reversed(recent) if m.role == "assistant"), None)
    if last_assistant is None or not _is_fresh(last_assistant):
        return None
    last_user = next(
        (m for m in reversed(recent) if m.role == "user" and m.id < last_assistant.id), None
    )
    if last_user is None:
        return None
    return last_user.content, last_assistant.content
