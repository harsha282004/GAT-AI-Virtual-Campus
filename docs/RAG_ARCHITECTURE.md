# RAG Architecture — Phase 1: Knowledge Acquisition, Phase 2: Hybrid Retrieval, Phase 3: Reranking + Confidence, Phase 4: Grounded LLM Generation, Phase 5: Multi-Agent Architecture

This document covers the data acquisition (Phase 1), hybrid retrieval
(Phase 2), retrieval reranking + confidence scoring (Phase 3), grounded LLM
answer generation (Phase 4), and multi-agent supervisor/routing (Phase 5)
pipeline for the Smart Campus Assistant. It is a separate concern from the
360° virtual tour / indoor navigation system (`backend/app/navigation/`,
`frontend/src/features/tour/`) documented in `docs/architecture.md` — none
of these five phases touch any of that code.

## Source authority policy

The knowledge base is built **only** from:

1. Official GAT website pages (`https://www.gat.ac.in/`, same-domain only)
2. Official PDFs/documents linked from the official website
3. Verified campus information supplied manually by the project team

Never used as knowledge sources: Wikipedia, Collegedunia, Shiksha,
Careers360, blogs, third-party college aggregators, search snippets, social
media, or any unverified site. If a fact cannot be traced to one of the
three allowed sources above, it is not included — the pipeline never
fabricates or infers institutional information.

Every chunk in the knowledge base carries its `source_url` (and `page` for
PDFs), so every answer the future LLM layer produces can be traced back to
exactly where it came from.

## Two kinds of knowledge (deliberately kept separate)

| | Institutional knowledge | Spatial/physical knowledge |
|---|---|---|
| Source | Official GAT website + PDFs | Our own verified campus survey |
| Examples | admissions, departments, programs, faculty, facilities, regulations | buildings, floors, rooms, panorama nodes, cross-floor connections |
| `knowledge_category` metadata | `official_institutional` | `official_spatial` (not yet populated) |
| Built by | This pipeline (`scripts/ai/`) | The existing tour/navigation system (`data/campus_graph.json`, PostgreSQL navigation tables) — untouched by Phase 1 |

Phase 1 only ever writes `knowledge_category: "official_institutional"`
chunks. Spatial data already lives in the existing PostgreSQL navigation
schema and is never scraped, invented, or merged into this pipeline.

## Pipeline

```
Official GAT website + PDFs
        ↓ scripts/ai/collect_website.py, collect_pdfs.py
data/raw/{website,pdfs}/         (raw HTML/PDF + per-item metadata)
        ↓ scripts/ai/clean_and_chunk.py
data/processed/chunks.jsonl       (cleaned, deduplicated, metadata-tagged chunks)
        ↓ scripts/ai/build_embeddings.py  (all-MiniLM-L6-v2, sentence-transformers)
ChromaDB (data/chroma_db/, PersistentClient, collection "gat_kb")
        ↓ scripts/ai/test_retrieval.py    (retrieval only — no LLM yet)
Retrieved chunks + sources
```

Run stage-by-stage (each script is independently runnable for debugging),
or all at once via `scripts/ai/run_pipeline.py`.

### Website collection (`collect_website.py`)

Polite, depth-2, same-domain BFS crawl starting at the homepage. Not a
blind crawl — restricted to `gat.ac.in`/`www.gat.ac.in` (explicitly
excludes the third-party `library.gat.ac.in` OPAC subdomain), rejects
asset files, external links, and tracking-parameter duplicates. Rate
limited (~0.6s between requests, one User-Agent identifying the bot).
PDF links encountered during the crawl are recorded (not fetched here) for
the PDF collector stage. Every page's raw HTML + a metadata sidecar
(source URL, title, collection date) is written to `data/raw/website/`,
and the source manifest is updated.

### PDF collection (`collect_pdfs.py`)

Downloads every official-domain PDF link discovered during the website
crawl (never a third-party PDF — every link was already verified to
resolve to `gat.ac.in`). Extracts per-page text via `pypdf`. A 15MB
per-file size cap guards against pathological files. Failures (broken
link, corrupt PDF, oversized file) are logged and skipped — never
fabricated.

### Cleaning + chunking (`clean_and_chunk.py`)

Website HTML: strips `<nav>/<header>/<footer>/<script>/<style>` and any
element whose class/id hints at navigation/cookie-banner/sidebar
boilerplate, via BeautifulSoup. Preserves headings, list items, and
table cell text verbatim — no paraphrasing of institutional content.
Tracks the nearest preceding heading as each resulting chunk's `section`.

PDF text: strips lines that repeat across more than half of a document's
pages (running headers/footers), then chunks per page so `page` metadata
stays exact.

Chunking uses `langchain_text_splitters.RecursiveCharacterTextSplitter`
(chunk size 800 chars, 120 char overlap). Chunks are deduplicated by a
SHA-256 fingerprint of normalized text — the first occurrence of any exact
duplicate wins, later ones are dropped and counted. Pages/documents with no
meaningful content after cleaning (including scanned/image-only PDFs with
zero extractable text) are skipped and recorded as `failed` in the
manifest with an explanatory error — never silently dropped, never
fabricated.

Every chunk carries: `chunk_id`, `text`, `source_url`, `source_title`,
`source_type` (`official_website` | `official_pdf`), `section`, `page`,
`document_name`, `department` (best-effort, from URL pattern matching for
department-specific pages), `collection_date`, `knowledge_category`.

### Embeddings + ChromaDB (`build_embeddings.py`)

