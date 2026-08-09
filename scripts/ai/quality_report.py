"""Step 12 — Data quality verification report.

Reads the source manifest, processed chunks, and the live ChromaDB
collection to print the counts required to prove pipeline correctness and
that every chunk is traceable to a source.

Usage: python scripts/ai/quality_report.py
"""

from __future__ import annotations

import json

import chromadb

from _shared import (
    CHROMA_COLLECTION_NAME,
    CHROMA_PERSIST_DIR,
    PROCESSED_DIR,
    configure_logging,
    load_manifest,
)

logger = configure_logging("quality_report")


def generate_report() -> dict:
    manifest = load_manifest()
    sources = manifest.get("sources", {})

    website_sources = [s for s in sources.values() if s["source_type"] == "official_website"]
    pdf_sources = [s for s in sources.values() if s["source_type"] == "official_pdf"]

    pages_collected = sum(1 for s in website_sources if s["status"] != "failed")
    pages_failed = sum(1 for s in website_sources if s["status"] == "failed")
    pdfs_collected = sum(1 for s in pdf_sources if s["status"] != "failed")
    pdfs_failed = sum(1 for s in pdf_sources if s["status"] == "failed")

    cleaned_documents = sum(
        1 for s in sources.values() if s["status"] in ("chunked", "embedded")
    )

    chunks_path = PROCESSED_DIR / "chunks.jsonl"
    chunks = []
    if chunks_path.exists():
        with chunks_path.open(encoding="utf-8") as f:
            chunks = [json.loads(line) for line in f if line.strip()]

    untraceable = [c for c in chunks if not c.get("source_url")]

    try:
        client = chromadb.PersistentClient(path=str(CHROMA_PERSIST_DIR))
        collection = client.get_collection(CHROMA_COLLECTION_NAME)
        chroma_records = collection.count()
        chroma_persistent = True
    except Exception:
        chroma_records = 0
        chroma_persistent = False

    # Distinct sources with at least one logged error — not a raw count of
    # log entries, since re-running a stage during development appends
    # rather than replaces (a source failing the same way across 3 dev
    # iterations would otherwise inflate this to 3x its real value).
    total_failed_processing = sum(1 for s in sources.values() if s.get("errors"))

    report = {
        "website_pages_collected": pages_collected,
        "website_pages_failed": pages_failed,
        "pdfs_collected": pdfs_collected,
        "pdfs_failed": pdfs_failed,
        "cleaned_documents": cleaned_documents,
        "chunks_total": len(chunks),
        "chunks_untraceable": len(untraceable),
        "chromadb_records": chroma_records,
        "chromadb_persistent_client": chroma_persistent,
        "distinct_failed_sources": total_failed_processing,
    }

    print(json.dumps(report, indent=2))
    return report


if __name__ == "__main__":
    generate_report()
