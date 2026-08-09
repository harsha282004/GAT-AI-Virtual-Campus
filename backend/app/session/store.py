"""Phase 7 — Lightweight in-process conversation memory.

NOT the eventual PostgreSQL-backed session design CLAUDE.md's architecture
notes describe ("Session/conversation state, when implemented, lives in
PostgreSQL... an open design point to resolve"). A real implementation of
that needs a schema, a migration, and CRUD — out of scope for wiring up
the chat endpoint in this phase. This is a deliberately minimal,
explicitly-documented stand-in:

- An in-process dict, scoped to this server process's lifetime. Nothing is
  persisted to disk; a restart clears every session.
- Stores only the last few turns per session_id, and only enough to
  resolve simple follow-up references ("how do I get there?") to the
  location most recently discussed in that session — not a general
  conversation-history/context-window mechanism.
- Not safe for multi-process/multi-worker deployment (each worker would
  have its own independent memory) — fine for a single-process dev/demo
  server, a real limitation for production, documented in
  docs/RAG_ARCHITECTURE.md's Phase 7 section.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field

MAX_TURNS_PER_SESSION = 5
SESSION_TTL_SECONDS = 30 * 60


@dataclass
class Turn:
    query: str
    resolved_location: str | None
    timestamp: float = field(default_factory=time.time)


_sessions: dict[str, list[Turn]] = {}


def record_turn(session_id: str, query: str, resolved_location: str | None) -> None:
    turns = _sessions.setdefault(session_id, [])
    turns.append(Turn(query=query, resolved_location=resolved_location))
    del turns[:-MAX_TURNS_PER_SESSION]


def get_last_location(session_id: str) -> str | None:
    """Most recent non-expired, non-empty resolved_location in this
    session, scanning newest-first — the "the place we were just talking
    about" for a follow-up query."""
    turns = _sessions.get(session_id, [])
    now = time.time()
    for turn in reversed(turns):
        if now - turn.timestamp > SESSION_TTL_SECONDS:
            break
        if turn.resolved_location:
            return turn.resolved_location
    return None
