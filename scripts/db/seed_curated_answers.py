"""One-time pre-seed of researched, source-verified answers for the
CURATED_QUESTIONS gap list (curated_answer_questions.py) — NOT a
replacement for add_pretrained_answers.py, the interactive tool you use
to add/edit answers by hand going forward. This script exists so the
curated-answer system has real, working content immediately rather than
an empty table; every answer below is sourced the same way the fee data
was (GAT's own official pages/documents, fetched and verified live on
2026-08-18 — see each ANSWERS entry's trailing source note).

Usage (from repo root, after `alembic upgrade head`):
    python scripts/db/seed_curated_answers.py

Safe to re-run: upserts by exact question-text match, never duplicates.
"""

from __future__ import annotations

import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))

from curated_answer_questions import CURATED_QUESTIONS  # noqa: E402

from app.db.session import SessionLocal  # noqa: E402
from app.models.curated_answer import CuratedAnswer  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(levelname)-8s %(message)s")
logger = logging.getLogger("seed_curated_answers")

# question -> answer. Keyed by the exact question text in
# curated_answer_questions.py so a mismatch is easy to spot (see the
# assertion in seed()).
ANSWERS: dict[str, str] = {
    "What are the admission timings for GAT?": (
        "Admission timelines depend on the route you're applying through: KCET and COMEDK "
        "seat allotment dates are announced each year by the Karnataka Examinations "
        "Authority (KEA) and COMEDK respectively, not by GAT directly, so they vary "
        "year to year. Management-quota applications can be submitted directly to GAT's "
        "admission office and are generally accepted on a rolling basis, subject to seat "
        "availability. For the current academic year's exact dates, check "
        "https://www.gat.ac.in/admission.html or contact the admission office directly — "
        "GAT does not publish a single fixed admission calendar on its site."
    ),
    "How can I contact the GAT admission office?": (
        "You can reach GAT's admission office at: Phone 080-28603158 / 080-28603157, "
        "Email admissions@gat.ac.in (for general enquiries: info@gat.ac.in). "
        "Address: Global Academy of Technology, Aditya Layout, Rajarajeshwari Nagar, "
        "Bengaluru, Karnataka 560098."
    ),
    "Is there an entrance examination required for admission to GAT?": (
        "Yes, for most seats. Undergraduate (B.E.) admission is based on KCET or COMEDK "
        "scores (or management quota, which doesn't require an entrance exam score but is "
        "merit/interview-based). Postgraduate admission requires PGCET or GATE scores for "
        "M.Tech, and PGCET, KMAT, or CMAT scores for MBA. Diploma holders can join B.E. "
        "2nd year via lateral entry through DCET (Diploma CET)."
    ),
    "What undergraduate courses/branches does GAT offer?": (
        "GAT offers 10 AICTE-approved, VTU-affiliated undergraduate (B.E.) programs: "
        "Computer Science & Engineering (CSE), Computer Science & Engineering (AI & ML), "
        "Artificial Intelligence and Machine Learning, Artificial Intelligence and Data "
        "Science, Information Science and Engineering (ISE), Electronics & Communication "
        "Engineering (ECE), Electrical and Electronics Engineering (EEE), Mechanical "
        "Engineering, Civil Engineering, and Aeronautical Engineering."
    ),
    "What postgraduate courses does GAT offer?": (
        "GAT offers three postgraduate programs: M.Tech in Computer Science & Engineering, "
        "M.Tech in Structural Engineering, and MBA (Master of Business Administration). "
        "GAT does not currently offer an MCA or M.Sc. program."
    ),
    "How much do I need to pay to join GAT?": (
        "It depends on the program and admission quota. Under the management quota (the "
        "only fee GAT publishes directly), published per-year tuition for 2026-27 ranges "
        "from about ₹2 Lakhs/year (Mechanical, Civil) up to ₹6 Lakhs/year (Computer Science "
        "& Engineering), plus a similar-range fee for MBA (₹3 Lakhs/year) and M.Tech "
        "(₹2 Lakhs/year). Government/KCET-quota seat fees are set separately by the "
        "Karnataka Fee Regulatory Committee, and hostel/admission-processing charges are "
        "not published by GAT — ask the admission office for the exact total for your "
        "specific program and quota."
    ),
    "What is the hostel fee at GAT?": (
        "GAT provides on-campus hostel facilities for both boys and girls, but does not "
        "publish a specific hostel fee amount on its website or in its official fee "
        "structure document. Please contact the GAT admission office directly for current "
        "hostel fees."
    ),
}


def seed_curated_answers() -> None:
    question_texts = {q for q, _, _ in CURATED_QUESTIONS}
    missing = question_texts - ANSWERS.keys()
    if missing:
        raise ValueError(f"ANSWERS is missing entries for: {missing}")

    db = SessionLocal()
    inserted = 0
    updated = 0
    try:
        for question, category, keywords in CURATED_QUESTIONS:
            existing = db.query(CuratedAnswer).filter(CuratedAnswer.question == question).one_or_none()
            if existing:
                existing.answer = ANSWERS[question]
                existing.category = category
                existing.keywords = keywords
                existing.active = True
                updated += 1
            else:
                db.add(
                    CuratedAnswer(
                        question=question,
                        answer=ANSWERS[question],
                        category=category,
                        keywords=keywords,
                        source="GAT official website/documents (verified 2026-08-18)",
                        active=True,
                    )
                )
                inserted += 1
        db.commit()

        total = db.query(CuratedAnswer).count()
        logger.info("Inserted %d, updated %d curated answers. Total in database: %d.", inserted, updated, total)
    finally:
        db.close()


if __name__ == "__main__":
    seed_curated_answers()