Embedding model: **`all-MiniLM-L6-v2`** via `sentence-transformers`,
loaded and run locally (no external API). Chunk IDs are deterministic
(derived from `source_url` + index), so re-running the pipeline updates
existing ChromaDB records via `upsert` rather than duplicating them.

Storage: `chromadb.PersistentClient` at `data/chroma_db/` (matches
`CHROMA_PERSIST_DIR` in `backend/app/core/config.py` / `.env.example`),
collection name `gat_kb` (`CHROMA_COLLECTION_NAME`). This is **not**
in-memory — it survives backend restarts, application restarts, and
machine restarts, since it's a directory on disk.

### Retrieval test (`test_retrieval.py`)

Embeds each test query with the same `all-MiniLM-L6-v2` model, queries
ChromaDB for the top-k nearest chunks, and prints source URL, section/page,
similarity score, and text preview for each. Deliberately does **not**
call an LLM — this stage proves retrieval quality in isolation, before any
generation layer exists. LLM-based answer generation is Phase 3, not
implemented here.

### Quality report (`quality_report.py`)

Reads `data/metadata/source_manifest.json`, `data/processed/chunks.jsonl`,
and the live ChromaDB collection to print pages/PDFs collected vs. failed,
chunk/duplicate counts, and ChromaDB record count — the Step 12
verification numbers.

## Source manifest

`data/metadata/source_manifest.json` is the machine-readable proof of
where every piece of knowledge came from. One entry per source URL/document,
updated incrementally as it moves through the pipeline
(`collected → chunked → embedded`, or `failed` with an error message at any
stage). Fields: `source_url`, `title`, `source_type`, `collection_date`,
`status`, `chunk_count`, `errors`.

## Directory layout

```
data/
├── raw/
│   ├── website/     # <slug>.html + <slug>.meta.json per page
│   └── pdfs/         # <slug>.pdf + <slug>.meta.json + <slug>.pages.json per document
├── processed/
│   └── chunks.jsonl  # one JSON object per line, ready for embedding
├── metadata/
│   └── source_manifest.json
├── logs/
│   └── <stage_name>.log   # one log file per pipeline stage
└── chroma_db/         # ChromaDB persistent store (gitignored, like venv/node_modules)
```

## What Phase 1 deliberately does not do

- No LLM-based answer generation (Phase 3).
- No hybrid/BM25 retrieval (Phase 2, see below).
- No spatial/navigation data acquisition — that already exists in the
  navigation PostgreSQL schema and is out of scope here.
- No changes to the 360° tour, panorama viewer, cross-floor hotspots, or
  any existing navigation code/API.

---

# Phase 2 — Hybrid Retrieval

## Why hybrid retrieval

Dense (embedding-based) retrieval alone finds passages that mean the same
thing as the query, even without shared vocabulary — good for paraphrased
or conceptual questions. But it can miss passages that are the exact right
answer purely because their phrasing drifts semantically from the query,
and it has no notion of exact term matches (department codes, acronyms
like "VTU"/"KCET", exact facility names).

Lexical (BM25) retrieval is the opposite: it rewards exact keyword overlap
regardless of meaning, which is precisely why it's useful for named-entity
and acronym-heavy campus queries, but on its own it easily surfaces
keyword-coincidental noise. Confirmed empirically in this codebase's own
Phase 2 test run: for the query *"Where is the college located?"*, BM25-only
retrieval's top hit was a Women Empowerment Cell PDF (it shares the word
"college" and other incidental terms), while dense and hybrid retrieval
both correctly surfaced the campus address document
(`documents/12B.pdf`) first. Combining both signals is what makes campus
Q&A reliable across both phrasing styles.

## Dense semantic retrieval (`hybrid_retrieval.py::HybridRetriever.dense_search`)

Reuses, unchanged: the same `all-MiniLM-L6-v2` model and the same
persistent ChromaDB `gat_kb` collection built in Phase 1. A query is
embedded with the same model/normalization used at index time, then
`collection.query()` returns the nearest chunks by cosine distance;
`semantic_score = 1 - distance`. No second collection, no re-embedding of
the corpus.

## BM25 lexical retrieval (`hybrid_retrieval.py::HybridRetriever.bm25_search`)

Built with `rank_bm25.BM25Okapi` over the exact same
`data/processed/chunks.jsonl` chunks used to build the ChromaDB embeddings
(loaded via `build_embeddings.load_chunks()` — one shared loader, not a
second dataset). Tokenization is a simple lowercase alphanumeric
regex-split (`[a-z0-9]+`) — no stemming or stopword removal, so technical
terms (department codes, acronyms, numbers) survive intact. The BM25 index
is built once per process (`HybridRetriever.__init__`) and reused across
queries.

## Score normalization

