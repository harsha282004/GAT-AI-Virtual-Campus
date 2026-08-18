"""Adds fee-structure and admission-policy content to the EXISTING RAG
knowledge base — reuses the exact chunks.jsonl schema clean_and_chunk.py
already produces (same fields, same chunk_id scheme, same manifest
tracking) so hybrid_retrieval.py/build_embeddings.py need no changes at
all. This is additive, not a second pipeline: run this once, then run
scripts/ai/build_embeddings.py as usual to embed the new chunks into the
same ChromaDB collection.

Two sources are added:
1. Fee-table chunks — generated FROM backend.app.models.fee_information
   rows (scripts/db/seed_fee_data.py's data), not hand-duplicated, so the
   chunk text can never drift from the authoritative DB record.
2. Admission-policy chunks — eligibility/application-process/documents-
   required text transcribed verbatim from GAT's own official document
   "Admission 2026.docx" (the same document seed_fee_data.py's fee table
   comes from), covering real knowledge gaps the pre-existing KB had no
   content for at all.

Usage (from repo root):
    python scripts/ai/ingest_fee_admission_content.py
    python scripts/ai/build_embeddings.py
"""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))

from _shared import PROCESSED_DIR, configure_logging, now_iso, upsert_manifest_entry  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402
from app.models.fee_information import FeeInformation  # noqa: E402

logger = configure_logging("ingest_fee_admission_content")

FEE_SOURCE_URL = "https://www.gat.ac.in/img/Admission%202026.docx"
FEE_SOURCE_TITLE = "GAT Admission Policy & Fee Structure 2026-27"
ADMISSION_SOURCE_URL = FEE_SOURCE_URL  # same document — policy text + fee table are one file
ADMISSION_SOURCE_TITLE = FEE_SOURCE_TITLE


def _make_chunk(
    *,
    source_url: str,
    source_title: str,
    chunk_index: int,
    text: str,
    department: str | None,
) -> dict:
    chunk_id = hashlib.sha256(f"{source_url}::{chunk_index}".encode()).hexdigest()[:16]
    return {
        "chunk_id": chunk_id,
        "text": text,
        "source_url": source_url,
        "source_title": source_title,
        "source_type": "official_pdf",
        "section": "Fee Structure" if "fee" in text.lower()[:200] else "Admission Policy",
        "page": None,
        "document_name": "Admission 2026.docx",
        "department": department,
        "collection_date": now_iso(),
        "knowledge_category": "official_institutional",
    }


# Common short forms students actually type — the chunk text otherwise
# only contains full department names, so a query like "What is the CSE
# fee?" has no literal token to match against for BM25 (found during
# retrieval testing: the CSE chunk ranked #4, behind generic fee chunks,
# until its abbreviation was added here).
_PROGRAM_ABBREVIATIONS: dict[str, list[str]] = {
    "Computer Science & Engineering": ["CSE"],
    "Artificial Intelligence and Machine Learning": ["AI&ML", "AIML", "AI ML"],
    "Artificial Intelligence and Data Science": ["AI&DS", "AIDS", "AI DS"],
    "Information Science and Engineering": ["ISE"],
    "Computer Science & Engineering (AI & ML)": ["CSE (AI&ML)", "CSE AIML"],
    "Electronics and Communication Engineering": ["ECE"],
    "Electrical and Electronics Engineering": ["EEE"],
    "Civil Engineering": ["CE"],
}


def _fee_chunks() -> list[dict]:
    db = SessionLocal()
    try:
        rows = (
            db.query(FeeInformation)
            .filter(FeeInformation.academic_year == "2026-27")
            .order_by(FeeInformation.id)
            .all()
        )
    finally:
        db.close()

    tuition_rows = [r for r in rows if r.fee_type == "tuition" and r.amount is not None]
    unavailable_rows = [r for r in rows if r.amount is None]

    chunks: list[dict] = []
    idx = 0

    overview = (
        f"GAT Fee Structure {tuition_rows[0].academic_year if tuition_rows else '2026-27'}: "
        "Global Academy of Technology (GAT) publishes a Management Quota fee structure for "
        "the academic year 2026-27, covering tuition fees for BE/B.Tech, MBA, and M.Tech "
        "programs. This is the fee for MANAGEMENT QUOTA admission. Government/KCET-quota "
        "(regular counselling) seat fees are fixed separately by the Karnataka Fee "
        "Regulatory Committee / Karnataka Examinations Authority (KEA) and are not published "
        "by GAT directly — students admitted through KCET/regular counselling should check "
        "with the KEA or the GAT admission office for their applicable fee. All BE program "
        "fees below are per year and are the same across all 4 years of the program unless "
        "noted otherwise. MBA and M.Tech are 2-year programs. "
        f"Source: {FEE_SOURCE_TITLE} ({FEE_SOURCE_URL})."
    )
    chunks.append(_make_chunk(source_url=FEE_SOURCE_URL, source_title=FEE_SOURCE_TITLE, chunk_index=idx, text=overview, department=None))
    idx += 1

    # One dedicated chunk per program (not grouped) so each department's
    # name/fee dominates its own chunk for BM25 term-frequency purposes —
    # a shared multi-department chunk was measurably outscored by generic
    # department marketing pages for queries like "How much does
    # Mechanical Engineering cost?" during testing. "cost"/"charges"/
    # "price" are included explicitly since users phrase this many ways.
    for r in tuition_rows:
        abbrevs = _PROGRAM_ABBREVIATIONS.get(r.program, [])
        abbrev_text = f" ({' / '.join(abbrevs)})" if abbrevs else ""
        name_forms = ", ".join([r.program, *abbrevs])
        text = (
            f"{r.program}{abbrev_text} fee, {name_forms} tuition, {name_forms} cost: the "
            f"{r.program}{abbrev_text} management quota fee / tuition / cost / charges / "
            f"price at GAT for the Academic Year 2026-27 is Rs. {int(r.amount):,} "
            f"({r.amount / 100000:.1f} Lakhs) per year. {r.notes}"
        )
        chunks.append(
            _make_chunk(
                source_url=FEE_SOURCE_URL,
                source_title=FEE_SOURCE_TITLE,
                chunk_index=idx,
                text=text,
                department=r.program,
            )
        )
        idx += 1

    unavailable_lines = [f"{r.fee_type.replace('_', ' ').title()}: {r.notes}" for r in unavailable_rows]
    unavailable_text = (
        "GAT Fee Information — Not Publicly Disclosed: the following fee categories do not "
        "have a specific published amount as of the last verification date and should not be "
        "guessed at:\n" + "\n".join(unavailable_lines)
    )
    chunks.append(
        _make_chunk(
            source_url=FEE_SOURCE_URL, source_title=FEE_SOURCE_TITLE, chunk_index=idx, text=unavailable_text, department=None
        )
    )
    return chunks


