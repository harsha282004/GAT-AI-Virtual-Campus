# Database

This folder holds everything Alembic needs to run migrations, plus operational SQL — kept separate from `backend/app/db/`, which holds the SQLAlchemy engine/session objects the running FastAPI app actually uses.

- `migrations/` — Alembic environment (`env.py`, `script.py.mako`) and generated migration scripts (`versions/`). Referenced by the repo-root `alembic.ini` via `script_location = database/migrations` (kept at the repo root, not `backend/`, so this stays a plain child path — a `backend/../database/migrations`-style relative path breaks Alembic's Mako template lookup on Windows).
- `seeds/` — future data-seeding scripts (not implemented yet).
- `init/` — SQL mounted into the PostgreSQL container's `/docker-entrypoint-initdb.d` on first run (extensions, roles, etc. — not implemented yet).
