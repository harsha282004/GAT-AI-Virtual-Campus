"""Phase 5 — Academic Information Agent.

Handles: departments, courses/programs, academic information,
curriculum-related campus information, academic facilities where
supported by the official knowledge base.

Runs the existing Phase 2-4 pipeline via agent_base.run_specialist() — no
retrieval/reranking/confidence/generation logic lives here, EXCEPT for one
deterministic special case below. See supervisor.py for how queries get
routed to this agent.

DEPARTMENT-LIST AGGREGATION (RAG audit, Task 5) — read before assuming this
duplicates the RAG path:
The knowledge base has one real page per department/program (see
data/processed/chunks.jsonl's *-engineering*.html sources) and no single
consolidated "list of departments" chunk. "What departments does GAT
offer?" is an aggregation question spanning ~10 separate documents; top-5
hybrid retrieval cannot surface all of them in one pass (confirmed during
the audit: none of the individual department pages made top-5 for this
exact query — generic institutional boilerplate elsewhere in the KB scores
competitively for the same words). Asking the LLM to synthesize a complete
list from an incomplete top-5 risks silently omitting real departments,
which the project's grounding rules treat as seriously as inventing one.
Instead of increasing top_k (masks the problem, doesn't fix it — the LLM
still only sees whatever fits the context window) or fabricating a static
list, `_aggregate_departments()` deterministically enumerates every
department/program chunk already present in the indexed corpus. Names come
straight from each page's real <title> (captured as `source_title` during
Phase 1 chunking) — never invented — and every result cites its real
source_url, exactly like a normal RAG answer.

PHASE 11 ADDITION — courses/programs/branches share this same aggregation
path. In this KB there is no separate "courses" document distinct from the
department pages — each department page IS the program page (e.g.
computer-science-engineering.html is both "the CSE department" and "the
B.E. in CSE"), confirmed by inspecting the indexed corpus, not assumed. So
"What courses are available?" / "What programs does GAT offer?" / "Which
branches does the college have?" have the identical aggregation gap
"What departments...?" has, and the identical fix applies: enumerate the
real pages rather than trust top-5 retrieval (or the LLM) to assemble a
complete list. `_looks_like_aggregation_query()` matches all four
phrasings; the underlying data and answer-building logic are unchanged.
"""

from __future__ import annotations

import re
from typing import Any

from agent_base import run_specialist
from build_embeddings import load_chunks

AGENT_NAME = "academic_agent"

# Narrow, explicit phrasings only — deliberately NOT a loose "contains both
# 'what' and 'department'" combinator, which would misfire on ordinary
# academic questions that happen to mention "department" (e.g. "What are
# the fees for the mechanical department?"). Phase 11: the same style of
# narrow pattern is used for the courses/programs/branches phrasings added
# below — one specific sentence shape per entry, not a keyword-contains
# check, so an unrelated sentence that merely mentions "course" in passing
# doesn't misfire into the aggregation path.
_LIST_DEPARTMENTS_PATTERNS = [
    re.compile(r"\bwhat\s+departments?\b", re.IGNORECASE),
    re.compile(r"\bwhich\s+departments?\b", re.IGNORECASE),
    re.compile(r"\bhow\s+many\s+departments?\b", re.IGNORECASE),
    re.compile(r"\blist\s+(?:of\s+)?departments?\b", re.IGNORECASE),
    re.compile(r"\bdepartments?\s+(?:are\s+)?available\b", re.IGNORECASE),
    re.compile(r"\ball\s+(?:the\s+)?departments?\b", re.IGNORECASE),
    # Phase 11 — courses/programs/branches paraphrases of the same
    # aggregation question (see this module's docstring for why they share
    # the identical underlying data/gap as the department phrasings above).
    re.compile(r"\bwhat\s+(?:all\s+)?courses?\b", re.IGNORECASE),
    re.compile(r"\bwhich\s+courses?\b", re.IGNORECASE),
    re.compile(r"\bcourses?\s+(?:are\s+)?(?:available|offered)\b", re.IGNORECASE),
    re.compile(r"\bwhat\s+programs?\b", re.IGNORECASE),
    re.compile(r"\bwhich\s+programs?\b", re.IGNORECASE),
    re.compile(r"\bprograms?\s+(?:are\s+)?(?:available|offered)\b", re.IGNORECASE),
    re.compile(r"\bwhat\s+branches?\b", re.IGNORECASE),
    re.compile(r"\bwhich\s+branches?\b", re.IGNORECASE),
    re.compile(r"\bbranches?\s+(?:are\s+)?(?:available|offered)\b", re.IGNORECASE),
    # "<departments|courses|programs|branches> does/do <anything> <have|offer>"
    # — a non-greedy middle group (not a single \w+) so it also covers
    # "branches does the college have" / "programs do they offer", not just
    # a single-word subject like "GAT".
    re.compile(
        r"\b(?:departments?|courses?|programs?|branches?)\s+(?:does|do)\s+.+?\s+(?:have|offer)\b",
        re.IGNORECASE,
    ),
]

