"""Phase 12 — Lightweight, deterministic query expansion for hybrid
retrieval candidate generation.

Widens the CANDIDATE SET that dense_search()/bm25_search() draw from —
nothing else. The query used for reranker.py's feature extraction
(query_term_coverage, exact_phrase_match), confidence.py's scoring, and the
text shown to the LLM in llm_generator.py all stay the user's real,
unmodified question. Only hybrid_retrieval.py's HybridRetriever.hybrid_search()
calls this, immediately before embedding/tokenizing for candidate
generation — reranking and everything downstream is completely unaffected.

Deliberately NOT an LLM call (no extra Ollama round trip per query, per
Phase 12's "avoid unnecessary LLM calls" instruction) and NOT a second
embedding call (no extra SentenceTransformer.encode() cost either) — a
small, hand-curated, symmetric synonym map, expanded once per query with
plain token matching. A query with no vocabulary in this map (which
includes every out-of-domain query — "What is the capital of France?" has
no department/course/lab/facility word in it) is returned completely
unchanged, so confidence.py's empirically-tuned LOW/MEDIUM/HIGH separation
(see that module's docstring) is not at risk of being disturbed for
anything outside this narrow, in-domain vocabulary.

Usage:
    from query_expansion import expand_query
    expanded = expand_query("What branches are available?")
    # -> "What branches are available? department departments"
"""

from __future__ import annotations

import re

# Each group is a set of interchangeable real-world phrasings seen in this
# project's own spec examples (Phase 11/12) or GAT's own KB vocabulary.
# Deliberately small and hand-checked, not a general thesaurus — a blanket
# stemmer/synonym expansion previously caused a real cross-entity collision
# in spatial_knowledge.py's search (see that module's Phase 11 docstring
# note on "system" vs "systems"); the fix there was the same principle
# applied here: only the specific pairs actually needed, verified against
# the real corpus, nothing automatic.
_SYNONYM_GROUPS: list[set[str]] = [
    {"department", "departments", "branch", "branches"},
    {"course", "courses", "program", "programs", "programme", "programmes", "degree", "study"},
    {"laboratory", "laboratories", "lab", "labs"},
    {"washroom", "washrooms", "restroom", "restrooms", "toilet", "toilets", "bathroom"},
    {"classroom", "classrooms"},
    {"building", "block"},
    {"floor", "floors", "storey", "story"},
    {"facility", "facilities", "amenity", "amenities"},
]

# token -> the OTHER tokens in its group, sorted for deterministic output
# (a plain set would iterate in an unspecified order, making expand_query's
# output — and therefore retrieval candidates — non-reproducible run to run).
_EXPANSIONS: dict[str, list[str]] = {}
for _group in _SYNONYM_GROUPS:
    for _token in _group:
        _EXPANSIONS[_token] = sorted(_group - {_token})

# Caps how many extra terms get appended — this is meant to nudge the
# candidate pool, not rewrite the query into a different one. Too many
# appended terms would dilute the dense-embedding centroid and flood BM25
# with terms the user didn't ask about.
_MAX_EXTRA_TERMS = 4

_TOKEN_PATTERN = re.compile(r"[a-z0-9]+")


def expand_query(query: str) -> str:
    """query -> query with a few extra synonym terms appended, for
    retrieval candidate generation only. Returns the exact original string
    unchanged if no token in it has a synonym in this module's small,
    hand-checked vocabulary."""
    tokens = _TOKEN_PATTERN.findall(query.lower())
    if not tokens:
        return query

    seen = set(tokens)
    extra: list[str] = []
    for token in tokens:
        if len(extra) >= _MAX_EXTRA_TERMS:
            break
        for synonym in _EXPANSIONS.get(token, ()):
            if synonym in seen or synonym in extra:
                continue
            extra.append(synonym)
            if len(extra) >= _MAX_EXTRA_TERMS:
                break

    if not extra:
        return query
    return query + " " + " ".join(extra)


if __name__ == "__main__":
    for demo_query in [
        "What branches are available?",
        "Where can I find a washroom?",
        "What can I study at GAT?",
        "What is the capital of France?",
    ]:
        print(f"{demo_query!r} -> {expand_query(demo_query)!r}")
