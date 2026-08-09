"""Convenience orchestrator — runs the full Phase 1 knowledge-base pipeline
in order: website collection -> PDF collection -> cleaning/chunking ->
embedding. Each stage is also independently runnable (see the other
scripts/ai/*.py files) for debugging a single stage.

Usage: python scripts/ai/run_pipeline.py
"""

from __future__ import annotations

from _shared import configure_logging

logger = configure_logging("run_pipeline")


def main() -> None:
    from build_embeddings import build_embeddings
    from clean_and_chunk import process
    from collect_pdfs import collect_pdfs
    from collect_website import crawl

    logger.info("=== Stage 1/4: website collection ===")
    website_result = crawl()
    logger.info(
        "Website: %d collected, %d failed", website_result.pages_collected, website_result.pages_failed
    )

    logger.info("=== Stage 2/4: PDF collection ===")
    pdf_result = collect_pdfs()
    logger.info("PDFs: %d collected, %d failed", pdf_result.collected, pdf_result.failed)

    logger.info("=== Stage 3/4: cleaning + chunking ===")
    chunk_result = process()
    logger.info(
        "Chunks: %d written, %d duplicates removed, %d failed",
        chunk_result.chunks_written,
        chunk_result.duplicates_removed,
        chunk_result.failed,
    )

    logger.info("=== Stage 4/4: embeddings + ChromaDB ===")
    embedded = build_embeddings()
    logger.info("Embedded %d chunks", embedded)

    logger.info("Pipeline complete. Run scripts/ai/test_retrieval.py to verify retrieval.")


if __name__ == "__main__":
    main()
