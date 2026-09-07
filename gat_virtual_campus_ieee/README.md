# GAT Virtual Campus — IEEE Journal Manuscript (LaTeX source)

An IEEE-style journal manuscript documenting the **GAT Virtual Campus**
system: a grounded retrieval-augmented campus assistant, a 360° virtual
tour scene graph, and an A\* wayfinding engine.

The paper is written to be **scientifically honest about implementation
status**: it distinguishes what is implemented, what has been measured,
what is proposed for evaluation, and what is future work. It contains **no
fabricated experimental results.**

---

## How to compile

### Overleaf (recommended)

1. Create a new project → **Upload Project** → upload this whole folder as
   a ZIP (or drag every file/folder in, preserving structure).
2. Set the **main document** to `main.tex` (Menu → Main document).
3. Set the compiler to **pdfLaTeX** (Menu → Compiler → pdfLaTeX).
4. Compile. Overleaf runs `pdflatex → bibtex → pdflatex → pdflatex`
   automatically. If references show as `[?]`, click **Recompile** once
   more or use **Recompile from scratch**.

The document class is `IEEEtran` (journal mode), which ships with Overleaf.
All packages used (`amsmath`, `algorithm`, `algpseudocode`, `booktabs`,
`tikz` with `arrows.meta`/`positioning`/`shapes.geometric`/`fit`/
`backgrounds`, `xcolor` with `table`, `hyperref`, `cite`) are in the
standard TeX Live distribution Overleaf uses. There are **no external image
files** — every figure is inline TikZ or a `tabular`, so nothing else needs
uploading.

### Local (TeX Live / MiKTeX)

```bash
pdflatex main
bibtex   main
pdflatex main
pdflatex main
```

or simply:

```bash
latexmk -pdf main.tex
```

---

## Project structure

```
gat_virtual_campus_ieee/
├── main.tex                 # document root: preamble + \input list + bibliography
├── references.bib           # 60 references (all 60 cited), IEEEtran style
├── README.md
├── PAPER_STATUS.md          # page/figure/table/algorithm counts, placeholders, honesty ledger
├── sections/
│   ├── abstract.tex
│   ├── introduction.tex
│   ├── related_work.tex
│   ├── problem.tex
│   ├── architecture.tex
│   ├── dataset.tex
│   ├── virtual_tour.tex
│   ├── rag.tex
│   ├── multi_agent.tex
│   ├── navigation.tex
│   ├── voice.tex
│   ├── implementation.tex
│   ├── evaluation.tex        # PROPOSED protocol — not results
│   ├── results.tex           # only measurements that actually exist
│   ├── limitations.tex
│   ├── future_work.tex
│   └── conclusion.tex
├── figures/                  # inline TikZ, \input from sections
│   ├── fig_system_architecture.tex
│   ├── fig_request_flow.tex
│   ├── fig_kb_pipeline.tex
│   ├── fig_er.tex
│   ├── fig_scene_graph.tex
│   ├── fig_guided_state.tex
│   ├── fig_hybrid.tex
│   ├── fig_routing.tex
│   ├── fig_astar.tex
│   ├── fig_voice.tex
│   └── fig_confusion.tex
└── tables/
    ├── comparison.tex           # Table I  (related work)
    ├── dataset_counts.tex       # Table II (implementation scale)
    ├── retrieval_methods.tex    # Table III
    ├── confidence_sample.tex    # Table IV (9-query calibration artifact)
    ├── routing_approaches.tex   # Table V
    ├── nav_approaches.tex       # Table VI
    ├── tech_stack.tex           # Table VII
    ├── eval_protocol.tex        # Table VIII (proposed experiments)
    └── lstm_perclass.tex        # Table IX (measured LSTM per-class metrics)
```

*(Table numbers are assigned by LaTeX in order of appearance; the list
above is the intended order.)*

---

## Editing the author block

`main.tex` contains placeholder authors, affiliations, and e-mails
(clearly marked). Replace them before submission. Do **not** add ORCID
markup unless you also add `\usepackage{orcidlink}` back to the preamble.

---

## What to do next (from the paper itself)

The manuscript's Section on evaluation (`sections/evaluation.tex`) defines
eight experiments (E1–E8) that have **not** been run. Running E1 (retrieval
quality) and E4 (answer faithfulness) first is recommended, because they
produce the relevance/correctness labels that E2 and E5 also require. See
`PAPER_STATUS.md` for the full ledger.
