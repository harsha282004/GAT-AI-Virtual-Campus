"""Steps 5-6 — Clean collected raw data and split it into metadata-tagged
chunks ready for embedding.

Website pages: strips nav/header/footer/script/style/cookie-banner
boilerplate via BeautifulSoup, keeps heading/list/table text, tracks the
nearest preceding heading as each chunk's "section".

PDFs: strips lines that repeat across most pages of the same document
(running headers/footers), chunks per page so `page` metadata stays exact.

Every chunk is deduplicated by normalized text (first occurrence wins) and
carries full source metadata plus knowledge_category="official_institutional"
(Step 10 — never mixed with future spatial/navigation data).

Usage: python scripts/ai/clean_and_chunk.py
"""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass, field
from pathlib import Path

from bs4 import BeautifulSoup
from langchain_text_splitters import RecursiveCharacterTextSplitter

from _shared import (
    PROCESSED_DIR,
    RAW_PDFS_DIR,
    RAW_WEBSITE_DIR,
    configure_logging,
    now_iso,
    upsert_manifest_entry,
)

logger = configure_logging("clean_and_chunk")

CHUNK_SIZE = 800
CHUNK_OVERLAP = 120
MIN_CONTENT_CHARS = 50  # shorter than this reads as empty/boilerplate-only

# Tags/classes that are never real page content, wherever they appear.
BOILERPLATE_TAGS = ("nav", "header", "footer", "script", "style", "noscript", "form", "iframe")
BOILERPLATE_CLASS_HINTS = (
    "nav", "menu", "footer", "header", "cookie", "breadcrumb", "sidebar", "social", "search-box",
)

DEPARTMENT_URL_HINTS = {
    "computer-science-engineering": "Computer Science & Engineering",
    "information-science-engineering": "Information Science & Engineering",
    "artificial-intelligence-data-science": "Artificial Intelligence & Data Science",
    "artificial-intelligence-machine-learning": "Artificial Intelligence & Machine Learning",
    "computer-science-engineering-ai-ml": "Computer Science & Engineering (AI & ML)",
    "electronics-communication-engineering": "Electronics & Communication Engineering",
    "electrical-electronics-engineering": "Electrical & Electronics Engineering",
    "mechanical-engineering": "Mechanical Engineering",
    "civil-engineering": "Civil Engineering",
    "aeronautical-engineering": "Aeronautical Engineering",
    "master-of-business-administration": "MBA",
    "master-of-structural-engineering": "M.Tech Structural Engineering",
    "master-of-computer-science-and-engineering": "M.Tech CSE",
}


@dataclass
class ProcessingResult:
    documents_seen: int = 0
    cleaned_documents: int = 0
    empty_skipped: int = 0
    chunks_written: int = 0
    duplicates_removed: int = 0
    failed: int = 0


def department_for_url(url: str) -> str | None:
    for hint, name in DEPARTMENT_URL_HINTS.items():
        if hint in url:
            return name
    return None


def clean_html(html: str) -> tuple[str, list[tuple[str, str]]]:
    """Returns (plain_text_with_heading_markers, [(heading_text, position_marker), ...]).
    Heading markers are inserted inline as `\x02HEADING\x03<text>\x02/HEADING\x03`
    so the chunker can track "nearest preceding heading" per chunk without a
    second parsing pass."""
    soup = BeautifulSoup(html, "html.parser")

    for tag_name in BOILERPLATE_TAGS:
        for tag in soup.find_all(tag_name):
            tag.decompose()

    for tag in soup.find_all(True):
        # Some real-world pages have malformed markup that makes bs4 produce
        # a Tag with attrs=None (rather than an empty dict) — .get() on that
        # raises AttributeError, so go through a plain dict instead.
        attrs = tag.attrs or {}
        classes = " ".join(attrs.get("class", [])) + " " + (attrs.get("id") or "")
        classes = classes.lower()
        if any(hint in classes for hint in BOILERPLATE_CLASS_HINTS):
            tag.decompose()

    body = soup.body or soup
    parts: list[str] = []
    headings: list[tuple[str, str]] = []
    for element in body.descendants:
        if getattr(element, "name", None) in ("h1", "h2", "h3", "h4"):
            heading_text = element.get_text(strip=True)
            if heading_text:
                marker = f"\x02HEADING:{heading_text}\x02"
                parts.append(marker)
                headings.append((heading_text, marker))
        elif getattr(element, "name", None) in ("li", "p", "td", "th"):
            text = element.get_text(" ", strip=True)
            if text:
                parts.append(text)

    combined = "\n".join(parts)
    combined = re.sub(r"[ \t]+", " ", combined)
    combined = re.sub(r"\n{3,}", "\n\n", combined)
    return combined.strip(), headings


