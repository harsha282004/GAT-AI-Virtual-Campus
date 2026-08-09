"""Steps 8-9 — Embed every chunk with all-MiniLM-L6-v2 and persist to
ChromaDB.

Reads data/processed/chunks.jsonl (written by clean_and_chunk.py), embeds
each chunk's text locally via sentence-transformers, and upserts into a
PERSISTENT ChromaDB collection (chromadb.PersistentClient — survives
backend/app restarts, never an in-memory-only client). Chunk IDs are
deterministic (from clean_and_chunk.py), so re-running this script updates
existing records instead of duplicating them.

Usage: python scripts/ai/build_embeddings.py
"""

from __future__ import annotations

import json

import chromadb
from sentence_transformers import SentenceTransformer

from _shared import (
    CHROMA_COLLECTION_NAME,
    CHROMA_PERSIST_DIR,
    EMBEDDING_MODEL_NAME,
    PROCESSED_DIR,
    configure_logging,
    upsert_manifest_entry,
)

logger = configure_logging("build_embeddings")

BATCH_SIZE = 64


def load_chunks() -> list[dict]:
    chunks_path = PROCESSED_DIR / "chunks.jsonl"
    if not chunks_path.exists():
        logger.error("%s not found — run scripts/ai/clean_and_chunk.py first.", chunks_path)
        return []
    chunks = []
    with chunks_path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                chunks.append(json.loads(line))
    return chunks


def build_embeddings() -> int:
    chunks = load_chunks()
    if not chunks:
        return 0

    logger.info("Loading embedding model %s ...", EMBEDDING_MODEL_NAME)
    model = SentenceTransformer(EMBEDDING_MODEL_NAME)

    CHROMA_PERSIST_DIR.mkdir(parents=True, exist_ok=True)
    client = chromadb.PersistentClient(path=str(CHROMA_PERSIST_DIR))
    collection = client.get_or_create_collection(
        name=CHROMA_COLLECTION_NAME,
        metadata={"embedding_model": EMBEDDING_MODEL_NAME, "hnsw:space": "cosine"},
    )

    sources_seen: dict[str, tuple[str, int]] = {}  # url -> (source_type, chunk_count)
    total_embedded = 0

    for start in range(0, len(chunks), BATCH_SIZE):
        batch = chunks[start : start + BATCH_SIZE]
        texts = [c["text"] for c in batch]
        embeddings = model.encode(texts, show_progress_bar=False, normalize_embeddings=True)

        ids = [c["chunk_id"] for c in batch]
        metadatas = []
        for c in batch:
            metadatas.append(
                {
                    "source_url": c["source_url"],
                    "source_title": c["source_title"] or "",
                    "source_type": c["source_type"],
                    "section": c["section"] or "",
                    "page": c["page"] if c["page"] is not None else -1,
                    "document_name": c["document_name"] or "",
                    "department": c["department"] or "",
                    "collection_date": c["collection_date"],
                    "knowledge_category": c["knowledge_category"],
                }
            )
            prev_count = sources_seen.get(c["source_url"], (c["source_type"], 0))[1]
            sources_seen[c["source_url"]] = (c["source_type"], prev_count + 1)

        collection.upsert(
            ids=ids,
            embeddings=[e.tolist() for e in embeddings],
            documents=texts,
            metadatas=metadatas,
        )
        total_embedded += len(batch)
        logger.info("Embedded %d/%d chunks", total_embedded, len(chunks))

    for source_url, (source_type, count) in sources_seen.items():
        upsert_manifest_entry(
            source_url=source_url,
            title=source_url,
            source_type=source_type,
            status="embedded",
            chunk_count=count,
        )

    logger.info(
        "ChromaDB collection '%s' now has %d total records at %s",
        CHROMA_COLLECTION_NAME,
        collection.count(),
        CHROMA_PERSIST_DIR,
    )
    return total_embedded


if __name__ == "__main__":
    n = build_embeddings()
    logger.info("Embedding complete: %d chunks embedded", n)