Dense (cosine similarity, effectively bounded ~[0, 1]) and BM25 (unbounded,
corpus- and query-dependent magnitude) scores are not comparable on their
raw scales. Each method's own top-N candidate set is independently
min-max normalized to [0, 1] before fusion — normalizing per-method (not
globally, and not over the union) is what makes a fixed weighted sum
meaningful across arbitrary queries. If a candidate appears in only one
method's candidate set, its normalized score for the *other* method is
explicitly `0.0` (not omitted, not estimated) — an "absent" score has a
well-defined value distinct from a raw score of `None` ("not computed by
that method at all").

## Weighted score fusion

```python
DENSE_WEIGHT = 0.6
BM25_WEIGHT = 0.4

hybrid_score = DENSE_WEIGHT * normalized_semantic_score + BM25_WEIGHT * normalized_bm25_score
```

Both weights are module-level constants in `hybrid_retrieval.py` (also
overridable per-call via `hybrid_search(..., dense_weight=, bm25_weight=)`)
— retuning the balance never requires touching the fusion logic itself.
Candidates are the union of each method's top-`candidate_n` (default 20)
results, keyed by `chunk_id`; the fused list is sorted by `hybrid_score`
descending and truncated to `top_k` (default 5).

## Top-K selection and result format

`HybridRetriever.hybrid_search(query, top_k=...)` returns a list of dicts:

```json
{
  "chunk_id": "...",
  "text": "...",
  "source_url": "...",
  "source_title": "...",
  "page": null,
  "semantic_score": 0.502501,
  "bm25_score": 7.688857,
  "normalized_semantic_score": 1.0,
  "normalized_bm25_score": 1.0,
  "hybrid_score": 1.0
}
```

`text`/`source_url`/`source_title`/`page` are read straight from the
Phase 1 chunk record (`chunks.jsonl`, the same record embedded into
ChromaDB) — never fabricated. `page` is `null` for website-sourced chunks,
exactly as Phase 1 stored it.

## Source traceability

`scripts/ai/test_hybrid_retrieval.py` runs a corpus-wide audit
(`run_traceability_audit`) over all chunks for: missing `source_url`,
missing/empty `text`, missing `chunk_id`, duplicate `chunk_id`s, and
missing `source_title`. As of the last Phase 2 test run: **0** issues found
across all 1,488 chunks. Every hybrid test-query result also carries a
non-empty `source_url`.

## Retrieval comparison (dense-only vs. BM25-only vs. hybrid)

`scripts/ai/test_hybrid_retrieval.py` runs 6 realistic GAT questions
through all three retrieval modes and reports the top-3 overlap between
hybrid and each individual method, using real (not manipulated) retrieval
output. Observed pattern: hybrid results track dense retrieval's semantic
relevance closely while pulling in BM25's higher-precision exact-term
matches when they're actually present (e.g. "What undergraduate programs
are offered?" — BM25 and dense agree, hybrid's top hit is boosted to
score 1.0). When BM25 alone drifts toward keyword-coincidental noise
(compliance/NIRF PDFs matching on generic terms like "facilities" or
"cell"), hybrid's dense component keeps the top results anchored to
genuinely relevant chunks — this is the concrete benefit hybrid retrieval
provides over either method alone for campus queries.

## What Phase 2 deliberately does not do

- No LLM-based answer generation, no Ollama call (Phase 3).
- No reranking model / cross-encoder / SVM (Phase 3, see below).
- No confidence scoring or hallucination detection layer (Phase 3).
- No multi-agent/Supervisor routing.
- No changes to `data/processed/chunks.jsonl`, `data/chroma_db/`, or any
  other Phase 1 artifact — Phase 2 only reads them.
- No changes to the 360° tour, panorama viewer, cross-floor hotspots, or
  any existing navigation code/API.

---

# Phase 3 — Retrieval Reranking and Confidence

## Why reranking is required

Hybrid fusion (Phase 2) ranks purely on `hybrid_score` — a weighted
combination of normalized semantic and BM25 scores. It has no notion of
whether a candidate actually contains the query's terms verbatim, how much
of the query's vocabulary a chunk covers, or whether the chunk is
substantial enough to be useful on its own. Reranking adds a second pass
over hybrid's already-strong top-N candidates using signals hybrid_score
doesn't see directly — precision refinements, not a wholesale re-search.

## Phase 2 recap (unchanged, reused as-is)

`reranker.py` and `confidence.py` both import and call
`hybrid_retrieval.HybridRetriever`/`hybrid_search()` directly — no
duplicate retrieval implementation, no second ChromaDB collection, no
second BM25 index. Phase 3 only ever consumes Phase 2's output dicts
(`chunk_id`, `text`, `source_url`, `source_title`, `page`, `semantic_score`,
`bm25_score`, `hybrid_score`, `normalized_*`) — it does not modify Phase 2
code, `chunks.jsonl`, or the ChromaDB collection.

## Reranking features (`reranker.py::extract_features`)

Seven deterministic, inspectable features per (query, candidate) pair —
nothing learned, nothing fabricated:

| Feature | Meaning |
|---|---|
| `hybrid_score` | Phase 2's fused score, read straight from the candidate |
| `semantic_score` | Phase 2's raw dense cosine similarity |
| `bm25_score` | Phase 2's raw BM25 score |
| `lexical_overlap` | count of unique query tokens also present in the chunk |
| `query_term_coverage` | `lexical_overlap / unique query token count`, in [0, 1] |
| `length_score` | `min(1, len(chunk text) / 400 chars)` — penalizes fragment-like chunks |
| `exact_phrase_match` | 1.0 if the whole (tokenized) query appears verbatim in the chunk, else 0.0 |

## SVM reranking architecture — IMPLEMENTED vs. FUTURE TRAINING

**IMPLEMENTED:** `reranker.py::SVRReranker` wraps `sklearn.svm.SVR` with
working `fit()`, `predict()`, `save()`, `load()` methods. `Reranker.__init__`
always tries to load a trained model from `data/models/reranker_svr.joblib`
first, and only falls back to the heuristic path if that file doesn't
exist. `fit()` refuses fewer than 10 labelled examples, specifically to
prevent someone later calling it with a handful of made-up scores and
mistaking that for a real trained model.

