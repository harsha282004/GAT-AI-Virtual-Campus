# PAPER_STATUS.md — GAT Virtual Campus IEEE manuscript

Snapshot of the deliverable. Regenerate the compiled numbers after the
first Overleaf build.

---

## 1. Size

| Item | Count |
|---|---|
| Body sections (I–XVI) | 16 |
| Section `.tex` files (incl. abstract) | 17 |
| Numbered algorithms | 13 |
| Figures (all inline TikZ / tabular, no external assets) | 11 |
| Tables (2 are full-width `table*`) | 9 |
| Numbered display equations | ~20 |
| Bibliography entries provided | 60 (all 60 cited) |
| Estimated compiled length (IEEEtran journal, pdfLaTeX) | **≈ 18–22 pages** |

> The estimate is based on ~15,000 words of body text plus 13 algorithm
> floats, 11 figures, 9 tables, and the reference list. **The document has
> not been compiled** (no TeX toolchain was available in the authoring
> environment). Compile on Overleaf to obtain the exact page count; if it
> lands below 15 pages, the most likely cause is aggressive float packing
> — nothing in the text is padding and no section should be cut.

### Algorithm inventory (all correspond to implemented code)

| # | Algorithm | Implements |
|---|---|---|
| 1 | Institutional Knowledge Acquisition and Chunking | `scripts/ai/collect_*.py`, `clean_and_chunk.py`, `build_embeddings.py` |
| 2 | Hybrid Dense + BM25 Retrieval | `scripts/ai/hybrid_retrieval.py` |
| 3 | Heuristic Context Reranking | `scripts/ai/reranker.py` |
| 4 | Confidence-Gated RAG Generation | `scripts/ai/confidence.py`, `llm_generator.py` |
| 5 | Grounding-Based Claim Verification | `scripts/ai/grounding.py` |
| 6 | Multi-Agent Query Routing | `scripts/ai/supervisor.py` |
| 7 | LSTM Intent Classification Pipeline | `backend/app/intent_model/{model,classify,vocab}.py` |
| 8 | Manual Tour Hotspot Derivation and Step | `frontend/.../engine/hotspotEngine.ts` |
| 9 | Cross-Floor Panorama Stitching | `frontend/.../engine/PanoramaEngine.ts` (pass 3) |
| 10 | Guided Tour Execution at a Node | `frontend/src/hooks/useGuidedTour.ts` |
| 11 | A\* Campus Pathfinding | `backend/app/navigation/pathfinding.py` |
| 12 | Minimap Coordinate Projection | `frontend/.../tour/Minimap.tsx` |
| 13 | Database-Backed Graph Construction | `backend/app/navigation/graph_builder.py` |

### Figure inventory

Fig. 1 system architecture · Fig. 2 request flow · Fig. 3 KB pipeline ·
Fig. 4 ER diagram · Fig. 5 scene graph · Fig. 6 guided-tour automaton ·
Fig. 7 hybrid retrieval · Fig. 8 routing cascade · Fig. 9 A\* pipeline ·
Fig. 10 voice pipeline · Fig. 11 intent confusion matrix (measured).

---

## 2. Verified experimental results used in the paper

Only the following measured facts are reported, and all are labeled as
implementation/observation, not benchmark:

| Fact | Value | Source |
|---|---|---|
| KB chunks (embedded) | 1,507 | `data/processed/chunks.jsonl`, live ChromaDB count |
| Source PDFs / web pages on disk | 128 / 42 | `data/raw/` |
| Source URLs attempted (chunked/failed) | 186 (110 / 76) | `data/metadata/source_manifest.json` |
| Campus graph | 180 nodes, 325 edges | live PostgreSQL |
| Panoramas / cross-floor hotspots | 161 / 849 | live PostgreSQL |
| Floors / buildings / rooms | 10 / 5 / 11 | live PostgreSQL |
| Chat sessions / messages (dev usage) | 378 / 1,400 | live PostgreSQL |
| Alembic migrations | 14 | `database/migrations/versions/` |
| Intent classifier train / val accuracy | 1.000 / 0.529 | `training_metadata.json` + independent re-eval |
| Intent classifier macro F1 / weighted F1 | 0.404 / 0.487 | `evaluation/intent_classification_report.txt` |
| Intent classifier per-class metrics + confusion | Table IX / Fig. 11 | same report |
| Confidence thresholds & 9-query calibration sample | Table IV | `scripts/ai/confidence.py`, `docs/RAG_ARCHITECTURE.md` |
| Concurrency anecdote | 17 s & 45 s for 2 simultaneous requests | `scripts/ai/llm_generator.py` comments |

