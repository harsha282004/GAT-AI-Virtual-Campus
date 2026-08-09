"""Phase 6 — Standalone backend DB access for scripts/ai/ tool adapters.

Mirrors the exact, already-proven pattern from scripts/db/seed.py: insert
backend/ onto sys.path, then import app.db.session.SessionLocal directly.
No FastAPI app, no Depends(get_db) — SessionLocal has no dependency on the
running server, it's a plain SQLAlchemy sessionmaker.

This is the only file in scripts/ai/ that touches sys.path / imports
backend.app.* — every tool in campus_tools.py goes through get_db_session()
here rather than repeating the setup.
"""

from __future__ import annotations

import sys
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

_BACKEND_DIR = Path(__file__).resolve().parents[2] / "backend"
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

from app.db.session import SessionLocal  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402


@contextmanager
def get_db_session() -> Iterator[Session]:
    """Short-lived session per tool call — opened, used, closed. Matches
    seed.py's `db = SessionLocal(); ...; db.close()` pattern via a context
    manager so every tool function gets try/finally cleanup for free."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