**NOT DONE, AND NOT CLAIMED:** No labelled (query, chunk) → human relevance
judgment dataset exists anywhere in this repository. `SVRReranker` has
therefore **never been fit** in this codebase — `Reranker.mode` is
`"heuristic_fallback"` for every query today, and every reranked result
carries `rerank_mode: "heuristic_fallback"` so this is never silently
misrepresented as a trained model's output.

**Actual scoring path in use today** (`reranker.py::heuristic_rerank_score`):
a fixed weighted sum over already-[0,1]-bounded features —

```python
HEURISTIC_WEIGHTS = {
    "hybrid_score": 0.55,
    "query_term_coverage": 0.25,
    "exact_phrase_match": 0.10,
    "length_score": 0.10,
}
```

`hybrid_score` anchors the score (it already encodes Phase 2's fused
semantic+lexical signal); the remaining weight goes to precision features
hybrid_score doesn't capture directly. `semantic_score`/`bm25_score`/
`lexical_overlap` are computed and reported (per Step 2's required feature
list) but deliberately excluded from the weighted sum itself, since they're
on unnormalized, method-specific scales — using their already-normalized
counterparts (`hybrid_score`, `query_term_coverage`) is what keeps a fixed
linear combination meaningful, the same reasoning Phase 2 uses for score
fusion.

**Future training path:** once a labelled dataset exists (e.g. from
Phase 7's eval judge, or manual relevance annotation), call
`SVRReranker.fit(feature_dicts, relevance_labels)` and `.save()` — the next
`Reranker()` instantiation picks it up automatically, no code change
required.

## Final ranking pipeline

```
User Query
    ↓
Dense ChromaDB Retrieval  +  BM25 Retrieval        (hybrid_retrieval.py, Phase 2)
    ↓
Hybrid Score Fusion → Top-N Candidates              (Phase 2, N=20 default)
    ↓
Feature Extraction                                  (reranker.py::extract_features)
    ↓
Reranking (heuristic fallback today)                (reranker.py::Reranker.rerank)
    ↓
Final Top-K Context
```

Every result out of `Reranker.rerank()` preserves every Phase 2 field
(`chunk_id`, `text`, `source_url`, `source_title`, `page`, `semantic_score`,
`bm25_score`, `hybrid_score`) plus `rerank_score`, `rerank_mode`, and
`ranking_features` (the full feature dict) — nothing is dropped, and no
result is ever missing its source.

## Confidence score (`confidence.py::compute_confidence`)

```python
confidence = 0.4 * intent_component + 0.6 * retrieval_component
```

**`retrieval_component`** (`confidence.py::_retrieval_component`): `0.7 *
top1_rerank_score + 0.3 * agreement`, where `agreement` discounts `top1`
by how far the 2nd/3rd reranked results trail it — a lone high scorer
surrounded by much weaker results is treated as marginally less reliable
than the same top1 score backed by close runners-up. Bounded to [0, 1]
since `rerank_score` already is.

**`intent_component`** — documented placeholder, not fabricated: this
project's intent classifier (CLAUDE.md's Phase 3 — `backend/app/
intent_model/`, a PyTorch LSTM) does not exist yet. `compute_confidence()`
accepts `intent_probability: float | None` as the real interface for that
future component; passing a real P(intent) uses it directly and tags
`intent_source: "classifier"`. Until then (today, always), `None` triggers
a documented fallback (`confidence.py::_intent_component`) that reuses
`retrieval_component` itself as a conservative stand-in, tagged
`intent_source: "retrieval_fallback (no intent classifier implemented
yet)"` — so this is never confused with a real intent probability once the
LSTM classifier lands.

### Confidence thresholds — derived empirically, not chosen a priori

