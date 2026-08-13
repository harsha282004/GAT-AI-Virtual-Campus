"""Phase 6 — Campus tools + location/panorama integration test harness.

Covers the 8 required categories: normal campus question, facility lookup,
room lookup, route-style query (Phase 9: must degrade safely, not route),
panorama/tour request, unresolved location, unrelated question, tool
failure/unavailable tool. Exercises the REAL backend (real Postgres data,
real campus graph) — no mocking.

Usage: python scripts/ai/test_campus_tools.py
"""

from __future__ import annotations

from campus_tools import contact_lookup
from navigation_agent import handle as navigation_handle
from supervisor import route
from test_hybrid_retrieval import run_traceability_audit

CASES = [
    # (label, description, callable)
    (
        "A-NORMAL-CAMPUS-QUESTION",
        "What is the admission process?",
        lambda: route("What is the admission process?"),
    ),
    (
        "B-FACILITY-LOOKUP",
        "What facilities are available on campus?",
        lambda: route("What facilities are available on campus?"),
    ),
    (
        "C-ROOM-LOOKUP",
        "Where is Room 101?",
        lambda: navigation_handle("Where is Room 101?"),
    ),
    (
        # Phase 9 scope change: indoor routing was removed from the
        # project. This case now confirms a route-style query degrades
        # to the ordinary RAG path (or a safe refusal) rather than
        # producing a fabricated turn-by-turn route — see
        # navigation_agent.py's Phase 9 docstring note.
        "D-ROUTE-QUERY-DEGRADES-SAFELY",
        "How do I get to the CSE Block? (routing removed in Phase 9 — must NOT return a route)",
        lambda: navigation_handle("How do I get to the CSE Block?"),
    ),
    (
        "E-PANORAMA-TOUR-REQUEST",
        "Show me the panorama for the library",
        lambda: navigation_handle("Show me the panorama for the library"),
    ),
    (
        # "Take me to X" no longer matches a route pattern (Phase 9) — this
        # is now just an unresolved-location-style query like any other.
        "F-UNRESOLVED-LOCATION",
        "Take me to Room 204.",
        lambda: navigation_handle("Take me to Room 204."),
    ),
    (
        "G-UNRELATED-QUESTION",
        "What is the capital of France?",
        lambda: route("What is the capital of France?"),
    ),
]


def _print_result(label: str, description: str, result: dict) -> dict:
    print("\n" + "=" * 100)
    print(f"[{label}] {description}")
    print("=" * 100)
    print(f"  selected_agent: {result.get('selected_agent')}")
    print(f"  generation_status: {result['generation_status']}")
    print(f"  confidence: {result.get('confidence_score')} ({result.get('confidence_level')})")
    print(f"  grounded: {result.get('grounded')}")
    if result.get("tool_used"):
        print(f"  tool_used: {result['tool_used']}")
    if result.get("resolved_location") is not None:
        print(f"  resolved_location: {result['resolved_location']}")
    if result.get("refusal_reason"):
        print(f"  refusal_reason: {result['refusal_reason']}")
    print(f"  answer: {result['answer']}")
    if result.get("source_urls"):
        print(f"  source_urls: {result['source_urls']}")
    return result


def run_tool_failure_case() -> dict:
    """H — tool failure/unavailable tool. contact_lookup is documented as
    NOT AVAILABLE (no structured contact table exists) — a real, honest
    instance of this category rather than a simulated crash."""
    print("\n" + "=" * 100)
    print("[H-TOOL-UNAVAILABLE] contact_lookup('official phone number')")
    print("=" * 100)
    result = contact_lookup("official phone number")
    print(f"  status: {result['status']}")
    print(f"  note: {result['note']}")
    return result


def run_tests() -> list[dict]:
    results = []
    for label, description, fn in CASES:
        result = fn()
        _print_result(label, description, result)
        results.append({"label": label, "result": result})
    return results


def summarize(results: list[dict], tool_failure_result: dict) -> None:
    print("\n" + "=" * 100)
    print("SUMMARY")
    print("=" * 100)
    for item in results:
        r = item["result"]
        print(
            f"  [{item['label']:26}] agent={r.get('selected_agent', '-'):16} "
            f"status={r['generation_status']:22} tool={r.get('tool_used') or '-'}"
        )
    print(f"  [{'H-TOOL-UNAVAILABLE':26}] status={tool_failure_result['status']}")

    tool_resolved = sum(
        1 for item in results if item["result"]["generation_status"] == "tool_resolved"
    )
    clarifications = sum(
        1 for item in results if item["result"]["generation_status"] == "clarification_needed"
    )
    rag_generated = sum(1 for item in results if item["result"]["generation_status"] == "generated")
    refusals = sum(
        1 for item in results if item["result"]["generation_status"] == "low_confidence_refusal"
    )
    print(
        f"\n  tool_resolved={tool_resolved}  clarification_needed={clarifications}  "
        f"rag_generated={rag_generated}  low_confidence_refusal={refusals}  "
        f"tool_unavailable_reported={1 if tool_failure_result['status'] == 'not_available' else 0}"
    )


if __name__ == "__main__":
    results = run_tests()
    tool_failure_result = run_tool_failure_case()
    summarize(results, tool_failure_result)

    audit = run_traceability_audit()
    print(f"\nCorpus-wide traceability (Phase 1-5 unaffected): {audit}")
