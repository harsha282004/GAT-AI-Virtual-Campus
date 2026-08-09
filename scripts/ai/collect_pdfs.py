"""Step 3 — Official GAT PDF collector.

Downloads every official-domain PDF discovered by scripts/ai/collect_website.py
(data/raw/pdfs/discovered_pdf_links.json) and extracts per-page text via
pypdf. Never touches third-party PDFs — every link was already verified to
resolve to gat.ac.in during the website crawl. Logs and continues on any
failure (broken link, corrupt PDF, oversized file) rather than fabricating
missing content.

Usage: python scripts/ai/collect_pdfs.py
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass
from urllib.parse import unquote, urlparse

import requests
from pypdf import PdfReader
from pypdf.errors import PdfReadError

from _shared import RAW_PDFS_DIR, configure_logging, now_iso, slugify, upsert_manifest_entry

logger = configure_logging("collect_pdfs")

USER_AGENT = "GATCampusAssistantBot/1.0 (+internal knowledge-base collector)"
REQUEST_TIMEOUT_S = 30
REQUEST_DELAY_S = 0.5
MAX_PDF_BYTES = 15 * 1024 * 1024  # 15MB safety cap — avoids pathological files
DISCOVERED_LINKS_PATH = RAW_PDFS_DIR / "discovered_pdf_links.json"


@dataclass
class PdfCollectionResult:
    collected: int = 0
    failed: int = 0


def document_name_from_url(url: str) -> str:
    path = urlparse(url).path
    return unquote(path.rsplit("/", 1)[-1]) or url


def collect_pdfs() -> PdfCollectionResult:
    if not DISCOVERED_LINKS_PATH.exists():
        logger.error(
            "%s not found — run scripts/ai/collect_website.py first.", DISCOVERED_LINKS_PATH
        )
        return PdfCollectionResult()

    links: list[str] = json.loads(DISCOVERED_LINKS_PATH.read_text(encoding="utf-8"))
    result = PdfCollectionResult()

    for url in links:
        document_name = document_name_from_url(url)
        logger.info("Fetching PDF: %s", url)
        try:
            response = requests.get(
                url,
                headers={"User-Agent": USER_AGENT},
                timeout=REQUEST_TIMEOUT_S,
                stream=True,
            )
            response.raise_for_status()
            content = response.content
        except requests.RequestException as exc:
            logger.warning("Failed to download %s: %s", url, exc)
            upsert_manifest_entry(
                source_url=url,
                title=document_name,
                source_type="official_pdf",
                status="failed",
                error=f"download failed: {exc}",
            )
            result.failed += 1
            time.sleep(REQUEST_DELAY_S)
            continue

        if len(content) > MAX_PDF_BYTES:
            logger.warning(
                "Skipping %s: %d bytes exceeds the %d byte safety cap", url, len(content), MAX_PDF_BYTES
            )
            upsert_manifest_entry(
                source_url=url,
                title=document_name,
                source_type="official_pdf",
                status="failed",
                error=f"exceeds size cap ({len(content)} bytes)",
            )
            result.failed += 1
            time.sleep(REQUEST_DELAY_S)
            continue

        slug = slugify(document_name)
        pdf_path = RAW_PDFS_DIR / f"{slug}.pdf"
        pdf_path.write_bytes(content)

        try:
            reader = PdfReader(str(pdf_path))
            pages = [page.extract_text() or "" for page in reader.pages]
        except (PdfReadError, ValueError) as exc:
            logger.warning("Failed to extract text from %s: %s", url, exc)
            upsert_manifest_entry(
                source_url=url,
                title=document_name,
                source_type="official_pdf",
                status="failed",
                error=f"text extraction failed: {exc}",
            )
            result.failed += 1
            time.sleep(REQUEST_DELAY_S)
            continue

        metadata = {
            "source_url": url,
            "document_name": document_name,
            "source_type": "official_pdf",
            "collection_date": now_iso(),
            "page_count": len(pages),
        }
        (RAW_PDFS_DIR / f"{slug}.meta.json").write_text(
            json.dumps(metadata, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        (RAW_PDFS_DIR / f"{slug}.pages.json").write_text(
            json.dumps(pages, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        upsert_manifest_entry(
            source_url=url, title=document_name, source_type="official_pdf", status="collected"
        )
        result.collected += 1
        time.sleep(REQUEST_DELAY_S)

    return result


if __name__ == "__main__":
    outcome = collect_pdfs()
    logger.info(
        "PDF collection complete: %d collected, %d failed", outcome.collected, outcome.failed
    )
