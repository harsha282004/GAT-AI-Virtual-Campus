"""Shared question list for the curated-answer system — read by both
add_pretrained_answers.py (the interactive CLI) and seed_curated_answers.py
(the one-time pre-seed of researched answers).

This list intentionally does NOT restate every question from GAT_Virtual_
Tour_Build_Guide-style brainstorming. Each question here was chosen
because live testing of the current RAG pipeline (scripts/ai/supervisor.py
route()) showed it produced a low-confidence refusal or a weak/vague
answer — see the PR/commit notes for the actual before/after confidence
scores. Questions the RAG already answers well (e.g. "What is the
admission process?", "What documents are required for admission?") are
deliberately NOT duplicated here.

To add more questions later: append a (question, category, keywords)
tuple below, then re-run add_pretrained_answers.py — it always shows you
every question in this list, including ones you've already answered
(letting you review/update), and skips inserting a blank answer.
"""

from __future__ import annotations

# (question, category, keywords) — keywords are just a human-readable
# hint stored alongside the record; matching itself is semantic
# (embedding similarity), not keyword-based.
CURATED_QUESTIONS: list[tuple[str, str, str]] = [
    (
        "What are the admission timings for GAT?",
        "admissions",
        "admission dates, timeline, when to apply, deadlines",
    ),
    (
        "How can I contact the GAT admission office?",
        "admissions",
        "contact, phone number, email, admission office",
    ),
    (
        "Is there an entrance examination required for admission to GAT?",
        "admissions",
        "entrance exam, KCET, COMEDK, PGCET, GATE, KMAT, CMAT",
    ),
    (
        "What undergraduate courses/branches does GAT offer?",
        "academics",
        "UG courses, BE branches, departments, programs offered",
    ),
    (
        "What postgraduate courses does GAT offer?",
        "academics",
        "PG courses, MTech, MBA, MCA",
    ),
    (
        "How much do I need to pay to join GAT?",
        "admissions",
        "overall fee, how much to pay, total cost",
    ),
    (
        "What is the hostel fee at GAT?",
        "admissions",
        "hostel fee, hostel charges, accommodation cost",
    ),
]