# Every real department/program page in this KB has "engineering" somewhere
# in its gat.ac.in HTML slug (see the audit's chunk inventory) — this is a
# property of the actual indexed site, not a hand-picked shortcut. Scoped to
# .html on gat.ac.in so it can't accidentally catch an NIRF/compliance PDF
# that happens to contain "Engineering" in its filename.
_DEPARTMENT_PAGE_PATTERN = re.compile(r"gat\.ac\.in/[^/]*engineering[^/]*\.html$", re.IGNORECASE)


def _looks_like_department_list_query(query: str) -> bool:
    return any(p.search(query) for p in _LIST_DEPARTMENTS_PATTERNS)


def _aggregate_departments(query: str) -> dict[str, Any] | None:
    """Returns a fully-grounded Agent Response Contract dict, or None if the
    current corpus has no matching pages (falls back to normal RAG)."""
    by_url: dict[str, dict[str, Any]] = {}
    for chunk in load_chunks():
        url = chunk.get("source_url") or ""
        if _DEPARTMENT_PAGE_PATTERN.search(url) and url not in by_url:
            by_url[url] = chunk
    if not by_url:
        return None

    departments: list[tuple[str, dict[str, Any]]] = []
    postgraduate: list[tuple[str, dict[str, Any]]] = []
    for chunk in by_url.values():
        title = (chunk.get("source_title") or "").removeprefix("GAT - ").strip()
        if not title:
            continue
        (postgraduate if title.lower().startswith("master of") else departments).append(
            (title, chunk)
        )
    departments.sort(key=lambda item: item[0])
    postgraduate.sort(key=lambda item: item[0])
    if not departments and not postgraduate:
        return None

    answer_parts = []
    if departments:
        answer_parts.append(
            "GAT offers the following departments/undergraduate programs: "
            + ", ".join(name for name, _ in departments)
            + "."
        )
    if postgraduate:
        answer_parts.append(
            "It also offers these postgraduate programs: "
            + ", ".join(name for name, _ in postgraduate)
            + "."
        )

    source_chunks = [c for _, c in departments] + [c for _, c in postgraduate]
    sources = [
        {"title": c.get("source_title"), "source_url": c.get("source_url"), "page": c.get("page")}
        for c in source_chunks
    ]
    return {
        "original_query": query,
        "selected_agent": AGENT_NAME,
        "retrieved_context": [
            {
                "chunk_id": c.get("chunk_id"),
                "source_title": c.get("source_title"),
                "source_url": c.get("source_url"),
                "page": c.get("page"),
            }
            for c in source_chunks
        ],
        "confidence_score": 1.0,
        "confidence_level": "HIGH",
        "generation_status": "aggregated",
        "answer": " ".join(answer_parts),
        "sources": sources,
        "source_urls": [c.get("source_url") for c in source_chunks if c.get("source_url")],
        "refusal_reason": None,
        "grounded": True,
        "tool_used": "department_aggregation",
    }


def handle(query: str) -> dict[str, Any]:
    if _looks_like_department_list_query(query):
        aggregated = _aggregate_departments(query)
        if aggregated is not None:
            return aggregated
    return run_specialist(AGENT_NAME, query)


if __name__ == "__main__":
    for demo_query in ["What departments are available?", "What departments does GAT offer?"]:
        result = handle(demo_query)
        print(f"[{result['generation_status']}] {result['answer']}")