def strip_repeated_lines(pages: list[str]) -> list[str]:
    """Drops any line that appears on more than half of a PDF's pages —
    almost certainly a running header/footer, not content."""
    if len(pages) < 3:
        return pages
    line_counts: dict[str, int] = {}
    per_page_lines = [set(line.strip() for line in p.splitlines() if line.strip()) for p in pages]
    for lines in per_page_lines:
        for line in lines:
            line_counts[line] = line_counts.get(line, 0) + 1
    threshold = len(pages) / 2
    repeated = {line for line, count in line_counts.items() if count > threshold and len(line) < 120}
    cleaned = []
    for page in pages:
        kept = [line for line in page.splitlines() if line.strip() not in repeated]
        cleaned.append("\n".join(kept))
    return cleaned


def chunk_text_with_sections(text: str, splitter: RecursiveCharacterTextSplitter) -> list[tuple[str, str | None]]:
    """Splits `text` (which may contain \\x02HEADING:...\\x02 markers) into
    (chunk_text, section) pairs — section is the nearest heading marker
    before each chunk's start, then stripped from the visible chunk text."""
    heading_pattern = re.compile(r"\x02HEADING:(.*?)\x02")
    raw_chunks = splitter.split_text(text)
    results: list[tuple[str, str | None]] = []
    last_heading: str | None = None
    cursor = 0
    for raw_chunk in raw_chunks:
        idx = text.find(raw_chunk, cursor)
        if idx == -1:
            idx = text.find(raw_chunk)
        preceding = text[:idx] if idx != -1 else text
        headings_before = heading_pattern.findall(preceding)
        if headings_before:
            last_heading = headings_before[-1]
        visible = heading_pattern.sub("", raw_chunk).strip()
        if visible:
            results.append((visible, last_heading))
        if idx != -1:
            cursor = idx + len(raw_chunk)
    return results


