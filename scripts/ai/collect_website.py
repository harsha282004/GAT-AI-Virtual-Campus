"""Step 2 — Official GAT website collector.

Polite, depth-limited, same-domain crawl of https://www.gat.ac.in/ starting
from the homepage. Not a blind crawl: only follows links that resolve to the
official GAT domain and look like real content pages (rejects assets,
external links, tracking anchors, and the third-party library OPAC
subdomain). PDF links are recorded for scripts/ai/collect_pdfs.py rather
than fetched here.

Usage: python scripts/ai/collect_website.py
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

from _shared import (
    OFFICIAL_BASE_URL,
    OFFICIAL_DOMAIN,
    RAW_PDFS_DIR,
    RAW_WEBSITE_DIR,
    configure_logging,
    now_iso,
    slugify,
    upsert_manifest_entry,
)

logger = configure_logging("collect_website")

USER_AGENT = "GATCampusAssistantBot/1.0 (+internal knowledge-base collector)"
REQUEST_TIMEOUT_S = 15
REQUEST_DELAY_S = 0.6  # politeness delay between requests
MAX_DEPTH = 2
MAX_PAGES = 80

# Allowed subdomains — deliberately excludes library.gat.ac.in (a third-party
# OPAC portal, not GAT-authored content) and any other subdomain.
ALLOWED_HOSTS = {OFFICIAL_DOMAIN, f"www.{OFFICIAL_DOMAIN}"}

ASSET_EXTENSIONS = (
    ".css", ".js", ".png", ".jpg", ".jpeg", ".svg", ".webp", ".gif", ".ico",
    ".woff", ".woff2", ".ttf", ".mp4", ".zip",
    # Binary Office document formats — like .pdf, these need their own
    # extraction path, not HTML parsing. Fetching one here would decode raw
    # binary as if it were UTF-8 text, producing thousands of replacement
    # characters (found via one real gat.ac.in .docx link during Step 2
    # testing). Only .pdf is in scope for Step 3's document collection.
    ".docx", ".doc", ".xlsx", ".xls", ".pptx", ".ppt",
)


@dataclass
class CrawlResult:
    pages_collected: int = 0
    pages_failed: int = 0
    pdf_links_discovered: set[str] = field(default_factory=set)


def is_content_page(url: str) -> bool:
    parsed = urlparse(url)
    if parsed.netloc not in ALLOWED_HOSTS:
        return False
    path = parsed.path.lower()
    if path.endswith(ASSET_EXTENSIONS) or path.endswith(".pdf"):
        return False
    if parsed.scheme not in ("http", "https"):
        return False
    return True


def normalize_url(url: str) -> str:
    parsed = urlparse(url)
    # Drop fragment/query — the same content page shouldn't be crawled twice
    # under #anchor or ?utm=... variants.
    return parsed._replace(fragment="", query="").geturl()


def fetch(url: str) -> requests.Response | None:
    try:
        response = requests.get(
            url, headers={"User-Agent": USER_AGENT}, timeout=REQUEST_TIMEOUT_S
        )
        response.raise_for_status()
        # gat.ac.in's Content-Type header never declares a charset, so
        # requests falls back to Latin-1 per the HTTP spec default — the
        # site actually serves UTF-8 (like virtually every modern page),
        # so that default silently mangles non-ASCII characters (em-dashes,
        # curly quotes) into mojibake. Force the correct decoding instead
        # of trusting response.encoding's guess.
        response.encoding = "utf-8"
        return response
    except requests.RequestException as exc:
        logger.warning("Failed to fetch %s: %s", url, exc)
        return None


def extract_title(soup: BeautifulSoup, fallback: str) -> str:
    if soup.title and soup.title.string:
        return soup.title.string.strip()
    h1 = soup.find("h1")
    if h1:
        return h1.get_text(strip=True)
    return fallback


def crawl() -> CrawlResult:
    RAW_WEBSITE_DIR.mkdir(parents=True, exist_ok=True)
    RAW_PDFS_DIR.mkdir(parents=True, exist_ok=True)

    result = CrawlResult()
    seen: set[str] = set()
    queue: list[tuple[str, int]] = [(normalize_url(OFFICIAL_BASE_URL), 0)]

    while queue and result.pages_collected + result.pages_failed < MAX_PAGES:
        url, depth = queue.pop(0)
        if url in seen:
            continue
        seen.add(url)

        logger.info("Fetching (depth=%d): %s", depth, url)
        response = fetch(url)
        time.sleep(REQUEST_DELAY_S)

        if response is None:
            result.pages_failed += 1
            upsert_manifest_entry(
                source_url=url,
                title=url,
                source_type="official_website",
                status="failed",
                error="request failed",
            )
            continue

        soup = BeautifulSoup(response.text, "html.parser")
        title = extract_title(soup, fallback=url)

        slug = slugify(url)
        (RAW_WEBSITE_DIR / f"{slug}.html").write_text(response.text, encoding="utf-8")
        metadata = {
            "source_url": url,
            "title": title,
            "source_type": "official_website",
            "collection_date": now_iso(),
            "depth": depth,
        }
        (RAW_WEBSITE_DIR / f"{slug}.meta.json").write_text(
            json.dumps(metadata, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        upsert_manifest_entry(
            source_url=url, title=title, source_type="official_website", status="collected"
        )
        result.pages_collected += 1

        if depth >= MAX_DEPTH:
            continue

        for a in soup.find_all("a", href=True):
            href = urljoin(url, a["href"])
            if href.lower().endswith(".pdf"):
                parsed = urlparse(href)
                if parsed.netloc in ALLOWED_HOSTS:
                    result.pdf_links_discovered.add(normalize_url(href))
                continue
            href = normalize_url(href)
            if is_content_page(href) and href not in seen:
                queue.append((href, depth + 1))

    (RAW_PDFS_DIR / "discovered_pdf_links.json").write_text(
        json.dumps(sorted(result.pdf_links_discovered), indent=2), encoding="utf-8"
    )

    return result


if __name__ == "__main__":
    outcome = crawl()
    logger.info(
        "Website collection complete: %d pages collected, %d failed, %d PDF links discovered",
        outcome.pages_collected,
        outcome.pages_failed,
        len(outcome.pdf_links_discovered),
    )
