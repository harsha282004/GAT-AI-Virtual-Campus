"""Seed FeeInformation with officially-sourced GAT fee facts.

Every amount here was verified live from an official GAT/AICTE source on
2026-08-18 (see source_url/source_document/notes on each row) — none are
estimated or invented. Where no official source publishes an amount
(hostel fee, admission/application fee, government/KCET-quota tuition),
the row is still recorded with amount=None and a note explaining why, so
the chatbot can say "not verified" instead of having nothing to say at all
(see Requirement 2's "mark as unavailable" instruction).

Primary source for the management-quota tuition table: GAT's own document
"Admission 2026.docx", linked directly from https://www.gat.ac.in/admission.html
under "Fee Structure — Get a breakdown of tuition, hostel, and other
charges." Program list cross-checked against AICTE's Extension of Approval
(EoA) letter for AY 2026-27 (F.No. South-West/1-46259780749/2026/EOA,
approved 09-Apr-2026), which confirms GAT has no MCA/M.Sc. program.

Usage (from repo root, after `alembic upgrade head`):
    python scripts/db/seed_fee_data.py

Safe to re-run: deletes and re-inserts rows tagged with this script's
academic_year, rather than duplicating them.
"""

from __future__ import annotations

import datetime
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))

from app.db.session import SessionLocal  # noqa: E402
from app.models.fee_information import FeeInformation  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(levelname)-8s %(message)s")
logger = logging.getLogger("seed_fee_data")

ACADEMIC_YEAR = "2026-27"
VERIFIED_DATE = datetime.date(2026, 8, 18)

FEE_SOURCE_URL = "https://www.gat.ac.in/img/Admission%202026.docx"
FEE_SOURCE_DOCUMENT = (
    "GAT Admission Policy & Management Fee Structure, Academic Year 2026-27 "
    "(official document, linked from gat.ac.in/admission.html as \"Fee Structure\")"
)

# (program/department label, per-year management-quota tuition in INR,
# number of years the program runs) — exactly as published in the source
# document's "Management Fees Structure – Academic Year 2026-27" table.
_MANAGEMENT_TUITION_BY_PROGRAM: list[tuple[str, int, int]] = [
    ("Computer Science & Engineering", 600_000, 4),
    ("Artificial Intelligence and Machine Learning", 500_000, 4),
    ("Artificial Intelligence and Data Science", 500_000, 4),
    ("Information Science and Engineering", 500_000, 4),
    ("Computer Science & Engineering (AI & ML)", 500_000, 4),
    ("Electronics and Communication Engineering", 400_000, 4),
    ("Aeronautical Engineering", 350_000, 4),
    ("Electrical and Electronics Engineering", 300_000, 4),
    ("Mechanical Engineering", 200_000, 4),
    ("Civil Engineering", 200_000, 4),
    ("MBA", 300_000, 2),
    ("M.Tech", 200_000, 2),
]


def _tuition_rows() -> list[FeeInformation]:
    rows = []
    for program, per_year, years in _MANAGEMENT_TUITION_BY_PROGRAM:
        total = per_year * years
        rows.append(
            FeeInformation(
                program=program,
                department=program,
                fee_type="tuition",
                amount=float(per_year),
                currency="INR",
                academic_year=ACADEMIC_YEAR,
                quota_category="Management Quota",
                unit="per_year",
                notes=(
                    f"Management-quota tuition fee, {program}, {ACADEMIC_YEAR}: "
                    f"₹{per_year:,} per year, same for all {years} years of the "
                    f"program (₹{total:,} total for the full {years}-year program). "
                    "This is the MANAGEMENT QUOTA fee only — government/KCET-quota "
                    "seat fees are set separately by the Karnataka Fee Regulatory "
                    "Committee and are not published by GAT (see the separate "
                    "government_quota_tuition record)."
                ),
                source_url=FEE_SOURCE_URL,
                source_document=FEE_SOURCE_DOCUMENT,
                last_verified=VERIFIED_DATE,
            )
        )
    return rows