def process() -> ProcessingResult:
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    result = ProcessingResult()
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP, separators=["\n\n", "\n", ". ", " "]
    )
    seen_hashes: set[str] = set()
    chunks_out: list[dict] = []

    # --- Website pages ---
    for meta_path in sorted(RAW_WEBSITE_DIR.glob("*.meta.json")):
        result.documents_seen += 1
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        html_path = meta_path.with_suffix("").with_suffix(".html")
        if not html_path.exists():
            result.failed += 1
            continue
        try:
            cleaned_text, _headings = clean_html(html_path.read_text(encoding="utf-8"))
        except Exception as exc:  # noqa: BLE001 — log and continue, never crash the batch
            logger.warning("Failed to clean %s: %s", meta["source_url"], exc)
            result.failed += 1
            upsert_manifest_entry(
                source_url=meta["source_url"],
                title=meta["title"],
                source_type="official_website",
                status="failed",
                error=f"cleaning failed: {exc}",
            )
            continue

        if len(cleaned_text.replace("\x02", "")) < MIN_CONTENT_CHARS:
            result.empty_skipped += 1
            logger.info("Skipping (no meaningful content after cleaning): %s", meta["source_url"])
            upsert_manifest_entry(
                source_url=meta["source_url"],
                title=meta["title"],
                source_type="official_website",
                status="failed",
                error="no meaningful content after cleaning (empty/boilerplate-only page)",
            )
            continue

        result.cleaned_documents += 1
        department = department_for_url(meta["source_url"])
        chunk_index = 0
        for chunk_text, section in chunk_text_with_sections(cleaned_text, splitter):
            normalized = re.sub(r"\s+", " ", chunk_text.strip().lower())
            fingerprint = hashlib.sha256(normalized.encode("utf-8")).hexdigest()
            if fingerprint in seen_hashes:
                result.duplicates_removed += 1
                continue
            seen_hashes.add(fingerprint)
            chunk_id = hashlib.sha256(f"{meta['source_url']}::{chunk_index}".encode()).hexdigest()[:16]
            chunks_out.append(
                {
                    "chunk_id": chunk_id,
                    "text": chunk_text,
                    "source_url": meta["source_url"],
                    "source_title": meta["title"],
                    "source_type": "official_website",
                    "section": section,
                    "page": None,
                    "document_name": None,
                    "department": department,
                    "collection_date": meta["collection_date"],
                    "knowledge_category": "official_institutional",
                }
            )
            chunk_index += 1
            result.chunks_written += 1

        upsert_manifest_entry(
            source_url=meta["source_url"],
            title=meta["title"],
            source_type="official_website",
            status="chunked",
            chunk_count=chunk_index,
        )

    # --- PDFs ---
    for meta_path in sorted(RAW_PDFS_DIR.glob("*.meta.json")):
        result.documents_seen += 1
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        pages_path = meta_path.with_name(meta_path.name.replace(".meta.json", ".pages.json"))
        if not pages_path.exists():
            result.failed += 1
            continue
        pages: list[str] = json.loads(pages_path.read_text(encoding="utf-8"))
        pages = strip_repeated_lines(pages)

        if not any(len(p.strip()) >= MIN_CONTENT_CHARS for p in pages):
            result.empty_skipped += 1
            logger.info(
                "Skipping (no extractable text — likely scanned/image-only PDF): %s",
                meta["document_name"],
            )
            upsert_manifest_entry(
                source_url=meta["source_url"],
                title=meta["document_name"],
                source_type="official_pdf",
                status="failed",
                error="no extractable text (likely scanned/image-only PDF)",
            )
            continue

        result.cleaned_documents += 1
        department = department_for_url(meta["source_url"])
        chunk_index = 0
        for page_number, page_text in enumerate(pages, start=1):
            page_text = page_text.strip()
            if len(page_text) < MIN_CONTENT_CHARS:
                continue
            for raw_chunk in splitter.split_text(page_text):
                normalized = re.sub(r"\s+", " ", raw_chunk.strip().lower())
                fingerprint = hashlib.sha256(normalized.encode("utf-8")).hexdigest()
                if fingerprint in seen_hashes:
                    result.duplicates_removed += 1
                    continue
                seen_hashes.add(fingerprint)
                chunk_id = hashlib.sha256(
                    f"{meta['source_url']}::{page_number}::{chunk_index}".encode()
                ).hexdigest()[:16]
                chunks_out.append(
                    {
                        "chunk_id": chunk_id,
                        "text": raw_chunk.strip(),
                        "source_url": meta["source_url"],
                        "source_title": meta["document_name"],
                        "source_type": "official_pdf",
                        "section": None,
                        "page": page_number,
                        "document_name": meta["document_name"],
                        "department": department,
                        "collection_date": meta["collection_date"],
                        "knowledge_category": "official_institutional",
                    }
                )
                chunk_index += 1
                result.chunks_written += 1

        upsert_manifest_entry(
            source_url=meta["source_url"],
            title=meta["document_name"],
            source_type="official_pdf",
            status="chunked",
            chunk_count=chunk_index,
        )

    chunks_path = PROCESSED_DIR / "chunks.jsonl"
    with chunks_path.open("w", encoding="utf-8") as f:
        for chunk in chunks_out:
            f.write(json.dumps(chunk, ensure_ascii=False) + "\n")

    return result


if __name__ == "__main__":
    outcome = process()
    logger.info(
        "Cleaning/chunking complete: %d documents seen, %d cleaned, %d empty skipped, "
        "%d chunks written, %d duplicates removed, %d failed",
        outcome.documents_seen,
        outcome.cleaned_documents,
        outcome.empty_skipped,
        outcome.chunks_written,
        outcome.duplicates_removed,
        outcome.failed,
    )