def _admission_policy_chunks() -> list[dict]:
    # Transcribed verbatim from GAT's own "Admission 2026.docx" (fetched
    # and verified live on 2026-08-18) — not paraphrased/invented.
    texts = [
        (
            "GAT Undergraduate (B.E.) Eligibility Criteria: Candidates must have passed 10+2 "
            "(PUC/CBSE/ICSE or equivalent) with Physics and Mathematics as compulsory subjects "
            "along with Chemistry/Biology/Computer Science. A minimum aggregate of 45% (40% "
            "for SC/ST/OBC candidates of Karnataka) is required in the qualifying examination. "
            "Admission is based on KCET/COMEDK scores or through management quota."
        ),
        (
            "GAT Postgraduate (M.Tech & MBA) Eligibility Criteria: M.Tech candidates must have "
            "a B.E./B.Tech degree in a relevant field with a minimum of 50% marks (45% for "
            "SC/ST/OBC of Karnataka) and a valid PGCET/GATE score. MBA candidates must have a "
            "bachelor's degree (minimum 3 years) with at least 50% marks (45% for SC/ST/OBC of "
            "Karnataka) and a valid PGCET/KMAT/CMAT score."
        ),
        (
            "GAT Admission Process: Entrance Exam Route — candidates applying through KCET, "
            "COMEDK, PGCET, GATE, KMAT, or CMAT must follow the respective exam authorities' "
            "admission process. Management Quota — eligible candidates can apply directly "
            "through the college's admission office; selection is based on merit, interview "
            "performance, and availability of seats. Lateral Entry (Diploma Holders): admission "
            "to the 2nd year of B.E. is through DCET (Diploma CET)."
        ),
        (
            "GAT Admission — Required Documents: candidates must fill out the online/offline "
            "application form and submit the required documents, including: 10th & 12th mark "
            "sheets (or equivalent), entrance exam scorecard (if applicable), Transfer "
            "Certificate (TC), Migration Certificate (for non-Karnataka students), Caste "
            "Certificate (if applicable), and passport-size photographs."
        ),
        (
            "GAT Scholarships: scholarships are available for meritorious students, "
            "economically weaker sections, and reserved category students based on "
            "eligibility, including Sports Scholarships for National Level achievers. The "
            "exact fee structure is determined as per government regulations and management "
            "policies (see the separate fee structure records)."
        ),
    ]
    return [
        _make_chunk(
            source_url=ADMISSION_SOURCE_URL,
            source_title=ADMISSION_SOURCE_TITLE,
            chunk_index=100 + i,  # offset so IDs never collide with the fee chunks above
            text=text,
            department=None,
        )
        for i, text in enumerate(texts)
    ]


def ingest() -> int:
    chunks_path = PROCESSED_DIR / "chunks.jsonl"
    existing_lines: list[str] = []
    existing_ids: set[str] = set()
    if chunks_path.exists():
        with chunks_path.open(encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                existing_lines.append(line)
                existing_ids.add(json.loads(line)["chunk_id"])

    new_chunks = _fee_chunks() + _admission_policy_chunks()

    # Idempotent re-run: drop any existing lines whose chunk_id we're about
    # to replace, so re-running this script updates content instead of
    # duplicating it (same deterministic-ID convention clean_and_chunk.py
    # already relies on for build_embeddings.py's upsert).
    new_ids = {c["chunk_id"] for c in new_chunks}
    kept_lines = [
        line for line in existing_lines if json.loads(line)["chunk_id"] not in new_ids
    ]

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    with chunks_path.open("w", encoding="utf-8") as f:
        for line in kept_lines:
            f.write(line + "\n")
        for chunk in new_chunks:
            f.write(json.dumps(chunk, ensure_ascii=False) + "\n")

    upsert_manifest_entry(
        source_url=FEE_SOURCE_URL,
        title=FEE_SOURCE_TITLE,
        source_type="official_pdf",
        status="chunked",
        chunk_count=len(new_chunks),
    )

    logger.info(
        "Wrote %d fee/admission-policy chunks (total chunks.jsonl now has %d lines).",
        len(new_chunks),
        len(kept_lines) + len(new_chunks),
    )
    return len(new_chunks)


if __name__ == "__main__":
    ingest()