def _unavailable_rows() -> list[FeeInformation]:
    """Explicit "not verified" records — Requirement 2: never fabricate a
    missing amount, but do record that it was checked and is unavailable,
    with why, so the chatbot has something factual to say."""
    return [
        FeeInformation(
            program="All Programs",
            department=None,
            fee_type="hostel",
            amount=None,
            currency="INR",
            academic_year=ACADEMIC_YEAR,
            quota_category=None,
            unit=None,
            notes=(
                "GAT's official website confirms on-campus hostel facilities exist "
                "for both boys and girls, but no specific hostel fee amount is "
                "published on the website or in the official fee structure "
                "document as of the verification date below. Prospective "
                "students should contact the GAT admission office directly for "
                "current hostel fees."
            ),
            source_url="https://www.gat.ac.in/admission.html",
            source_document="GAT official Admissions page",
            last_verified=VERIFIED_DATE,
        ),
        FeeInformation(
            program="All Programs",
            department=None,
            fee_type="admission",
            amount=None,
            currency="INR",
            academic_year=ACADEMIC_YEAR,
            quota_category=None,
            unit=None,
            notes=(
                "No official GAT source publishes a specific admission/"
                "application processing fee amount as of the verification date "
                "below. Not fabricated — contact the GAT admission office for "
                "current application charges."
            ),
            source_url="https://www.gat.ac.in/admission.html",
            source_document="GAT official Admissions page",
            last_verified=VERIFIED_DATE,
        ),
        FeeInformation(
            program="All Programs",
            department=None,
            fee_type="government_quota_tuition",
            amount=None,
            currency="INR",
            academic_year=ACADEMIC_YEAR,
            quota_category="Government/KCET Quota",
            unit=None,
            notes=(
                "Government/KCET-quota (regular counselling seat) tuition fees "
                "for private engineering colleges in Karnataka, including GAT, "
                "are fixed annually by the Karnataka Fee Regulatory Committee / "
                "Karnataka Examinations Authority (KEA) — not published on GAT's "
                "own website. Only the management-quota fee (see the tuition "
                "records) is published by GAT directly. Not fabricated."
            ),
            source_url=None,
            source_document=None,
            last_verified=VERIFIED_DATE,
        ),
        FeeInformation(
            program="MBA / M.Tech",
            department=None,
            fee_type="examination",
            amount=None,
            currency="INR",
            academic_year=ACADEMIC_YEAR,
            quota_category=None,
            unit=None,
            notes=(
                "A GAT Controller of Examinations notification (Application for "
                "MBA_MTech_June 2026.pdf) lists a Regular Examination Fee of "
                "₹3,500 (2nd semester) and an Examination Fee/PDC/VTU Convocation "
                "fee of ₹5,720 (4th semester MBA) — but these figures are "
                "specifically for a June 2026 backlog/re-registration exam "
                "cycle, not a general standard semester examination fee "
                "schedule, so no single verified 'examination fee' amount is "
                "recorded here. See that document for the exact backlog fee "
                "schedule."
            ),
            source_url="https://www.gat.ac.in/documents/Application for MBA_MTech_June 2026.pdf",
            source_document="Application for MBA_MTech_June 2026.pdf (GAT Controller of Examinations notification)",
            last_verified=VERIFIED_DATE,
        ),
    ]


def seed_fee_data() -> None:
    db = SessionLocal()
    try:
        existing = (
            db.query(FeeInformation).filter(FeeInformation.academic_year == ACADEMIC_YEAR).count()
        )
        if existing:
            logger.info(
                "Removing %d existing fee_information rows for %s before re-seeding.",
                existing,
                ACADEMIC_YEAR,
            )
            db.query(FeeInformation).filter(FeeInformation.academic_year == ACADEMIC_YEAR).delete()
            db.commit()

        rows = _tuition_rows() + _unavailable_rows()
        db.add_all(rows)
        db.commit()
        logger.info("Inserted %d fee_information rows for %s.", len(rows), ACADEMIC_YEAR)

        verify_count = (
            db.query(FeeInformation).filter(FeeInformation.academic_year == ACADEMIC_YEAR).count()
        )
        logger.info("Verified in database: %d rows now present for %s.", verify_count, ACADEMIC_YEAR)
    finally:
        db.close()


if __name__ == "__main__":
    seed_fee_data()
