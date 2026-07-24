# AI Agent-Based Indoor Virtual Campus Tour and Query Assistant

A virtual campus tour and RAG-based query assistant for Global Academy of Technology (GAT), Bangalore. This repository is currently a **project skeleton** — folder structure and tooling configuration only. No business logic, APIs, models, pages, or AI pipelines have been implemented yet.

See [`docs/architecture.md`](docs/architecture.md) for the full approved architecture, and [`GAT_Virtual_Tour_Build_Guide.md`](GAT_Virtual_Tour_Build_Guide.md) / [`CLAUDE.md`](CLAUDE.md) for the phased build plan this project follows.

## Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | Next.js 15, React, TypeScript, Tailwind CSS, App Router |
| Backend | FastAPI, SQLAlchemy, Alembic, PostgreSQL, Pydantic |
| AI | LangChain, ChromaDB, Ollama, Llama 3 |
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
ollama pull llama3
```

### 6. Full stack via Docker

```bash
docker-compose up --build
```

This starts the frontend, backend, PostgreSQL, and Ollama containers.

## Project Status

This is a phased build (see the build guide). Current status: **architecture approved, skeleton scaffolded, no phase implementation started.**
