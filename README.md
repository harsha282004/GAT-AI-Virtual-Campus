# AI Agent-Based Indoor Virtual Campus Tour and Query Assistant

A virtual campus tour and RAG-based query assistant for Global Academy of Technology (GAT), Bangalore.

See [`docs/architecture.md`](docs/architecture.md) for the full approved architecture, and [`GAT_Virtual_Tour_Build_Guide.md`](GAT_Virtual_Tour_Build_Guide.md) / [`CLAUDE.md`](CLAUDE.md) for the phased build plan this project follows.

## How to Run the Project Manually (Windows / PowerShell)

The app is **four services**: PostgreSQL, Ollama, the FastAPI backend, and the Next.js
frontend. Running only `npm run dev` starts **just the frontend** — the tour, the AI
Assistant and every `/api` call then fail because the backend is not up. Use the
startup script instead; it starts everything and health-checks it.

### Prerequisites (one time)

| Need | Check / install |
|---|---|
| Python venv with deps | `python -m venv venv` ; `.\venv\Scripts\Activate.ps1` ; `pip install -r requirements.txt` |
| Node modules | `cd frontend` ; `npm install` |
| `.env` at repo root | `copy .env.example .env` then fill in `POSTGRES_PASSWORD` / `DATABASE_URL` / `SECRET_KEY` |
| `frontend\.env.local` | `copy frontend\.env.local.example frontend\.env.local` (keeps `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api/v1`) |
| PostgreSQL running | Windows service `postgresql-x64-18` (the script starts it if stopped) |
| Ollama + model | `ollama pull llama3.2` (only the AI Assistant needs this; the tour does not) |

### Start everything

```powershell
# from the repo root
npm run start:dev
#   └─ equivalent to: powershell -ExecutionPolicy Bypass -File scripts\start-project.ps1
```

This verifies PostgreSQL + Ollama, then opens **two new PowerShell windows** —
`GAT backend :8000` and `GAT frontend :3001` — and does not print success until
`/health`, the frontend, the Virtual Tour API and CORS all pass.

Variants: `npm run start:dev:no-ollama` (skip the LLM), `npm run start:backend`,
`npm run start:frontend`.

### Expected ports & URLs

| Service | URL / port |
|---|---|
| Frontend (Next.js) | http://localhost:3001 |
| Backend (FastAPI) | http://127.0.0.1:8000  (API docs: http://127.0.0.1:8000/docs) |
| Virtual Tour | http://localhost:3001/tour |
| AI Assistant | http://localhost:3001/chat |
| PostgreSQL | 127.0.0.1:5432 |
| Ollama | http://localhost:11434 (model `llama3.2`) |

### Verify the backend is healthy

```powershell
curl.exe http://127.0.0.1:8000/health
# -> {"status":"ok"}
curl.exe "http://127.0.0.1:8000/api/v1/tour/scenes?building_id=6"
# -> JSON array of 156 Main Building scenes
```

### Stop the GAT services

```powershell
npm run stop:dev
#   └─ powershell -ExecutionPolicy Bypass -File scripts\stop-project.ps1
# ...or just close the "GAT backend :8000" and "GAT frontend :3001" windows.
```

`stop:dev` leaves PostgreSQL and Ollama running (they are shared services).

> **Port 3000 belongs to a separate project (ORCA).** The GAT frontend is pinned to
> **3001** and the backend to **127.0.0.1:8000** so the two never collide. Neither
> `start-project.ps1` nor `stop-project.ps1` ever inspects, starts, or kills anything
> on port 3000.

## Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | Next.js 15, React, TypeScript, Tailwind CSS, App Router |
| Backend | FastAPI, SQLAlchemy, Alembic, PostgreSQL, Pydantic |
| AI | LangChain, ChromaDB, Ollama, Meta Llama 3.2 (local) |
| Other | Docker, Git, Python virtual environment |

## Folder Structure

```
.
├── frontend/       Next.js 15 application (App Router, TypeScript, Tailwind)
├── backend/        FastAPI application (SQLAlchemy models, Alembic config, LangChain/RAG modules)
├── database/       Alembic migrations, seed scripts, Postgres init scripts
├── docs/           Architecture and design documentation
├── assets/         Shared static assets not tied to the frontend build (images, icons, diagrams)
├── tests/          Backend, frontend, and end-to-end test suites
├── scripts/        Operational/dev scripts (setup, db, ai) — placeholders for now
├── .github/        CI workflow placeholders
└── .vscode/        Editor settings shared across the team
```

## Getting Started (once code lands)

### 1. Backend — Python environment

```bash
python -m venv venv
source venv/bin/activate        # venv\Scripts\activate on Windows
pip install -r requirements.txt
```

### 2. Environment variables

```bash
cp .env.example .env
```

Fill in the values. Note: Next.js only reads env files from its own project root, so for local (non-Docker) frontend development, copy the `NEXT_PUBLIC_*` values from `.env.example` into `frontend/.env.local` as well.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

### 4. Database

```bash
cd backend
alembic upgrade head
```

### 5. Ollama (local LLM)

```bash
ollama pull llama3.2
```

### 6. Full stack via Docker

```bash
docker-compose up --build
```

This starts the frontend, backend, PostgreSQL, and Ollama containers.

## Project Status

This is a phased build (see the build guide). Current status: **architecture approved, skeleton scaffolded, no phase implementation started.**
