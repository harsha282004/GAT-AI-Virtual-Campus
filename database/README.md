# Database

This folder holds everything Alembic needs to run migrations, plus operational SQL — kept separate from `backend/app/db/`, which holds the SQLAlchemy engine/session objects the running FastAPI app actually uses.

- `migrations/` — Alembic environment (`env.py`, `script.py.mako`) and generated migration scripts (`versions/`). Referenced by `backend/alembic.ini` via `script_location = ../database/migrations`.
- `seeds/` — future data-seeding scripts (not implemented yet).
- `init/` — SQL mounted into the PostgreSQL container's `/docker-entrypoint-initdb.d` on first run (extensions, roles, etc. — not implemented yet).
