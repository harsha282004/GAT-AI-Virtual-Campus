"""Phase 8 — PostgreSQL-backed conversation memory.

Replaces Phase 7's in-process dict (lost on restart, not shared across
workers) with real persistence via the existing SQLAlchemy/PostgreSQL
infrastructure (`app.models.chat_session.ChatSession`/`ChatMessageRecord`,
the same `Session` object every other router already uses via
`Depends(get_db)`). A conversation now survives a backend restart, and
multiple server processes would all see the same session state (the one
real production gap Phase 7 explicitly flagged as unresolved).

Still intentionally NOT a general conversation-memory/context-window
system: it stores messages and exposes two narrow, explainable helpers
(`get_last_location` for "how do I get there?"-style follow-ups,
`get_last_exchange` for topic-continuation follow-ups like "which one is
closest?") — the same scope Phase 7 had, just durable now. No
authentication/user concept is attached, per Phase 8's explicit
instruction not to add one.
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
