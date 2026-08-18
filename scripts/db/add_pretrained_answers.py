"""Interactive terminal tool for authoring Curated Answers (a.k.a.
Pretrained/Verified FAQ Answers) — manually-authored question/answer
records, NOT model training. Each answer you type is saved to the
database immediately, one question at a time.

Usage (from repo root, after `alembic upgrade head`):
    python scripts/db/add_pretrained_answers.py

Walks through every question in curated_answer_questions.CURATED_QUESTIONS
(edit that file to add more questions later — see its own docstring).
If a question already has a stored answer, its current answer is shown
first so you can press Enter to keep it or type a replacement.
"""

from __future__ import annotations

import sys
from pathlib import Path

# Windows consoles default stdout to cp1252, which can't encode the ✓/—
# characters this CLI prints — same fix scripts/ai/_shared.py already
# applies for the same reason.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))

from curated_answer_questions import CURATED_QUESTIONS  # noqa: E402

from app.db.session import SessionLocal  # noqa: E402
from app.models.curated_answer import CuratedAnswer  # noqa: E402


def _find_existing(db, question: str) -> CuratedAnswer | None:
    return db.query(CuratedAnswer).filter(CuratedAnswer.question == question).one_or_none()


def run() -> None:
    total = len(CURATED_QUESTIONS)
    print("-" * 43)
    print("GAT CURATED ANSWER SETUP")
    print("-" * 43)
    print(f"{total} question(s) to go through. Press Enter with no text to skip a question.\n")

    db = SessionLocal()
    saved = 0
    skipped = 0
    try:
        for i, (question, category, keywords) in enumerate(CURATED_QUESTIONS, start=1):
            existing = _find_existing(db, question)

            print(f"Question {i}/{total}:")
            print(f'  "{question}"')
            if existing:
                print(f"  (already has an answer — current: {existing.answer[:100]!r})")
                print("  Press Enter to keep it, or type a new answer to replace it.")

            print("Your answer:")
            try:
                answer = input("> ").strip()
            except (EOFError, KeyboardInterrupt):
                print("\nStopped early — progress so far is already saved.")
                break

            if not answer:
                if existing:
                    print("  (kept existing answer, unchanged)\n")
                    continue
                confirm = input("  Leave this one blank/skipped? [y/N] > ").strip().lower()
                if confirm != "y":
                    print("  Re-enter the answer:")
                    answer = input("> ").strip()
                if not answer:
                    print("  ✗ Skipped — no empty answer was inserted.\n")
                    skipped += 1
                    continue

            if existing:
                existing.answer = answer
                existing.category = category
                existing.keywords = keywords
                existing.active = True
            else:
                db.add(
                    CuratedAnswer(
                        question=question,
                        answer=answer,
                        category=category,
                        keywords=keywords,
                        source="Manually entered via add_pretrained_answers.py",
                        active=True,
                    )
                )
            db.commit()
            saved += 1
            print("  ✓ Answer saved.\n")
    finally:
        db.close()

    print("-" * 43)
    print(f"{saved + skipped}/{total} QUESTIONS COMPLETED")
    print("-" * 43)
    print(f"Successfully stored: {saved}")
    print(f"Skipped: {skipped}")


if __name__ == "__main__":
    run()
