# Fee Knowledge Base & Curated Answers

How GAT fee/admission data and manually-verified FAQ answers are stored,
added to, and served by the chatbot. Companion to `docs/RAG_ARCHITECTURE.md`
(if present) — this doc covers only what's new, not the existing RAG
pipeline itself.

## 1-2. Where fee data is stored / which table

`fee_information` (Postgres, `backend/app/models/fee_information.py`).
One row per program + fee type + academic year: `program`, `department`,
`fee_type`, `amount` (nullable — `None` means "checked, not publicly
disclosed", never a guess), `currency`, `academic_year`, `quota_category`,
`unit`, `notes`, `source_url`, `source_document`, `last_verified`.

This is the **authoritative** record. The RAG chunks that let the chatbot
retrieve fee answers in natural language are *generated from* these rows,
not authored separately — there is one source of truth.

## 3. How fee data was added

`scripts/db/seed_fee_data.py` — a one-time seed script. All amounts come
from GAT's own official document *"Admission 2026.docx"* (linked from
https://www.gat.ac.in/admission.html as "Fee Structure"), cross-checked
against AICTE's Extension of Approval letter for AY 2026-27. Both were
fetched and verified live. Where no official source publishes an amount
(hostel fee, admission fee, government/KCET-quota tuition), the row is
still inserted with `amount=None` and a note explaining why — never
fabricated.

Re-run any time the fee structure changes for a new academic year:
```bash
python scripts/db/seed_fee_data.py
```
(safe to re-run — replaces rows for the same `academic_year` rather than duplicating)

## 4. How the RAG retrieves fee information

`scripts/ai/ingest_fee_admission_content.py` reads the `fee_information`
rows and the official document's policy text, and writes them into
`data/processed/chunks.jsonl` using the exact same schema
`clean_and_chunk.py` already produces (so `hybrid_retrieval.py`,
`reranker.py`, `confidence.py`, `llm_generator.py` need no changes at
all). One chunk per program (not grouped) so each department's name and
common abbreviation (CSE, ECE, ISE, EEE, AI&ML, AI&DS...) dominates its
own chunk for BM25 matching — testing showed a shared multi-department
chunk lost to generic department marketing pages for short-form queries.

After editing fee data, re-run both steps:
```bash
python scripts/ai/ingest_fee_admission_content.py
python scripts/ai/build_embeddings.py
```

## 5. Where curated answers are stored

`curated_answers` (Postgres, `backend/app/models/curated_answer.py`):
`question`, `answer`, `category`, `keywords`, `source`, `active`.
Manually-authored FAQ records — **not** model training data.

## 6. Running the interactive entry tool

```bash
python scripts/db/add_pretrained_answers.py
```
Walks through every question in `scripts/db/curated_answer_questions.py`
one at a time. Type an answer and press Enter — it's saved to the
database immediately. Press Enter with no text to skip (you'll be asked
to confirm before an empty answer is left out). If a question already has
a stored answer, it's shown first so you can press Enter to keep it or
type a replacement.

## 7. How curated answers are retrieved

`scripts/ai/curated_answers.py`: `find_curated_answer(query)` embeds the
query with the **same** SentenceTransformer model `hybrid_retrieval.py`
already loaded (via `HybridRetriever.embed()` — no second model, no LLM
call) and compares it via cosine similarity against every active curated
question's embedding (cached in memory after first use). Returns the best
match only if similarity ≥ `SIMILARITY_THRESHOLD` (0.55) — otherwise
`None`, so a vaguely-related query does not get a wrong curated answer.

## 8. Fallback priority

Implemented in `scripts/ai/agent_base.py::run_specialist()`, shared by
every specialist agent:

1. **RAG answer** — if `generate_answer()` returns `generation_status ==
   "generated"` with `confidence_level == "HIGH"` and the answer text
   isn't a hedge ("does not mention...", "cannot find..."), it's returned
   as-is. This is the normal, most common case.
2. **Curated answer** — consulted only when (1) didn't produce a
   confident, non-hedging answer. If a stored question matches closely
   enough, its answer is returned (`generation_status: "curated_answer"`).
3. **Existing fallback** — `llm_generator.LOW_CONFIDENCE_MESSAGE` (the
   pipeline's original "I don't have verified information about that at
   the moment. Please contact the GAT admission office..." message),
   unchanged, if neither (1) nor (2) applies.

The chatbot never fabricates a fee amount — verified via a test query
about a nonexistent "Quantum Computing department," which correctly
refused rather than inventing a number.

## 9. Adding more questions later

Edit `scripts/db/curated_answer_questions.py` — append a
`(question, category, keywords)` tuple to `CURATED_QUESTIONS`, then run
`python scripts/db/add_pretrained_answers.py` again. It shows you every
question, old and new; existing ones keep their stored answer unless you
type a replacement.

## 10. Updating an existing curated answer

Run `python scripts/db/add_pretrained_answers.py` — when it reaches a
question that already has an answer, it shows the current one and lets
you type a new one to replace it (Enter alone keeps it unchanged).

## 11. Deleting/deactivating an answer

No CLI flag for this yet — deactivate directly:
```bash
python -c "
import sys; sys.path.insert(0, 'backend')
from app.db.session import SessionLocal
from app.models.curated_answer import CuratedAnswer
db = SessionLocal()
row = db.query(CuratedAnswer).filter(CuratedAnswer.question == 'exact question text').one()
row.active = False   # or: db.delete(row) to remove permanently
db.commit()
"
```
Inactive rows are excluded from `find_curated_answer()`'s matching automatically.

## 12. Verifying the data in the database

```bash
python -c "
import sys; sys.path.insert(0, 'backend')
from app.db.session import SessionLocal
from app.models.fee_information import FeeInformation
from app.models.curated_answer import CuratedAnswer
db = SessionLocal()
print('fee_information rows:', db.query(FeeInformation).count())
print('curated_answers rows:', db.query(CuratedAnswer).count())
db.close()
"
```
Or inspect directly with `psql` against the `fee_information` /
`curated_answers` tables.

## Not verified / could not confirm

- **Government/KCET-quota tuition fees** — set by the Karnataka Fee
  Regulatory Committee / KEA, not published by GAT. Recorded as
  `amount=None` with an explanatory note, not guessed.
- **Hostel fee** and **admission/application processing fee** — GAT
  confirms these exist (hostel for boys/girls, an application process)
  but publishes no specific amount anywhere I could find, including the
  AICTE mandatory-disclosure documents. Recorded as unavailable.
- **A single, general examination fee** — only a narrowly-scoped MBA/M.Tech
  backlog re-registration fee schedule (₹3,500 / ₹5,720) was found in a
  Controller of Examinations notification; not treated as a general
  semester exam fee since that's not what the document says.