---

## 3. Proposed experiments NOT yet performed (Section XII, Table VIII)

- **E1** Retrieval quality: P@1/3/5, R@5, MRR, nDCG@10 — BM25 vs dense vs hybrid (λ sweep).
- **E2** Reranker ablation: no-rerank vs heuristic vs (once labeled) trained SVR.
- **E3** Intent classification on ≥600 **real** logged queries; full 12×12 confusion; LSTM vs retrained-LSTM vs rules vs LLM.
- **E4** Answer faithfulness / relevancy / context relevancy (RAGAS + human), citation correctness, hallucination rate; ablate confidence gate and grounding check.
- **E5** Confidence-threshold calibration: coverage / refusal / hallucination vs (θ_MED, θ_HIGH); reliability diagram, ECE; with vs without the LSTM intent term.
- **E6** A\* performance: path length, wall-clock, expanded nodes vs graph size and heuristic tier; A\* vs Dijkstra; cached vs rebuilt graph; a 50-session load test.
- **E7** Tour traversal correctness: cross-floor transition success, guided-tour completion, orientation continuity, corrupt-graph handling.
- **E8** Usability study (≥20 participants): task completion, time-on-task, SUS, satisfaction, trust — vs institution website + PDFs.

---

## 4. Known implementation gaps stated in the paper (not hidden)

- SVR reranker implemented but **never trained**; heuristic is the only production path.
- LSTM `P(intent)` **not wired** into the confidence formula (Eq. 7 intent term is a retrieval fallback).
- Confidence thresholds fitted to **n = 9** queries.
- Post-generation grounding check covers **numeric claims only**.
- A\* engine has **no front-end consumer**; a GPS/3D-map UI was built then removed.
- All building coordinates null → heuristic runs mostly at the zero (Dijkstra) tier.
- Backend chat path is **synchronous**; no streaming.
- **No authentication** on any endpoint incl. mutating CRUD; raw user messages logged verbatim.
- CI runs no checks; automated test suites are empty placeholders.
- Panorama imagery and orientation calibration are placeholders.
- Retrieval is English-only.

---

## 5. Remaining placeholders in the LaTeX

| Placeholder | Location | Action |
|---|---|---|
| Author names / affiliations / e-mails / ORCID | `main.tex` `\author{...}` and `\thanks` | replace with real values |
| Journal name / volume / month in running head | `main.tex` `\markboth{...}` | set to the target journal |
| Manuscript date | `main.tex` `\thanks{... \today ...}` | fix at submission |
| DOIs | `references.bib` | intentionally omitted; add if required by the venue, verify each |
| Related-work references | complete as provided; **verify every entry** against the venue's records before submission | — |

---

## 6. Honesty ledger

The manuscript contains **no fabricated experimental results**. Every
quantitative claim is either (a) an implementation-scale count traceable to
the repository / live database, (b) the intent classifier's real (poor,
overfit) held-out metrics, (c) the 9-query confidence calibration artifact,
or (d) the single concurrency anecdote — each explicitly labeled as such.
All performance-style experiments are presented as a **proposed protocol**,
not as results. Partial and removed components (untrained SVR, unwired
intent term, deleted GPS/3D map, empty tests) are stated in the abstract,
Section XI, Section XIV, and this file.
