"""Shared paths, logging, and source-manifest helpers for the GAT knowledge
base acquisition pipeline (scripts/ai/). Operational tooling only — never
imported by the running FastAPI application (see CLAUDE.md's scripts/
convention).
"""

from __future__ import annotations

import json
import logging
import os
import re
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Literal

from dotenv import load_dotenv

# Windows consoles default stdout/stderr to cp1252, which can't encode many
# characters that show up in real scraped content (bullets, curly quotes,
# non-Latin text) — reconfigure to UTF-8 so printing retrieved/report text
# never crashes a pipeline stage over a display encoding issue.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

REPO_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(REPO_ROOT / ".env")

DATA_DIR = REPO_ROOT / "data"
RAW_WEBSITE_DIR = DATA_DIR / "raw" / "website"
RAW_PDFS_DIR = DATA_DIR / "raw" / "pdfs"
PROCESSED_DIR = DATA_DIR / "processed"
METADATA_DIR = DATA_DIR / "metadata"
LOGS_DIR = DATA_DIR / "logs"
MANIFEST_PATH = METADATA_DIR / "source_manifest.json"

# Same resolution backend/app/core/config.py's CHROMA_PERSIST_DIR produces
# when the app is run from the repo root (its default is the relative path
# "./data/chroma_db") — anchored here instead of re-parsed so this always
# matches regardless of the script's own CWD.
CHROMA_PERSIST_DIR = DATA_DIR / "chroma_db"
CHROMA_COLLECTION_NAME = os.environ.get("CHROMA_COLLECTION_NAME", "gat_kb")
EMBEDDING_MODEL_NAME = "all-MiniLM-L6-v2"

# Official GAT domain — the only site the collector is ever allowed to
# request pages from (see Step 7's source-authority policy).
OFFICIAL_DOMAIN = "gat.ac.in"
OFFICIAL_BASE_URL = "https://www.gat.ac.in/"

SourceType = Literal["official_website", "official_pdf"]
SourceStatus = Literal["collected", "cleaned", "chunked", "embedded", "failed"]


def now_iso() -> str:
    return datetime.now(UTC).isoformat()


def slugify(value: str) -> str:
    """Filesystem-safe stem for a URL or title — deterministic, so re-running
    the collector overwrites the same raw file instead of accumulating
    duplicates."""
    value = value.strip().lower()
    value = re.sub(r"^https?://", "", value)
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")[:120] or "untitled"


def configure_logging(name: str) -> logging.Logger:
    """One logger per pipeline stage, writing to both console and
    data/logs/<name>.log — every collection/processing run is traceable
    after the fact (Step 12's failure counts read from these)."""
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)
    if logger.handlers:
        return logger  # already configured (e.g. re-imported in the same run)

    formatter = logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s")

    file_handler = logging.FileHandler(LOGS_DIR / f"{name}.log", encoding="utf-8")
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    return logger


def load_manifest() -> dict[str, Any]:
    if not MANIFEST_PATH.exists():
        return {"generated_at": now_iso(), "sources": {}}
    return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))


def save_manifest(manifest: dict[str, Any]) -> None:
    METADATA_DIR.mkdir(parents=True, exist_ok=True)
    manifest["generated_at"] = now_iso()
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")


def upsert_manifest_entry(
    *,
    source_url: str,
    title: str,
    source_type: SourceType,
    status: SourceStatus,
    chunk_count: int | None = None,
    error: str | None = None,
) -> None:
    """Records or updates one source's entry — called from every pipeline
    stage so the manifest always reflects the latest known state of each
    URL/document (collected -> cleaned -> chunked -> embedded, or failed at
    any point). This is the "proof of where the AI knowledge came from"
    artifact (Step 7)."""
    manifest = load_manifest()
    entry = manifest["sources"].setdefault(
        source_url,
        {
            "source_url": source_url,
            "title": title,
            "source_type": source_type,
            "collection_date": now_iso(),
            "status": status,
            "chunk_count": 0,
            "errors": [],
        },
    )
    entry["title"] = title or entry["title"]
    entry["status"] = status
    if chunk_count is not None:
        entry["chunk_count"] = chunk_count
    if error:
        entry["errors"].append({"timestamp": now_iso(), "message": error})
    save_manifest(manifest)