Computed confidence for the 6 in-domain GAT test questions plus 3
deliberately out-of-domain questions ("What is the population of
Bangalore?", "What is the capital of France?", "How do I bake a chocolate
cake?") via `scripts/ai/test_reranking_confidence.py`, and set the
thresholds from the actual observed clusters:

| Query | Confidence | Category |
|---|---|---|
| What undergraduate programs are offered at GAT? | 0.6907 | HIGH |
| What is the admission process? | 0.6466 | HIGH |
| What facilities are available on the campus? | 0.6747 | HIGH |
| Where is the college located? | 0.6410 | HIGH |
| What departments are available at GAT? | 0.5159 | MEDIUM |
| What is the official contact information? | 0.4827 | MEDIUM |
| What is the population of Bangalore? (unrelated) | 0.4538 | LOW |
| What is the capital of France? (unrelated) | 0.4687 | LOW |
| How do I bake a chocolate cake? (unrelated) | 0.4392 | LOW |

```python
HIGH_CONFIDENCE_THRESHOLD = 0.58     # gap observed between 0.5159 and 0.6410
MEDIUM_CONFIDENCE_THRESHOLD = 0.48   # gap observed between 0.4687 and 0.4824
```

Result: **100% of the 3 out-of-domain queries scored LOW**, and **100% of
the 6 in-domain queries scored MEDIUM or HIGH** (none misclassified as
LOW) — the two MEDIUM in-domain queries ("departments", "contact
information") have real relevant content, just spread across many
similar-scoring chunks rather than one standout match, so MEDIUM (not
LOW, not HIGH) is the honest read.

**Caveat, documented rather than hidden:** these thresholds are fitted to
one 9-query sample, not a statistically validated boundary — expect to
revisit them once real user queries or a labelled eval set (Phase 7-style)
are available.

## Retrieval-only architecture — why LLM generation is intentionally excluded

`scripts/ai/test_reranking_confidence.py`, like Phase 1/2's test scripts,
never calls Ollama or any LLM. Reranking and confidence scoring are
evaluated purely on retrieval output, so retrieval quality can be measured
and debugged in isolation before a generation layer (Phase 3 of CLAUDE.md's
build guide, not this document's Phase 3) sits on top of it and makes
failures harder to attribute.

## What Phase 3 deliberately does not do

- No Ollama call, no Llama 3.2, no LLM-based answer generation.
- No trained SVM — `SVRReranker` is real, working infrastructure, but has
  never been fit on real labelled data (see above).
- No multi-agent/Supervisor/admissions/academics/facilities/navigation
  agents.
- No voice assistant, no frontend/chat UI changes.
- No changes to PostgreSQL schema, panoramas, cross-floor hotspots,
  navigation, or the 3D map.
- No changes to Phase 1 or Phase 2 code/data — Phase 3 only reads their
  output.

---

# Phase 4 — Grounded LLM Answer Generation

## Architecture

```
User Question
    ↓
Hybrid Retrieval (Phase 2, hybrid_search)
    ↓
Reranking (Phase 3, rerank)
    ↓
Confidence Scoring (Phase 3, compute_confidence)
    ↓
Relevant Context (reranked chunks + confidence)
    ↓
LLM (Ollama, via LangChain)                      <- Phase 4, this section
    ↓
Grounded Campus Answer + Source/Provenance Info
```

`scripts/ai/llm_generator.py` is the only new code in this phase. It
imports and calls `hybrid_retrieval.hybrid_search`, `reranker.rerank`, and
`confidence.compute_confidence` exactly as Phases 2-3 left them — no
retrieval, reranking, or confidence logic is duplicated or modified.
`answer_question(query)` wires the full diagram above end to end;
`generate_answer(query, retrieved_context, confidence)` is the lower-level
entry point for callers that already have Phase 2/3 output in hand.

## Ollama integration

LLM calls go through `langchain_ollama.ChatOllama` — per the project's
approved stack (CLAUDE.md: *"LLM ... called via LangChain — local, no
external API key"*). No OpenAI call, no other paid/external API, and no
GAT data is ever sent anywhere but the local Ollama process. `ollama` and
`langchain-ollama` were already in `requirements.txt` from before this
phase (added when the stack was first approved) — **no new dependency was
needed**.

`OLLAMA_BASE_URL`/`OLLAMA_MODEL` reuse the same environment variable names
`backend/app/core/config.py` already defines, so one `.env` value can
drive both the future backend and these scripts consistently.

## llama3.2's role

This phase's preferred model is **`llama3.2`** (the module's own default,
distinct from `backend/app/core/config.py`'s existing `"llama3"` default —
overridable by either the `OLLAMA_MODEL` env var or `answer_question(...,
model=...)`). `llm_generator.check_ollama_availability()` probes the local
Ollama service directly (`ollama.Client(...).list()`) before ever
attempting generation, and reports one of three states rather than
guessing or silently substituting a different model:

1. Ollama unreachable at all (`reachable: False`)
2. Ollama reachable, but `llama3.2` not pulled (`model_available: False`)
3. Ollama reachable and `llama3.2` available

**As tested in this development environment: state 1.** No Ollama
installation was found on this machine (no `ollama` binary on PATH, no
service listening on `:11434`) — see TEST RESULTS below. This is reported
plainly, not worked around.

## Prompt grounding strategy

A fixed system prompt (`llm_generator.SYSTEM_PROMPT`) instructs the model
to: answer only from the supplied CONTEXT; never invent GAT facts
(faculty, phone numbers, departments, fees, timings, locations, rules,
courses, facilities); state explicitly when the CONTEXT doesn't support a
confident answer rather than guessing; combine multiple context passages
carefully without contradiction; and never surface internal details
(chunk IDs, scores) to the end user. Context passages are numbered and
labeled with their source title before being handed to the model, so the
model has provenance available even though the code layer — not the
model's own text — is what ultimately builds the `sources` field (see
below).

## Context flow

`_build_context_block()` formats each reranked chunk as `[N] (Source:
<source_title>)\n<chunk text>` and joins them; `_build_sources()`
separately extracts `{title, source_url, page}` straight from each
chunk's own Phase 2/3 metadata. These two are independent — the `sources`
list returned to the caller is **never** parsed out of the LLM's generated
text, so a citation cannot appear unless it traces back to an actual
retrieved chunk (Step 4's "do not fabricate citations" requirement).

## Confidence-aware generation

Reuses Phase 3's `compute_confidence()` output as-is — no new confidence
math in this phase:

- **HIGH** — normal grounded generation via Ollama.
- **MEDIUM** — generation proceeds, but `MEDIUM_CONFIDENCE_ADDENDUM` is
  appended to the system prompt, explicitly telling the model to hedge
  rather than guess if it isn't sure the context answers the question.
- **LOW** — the LLM is **not called at all**. `generate_answer()` returns
  a fixed `LOW_CONFIDENCE_MESSAGE` directly. This is deliberate: low
  confidence means Phase 3's retrieval-quality signal already indicated
  the evidence is too weak to trust, so asking the model to "try anyway"
  would just relocate the risk of an unsupported answer from retrieval
  into generation rather than removing it. Best-available sources (if any
  exist) are still returned alongside the refusal, clearly not asserted as
  the answer.

## Source traceability

Every `generate_answer()`/`answer_question()` result includes a `sources`
list built solely from retrieved-chunk metadata (`title`, `source_url`,
`page`), even on refusal/failure paths — so `question -> retrieved chunk
-> source document -> generated answer` stays inspectable end to end,
which is the whole point for demonstrating RAG groundedness. Observed in
testing: 0 results with a missing `source_url` across all 5 test queries
(see TEST RESULTS).

## Error handling

`generate_answer()` never raises past its own boundary — every failure
mode returns a typed `generation_status` instead of throwing or returning
a fabricated answer:

| `generation_status` | Meaning |
|---|---|
| `generated` | LLM call succeeded; `answer` is real model output |
| `low_confidence_refusal` | Confidence was LOW; LLM was never called |
| `no_context` | Retrieval returned nothing at all |
| `ollama_unreachable` | Ollama service not reachable (see below — this is the state observed in this dev environment) |
| `model_unavailable` | Ollama reachable, but the preferred model isn't pulled |
| `generation_failed` | Ollama reachable and model available, but the actual generation call raised (timeout, malformed response, etc.) |

## Test methodology

`scripts/ai/test_llm_generation.py` runs `answer_question()` end to end
(no mocking) for: three relevant/institutional questions (A-C), one
deliberately unrelated question (D — "What is the capital of France?"),
and one question chosen to plausibly retrieve only thin evidence (E). Case
F (Ollama-unavailable) is not separately simulated — it's the real,
observed result of every A/B/C/E call in this environment, reported
explicitly rather than staged. A corpus-wide traceability audit (reused
from `test_hybrid_retrieval.py`) runs at the end, unaffected by anything
in this phase.

### Actual results from the last run

| Case | Confidence | Category | `generation_status` | Grounded |
|---|---|---|---|---|
| A: undergraduate programs | 0.6907 | HIGH | `ollama_unreachable` | No (Ollama down) |
| B: departments | 0.5615 | MEDIUM | `ollama_unreachable` | No (Ollama down) |
| C: facilities | 0.6747 | HIGH | `ollama_unreachable` | No (Ollama down) |
| D: capital of France (unrelated) | 0.4687 | LOW | `low_confidence_refusal` | No (correctly refused) |
| E: hostel mess menu (thin-evidence candidate) | 0.6748 | HIGH | `ollama_unreachable` | No (Ollama down) |

Note case E actually retrieved HIGH confidence (real Hostel Management Cell
PDFs exist and matched reasonably well) — reported honestly rather than
replaced with a cherry-picked query that would score LOW, per the "do not
artificially manipulate results" requirement carried over from Phase 2/3.
The unrelated question (D) is the one case that didn't need Ollama at all
to demonstrate safety: confidence scoring alone correctly identified it as
LOW and the pipeline refused before ever reaching the LLM step.

Traceability: 0 of 5 results had a missing `source_url`; the full-corpus
audit found 0 issues across all 1,488 chunks.

## Limitations

- **Ollama is not installed in this development environment** — confirmed
  via `check_ollama_availability()` (`ConnectionError`), no `ollama`
  binary on PATH, nothing listening on `:11434`. This phase's actual
  `generated` code path (a real successful LLM call) has therefore **not
  been exercised end to end** — only every other path has (refusal,
  unreachable-service handling, source assembly, prompt construction).
  Installing/running Ollama and pulling `llama3.2` is required before this
  gap can be closed, and is intentionally left for the project owner to
  do rather than attempted automatically by this phase's implementation.
- The MEDIUM-confidence "hedge" instruction is a prompt-level request to
  the model, not a verified/enforced behavior — nothing currently checks
  that the model actually complied.
- No hallucination detector exists; grounding is enforced by prompt
  instructions and by never showing the model ungrounded content, not by
  post-hoc fact-checking the model's output against the context.
- No intent classifier exists yet (unchanged from Phase 3) — confidence's
  `intent_component` is still the documented retrieval-based fallback, not
  a real P(intent).
- No conversation/session history — each `answer_question()` call is
  independent, matching Phase 1-3's stateless retrieval testing.

## What Phase 4 deliberately does not do

- No fine-tuning or training of llama3.2 — Ollama serves the stock
  pulled model as-is.
- No fabricated training/eval datasets.
- No multi-agent/Supervisor routing, no admissions/academics/facilities/
  navigation agents.
- No voice assistant, no frontend/chat UI changes.
- No changes to PostgreSQL schema, panoramas, cross-floor hotspots,
  navigation, or the 3D map.
- No changes to Phase 1-3 code or data — Phase 4 only reads their output.
- No OpenAI or other paid/external LLM API, ever.

---

# Phase 5 — Multi-Agent Architecture

## Architecture

```
                    USER QUERY
                         |
                         v
                SUPERVISOR (supervisor.py::route)
                         |
     classify() -> (agent_name, reason)   <- deterministic, rule-based
                         |
          +--------------+-----------------+-----------------+
          |               |                 |                 |
          v               v                 v                 v
  admission_agent  academic_agent   facilities_agent   navigation_agent
          |               |                 |                 |
          +---------------+-----------------+-----------------+
                         |                            general_agent
                         v                          (also the default
              agent_base.run_specialist()             fallback when no
           (Phase 2 retrieval -> Phase 3            domain keywords match)
          reranking -> Phase 3 confidence ->
           Phase 4 grounded generation)
                         |
                         v
        Agent Response Contract (grounded answer + sources)
```

Every specialist agent module (`admission_agent.py`, `academic_agent.py`,
`facilities_agent.py`, `navigation_agent.py`, `general_agent.py`) is a
thin wrapper: `AGENT_NAME` constant + `handle(query) -> dict`, calling
`agent_base.run_specialist(AGENT_NAME, query)`. All five call the
identical Phase 2-4 pipeline through one shared function — no
retrieval/reranking/confidence/generation logic is duplicated per agent,
per the Phase 5 instruction.

## Supervisor Agent (`supervisor.py`)

`route(query)` does exactly two things: call `classify(query)` to pick an
agent name + a human-readable reason, then call that agent's `handle()`
and attach the routing metadata to its result. The Supervisor never
retrieves, never reranks, never scores confidence, and never calls the
LLM — it has no code path that could bypass the confidence gate, because
it never reaches the LLM directly at all.

## Specialized agents

| Agent | Handles |
|---|---|
| `admission_agent` | admission process, eligibility, application info, UG/PG admission |
| `academic_agent` | departments, courses/programs, curriculum, academic info |
| `facilities_agent` | laboratories, classrooms, auditorium, library, hostel, canteen, transport, gym |
| `navigation_agent` | building/floor/room locations, campus navigation requests |
| `general_agent` | institution info, contact info, and the default fallback for anything unmatched |

## Routing mechanism — read before assuming otherwise

**This is a deterministic, rule-based (keyword/phrase) router. It is
explicitly NOT a trained intent classifier.** `classify()` first checks a
list of high-specificity navigation phrases ("where is", "how can i
reach", "which floor", ...); if none match, it scores each domain's
keyword list against the query and picks the highest-scoring domain,
defaulting to `general_agent` when nothing matches at all. Every decision
is a literal substring match, logged in a human-readable reason string —
fully explainable, fully reproducible, zero randomness.

No labelled query→intent training dataset exists in this repository. This
is the same honesty standard Phase 3 applied to `SVRReranker` (real
infrastructure, never fit on fabricated data): rather than dressing up
keyword matching as "a trained model," it's documented plainly as what it
is. CLAUDE.md's planned LSTM intent classifier
(`backend/app/intent_model/`) remains unbuilt — see FUTURE IMPROVEMENTS
below.

**Honest routing-accuracy note:** the Phase 5 test spec lists "What
undergraduate programs are offered?" under its "ADMISSION" test category,
but the query contains no admission-process vocabulary — "program" is
naturally academic-domain content. The router places it in
`academic_agent`, and this is reported as-is rather than special-cased to
force a match to the spec's section heading. Both agents run the
identical grounded pipeline, so this only affects the routing *label*
attached to the response, not the answer's quality or grounding.

## Integration with existing RAG

`agent_base.run_specialist()` is the single call site for the whole
pipeline: `hybrid_retrieval.hybrid_search()` (Phase 2, unmodified) ->
`reranker.rerank()` (Phase 3, unmodified) ->
`confidence.compute_confidence()` (Phase 3, unmodified) ->
`llm_generator.generate_answer()` (Phase 4, unmodified, including its own
LOW-confidence short-circuit and Ollama-failure handling). No Phase 2-4
file was edited to build Phase 5.

## Agent Response Contract

Every agent's `handle()` returns:

```json
{
  "original_query": "...",
  "selected_agent": "admission_agent",
  "agent_reason": "matched admission_agent keywords ['admission']",
  "retrieved_context": [{"chunk_id": "...", "source_title": "...", "source_url": "...", "page": null, "hybrid_score": 0.6, "rerank_score": 0.55}],
  "confidence_score": 0.6466,
  "confidence_level": "HIGH",
  "generation_status": "generated",
  "answer": "...",
  "sources": [{"title": "...", "source_url": "...", "page": null}],
  "source_urls": ["https://www.gat.ac.in/admission.html", "..."],
  "refusal_reason": null,
  "grounded": true
}
```

(`navigation_agent` adds one extra field, `navigation_hint` — see below.)
`refusal_reason` is derived from Phase 4's existing `generation_status`
values (`low_confidence_refusal`, `no_context`, `ollama_unreachable`,
`model_unavailable`, `generation_failed`) via a fixed lookup table in
`agent_base.py` — no new status values were invented, and `None` on the
happy path (`generation_status == "generated"`).

## Confidence gating — preserved, not reimplemented

The confidence gate lives entirely inside `llm_generator.generate_answer()`
(Phase 4) — LOW confidence skips the LLM call and returns the fixed safe
refusal message; the Supervisor and every specialist agent just pass that
result through untouched. Verified in testing: both UNRELATED test
questions ("What is the capital of France?", "Who won the FIFA World
Cup?") scored LOW confidence and correctly produced
`generation_status: "low_confidence_refusal"` without an LLM call — 2/2.

## Llama 3.2 usage

Unchanged from Phase 4: `ChatOllama` via LangChain, model `llama3.2`.
`agent_base.py` defines its own `DEFAULT_AGENT_MODEL = "llama3.2"`
constant rather than importing `llm_generator.OLLAMA_MODEL`, for the same
reason `test_llm_generation.py` needed an explicit override in Phase 4:
this project's pre-existing `.env` sets `OLLAMA_MODEL=llama3` (a legacy
value from before Phase 4 existed), which would otherwise silently shadow
`llama3.2` — the model actually pulled and confirmed working
(`ollama list` -> `llama3.2:latest`).

## Navigation adapter — integration point only, not a working connection

`navigation_agent.py::NavigationAdapter.resolve(query)` returns a fixed
`{"status": "not_yet_integrated", ...}` dict documenting exactly what a
real integration would call: the existing
`backend/app/navigation/pathfinding.py` / `building_search.py` /
`room_search.py` / `nearby.py` modules, or the deployed
`/api/v1/navigate`-family HTTP endpoints. It does not import, call, wrap,
or duplicate any of that code — `scripts/ai/` does not import `backend/`
(established in Phase 1's audit), and Phase 5 explicitly forbids
rewriting A*, the navigation graph, or touching hotspot/panorama
navigation. The navigation *agent* still answers navigation-flavored
questions via the normal grounded RAG pipeline (the KB does contain some
location text, e.g. the campus address), and honestly says so when it
doesn't have enough information (see test results below) — only the
*adapter* to the indoor pathfinding system is a stub.

## Test methodology

`scripts/ai/test_multi_agent.py` runs `supervisor.route()` over all 12
questions from the Phase 5 spec's 6 categories (Admission, Academic,
Facilities, Navigation, General, Unrelated), with no mocking — every call
reaches the real ChromaDB collection, the real BM25 index, and the real
`llama3.2` model. For each: verifies routing against that domain's own
keyword semantics, confirms non-empty retrieved context, confirms every
source has a `source_url`, and (for the 2 unrelated questions) confirms
`generation_status == "low_confidence_refusal"`.

### Actual results from the last run

| Category | Query | Agent | Confidence | Status |
|---|---|---|---|---|
| ADMISSION | What is the admission process? | admission_agent | HIGH | generated |
| ADMISSION (see note) | What undergraduate programs are offered? | academic_agent | MEDIUM | generated |
| ACADEMIC | What departments are available? | academic_agent | MEDIUM | generated |
| ACADEMIC | What courses are offered? | academic_agent | HIGH | generated |
| FACILITIES | What facilities are available on campus? | facilities_agent | HIGH | generated |
| FACILITIES | Is there an indoor gym? | facilities_agent | MEDIUM | generated |
| NAVIGATION | Where is the main building? | navigation_agent | MEDIUM | generated |
| NAVIGATION | How can I reach the second floor? | navigation_agent | LOW | low_confidence_refusal |
| GENERAL | What is Global Academy of Technology? | general_agent | HIGH | generated |
| GENERAL | What is the official contact information? | general_agent | MEDIUM | generated |
| UNRELATED | What is the capital of France? | general_agent | LOW | low_confidence_refusal |
| UNRELATED | Who won the FIFA World Cup? | general_agent | LOW | low_confidence_refusal |

**routing correct: 12/12 · retrieval performed: 12/12 · sources
traceable: 12/12 · unrelated queries safely refused: 2/2.**
Corpus-wide traceability audit: 1,488 chunks checked, 0 issues.

Notable, honestly-reported observations (not manipulated to look better):
- "Is there an indoor gym?" -> `facilities_agent` correctly answered
  "Yes... the campus has an 'Indoor Gym'" grounded in the campus
  brochure, a clean example of a specific, correctly-grounded factual
  answer.
- "What departments are available?" -> the model explicitly said the
  CONTEXT does *not* provide a comprehensive department list and named
  only the two it could actually support from retrieved text (Mechanical,
  Electrical) rather than inventing the rest — correct grounding
  discipline even though it makes the answer incomplete.
- "How can I reach the second floor?" -> retrieval genuinely scored LOW
  confidence for this specific phrasing, and the pipeline correctly
  refused rather than attempting a directional answer it can't support —
  demonstrating the confidence gate works for navigation queries exactly
  as it does for every other domain.
- "Where is the main building?" -> `navigation_agent` reached MEDIUM
  confidence and *did* call the LLM, which then honestly reported the
  retrieved context doesn't actually specify the building's location —
  another case of the generation-layer grounding rule catching what
  confidence scoring alone rated as "worth attempting."

## Source traceability

Preserved end to end, unchanged from Phase 4: every `sources`/`source_urls`
entry is built from retrieved-chunk metadata inside
`llm_generator.generate_answer()`, never parsed from LLM text. 12/12 test
results had fully traceable sources; the full-corpus audit found 0 issues
across all 1,488 chunks.

## Limitations

- The router is keyword/phrase-based, not a trained classifier — it can
  misclassify queries whose vocabulary doesn't match its keyword lists
  (see the honest routing note above). It has no confidence score of its
  own and no way to express "unsure which agent."
- No agent-level disambiguation or clarifying-question behavior — a
  misrouted query still gets *an* answer (or a correct refusal) from
  whichever agent it landed on, since all five agents share the same
  underlying grounded pipeline; misrouting affects the `selected_agent`
  label, not answer safety.
- `navigation_agent`'s adapter is a documented stub, not a working
  connection to the indoor pathfinding system — see above.
- All Phase 3/4 limitations carry over unchanged (heuristic-fallback
  reranker, no real intent classifier, no hallucination detector, no
  conversation/session history).

## Future improvements (NOT implemented)

- A real trained intent classifier (CLAUDE.md's planned LSTM,
  `backend/app/intent_model/`) to replace/augment the rule-based router —
  requires a labelled query->intent dataset that does not currently exist.
- Wiring `navigation_agent`'s adapter to the actual
  `backend/app/navigation/` pathfinding modules or `/api/v1/navigate`
  endpoints once this pipeline is integrated into the FastAPI backend
  (currently `scripts/ai/` only, per the established
  scripts/-never-imports-backend convention).
- A router confidence score, and Supervisor-level clarifying questions
  for ambiguous queries (mirrors CLAUDE.md's existing description of the
  eventual backend Supervisor's low-intent-confidence behavior).
