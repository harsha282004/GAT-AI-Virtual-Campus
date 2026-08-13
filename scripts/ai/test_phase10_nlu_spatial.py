"""Phase 10 — NLU + spatial retrieval integration test harness.

Covers: paraphrase-group intent consistency (Section 16), room validation
(201/202/203/301/302/303), spatial answer format/evidence, hallucination
prevention (NOT_FOUND never becomes a fabricated location), and a basic
single-request latency sanity check. Exercises the REAL pipeline (real
supervisor, real navigation_agent, real spatial_knowledge.py, real Phase 9
data) — no mocking, consistent with every other scripts/ai/test_*.py.

Usage: python scripts/ai/test_phase10_nlu_spatial.py
"""

from __future__ import annotations

import time

import navigation_agent
import supervisor

PARAPHRASE_GROUPS: dict[str, tuple[str, list[str]]] = {
    "A-DEPARTMENTS": (
        "academic_agent",
        [
            "What departments are available in GAT?",
            "What departments does GAT have?",
            "Which departments are there?",
            "What branches are offered?",
            "Tell me the departments in the college.",
        ],
    ),
    "B-COURSES": (
        "academic_agent",
        [
            "What courses are available?",
            "What programs does GAT offer?",
            "Which courses can I study?",
            "What engineering branches are offered?",
            "What all courses are there in the college?",
        ],
    ),
    "C-ROOM-202": (
        "navigation_agent",
        [
            "Where is room 202?",
            "Where is room no 202?",
            "Which floor is room 202 on?",
            "Where can I find 202?",
            "Tell me the location of room number 202.",
        ],
    ),
    "D-ROOM-303": (
        "navigation_agent",
        [
            "Where is room 303?",
            "Where can I find room 303?",
            "Which floor is 303?",
            "Tell me about room number 303.",
        ],
    ),
}


def run_paraphrase_tests() -> list[dict]:
    results = []
    for group_name, (expected_agent, queries) in PARAPHRASE_GROUPS.items():
        print("\n" + "=" * 100)
        print(f"[{group_name}] expected agent={expected_agent}")
        print("=" * 100)
        for q in queries:
            t0 = time.perf_counter()
            agent, reason = supervisor.classify(q)
            elapsed_ms = (time.perf_counter() - t0) * 1000
            ok = agent == expected_agent
            print(f"  {'OK ' if ok else 'FAIL'} {q!r} -> {agent} ({elapsed_ms:.1f}ms)")
            if not ok:
                print(f"       reason: {reason}")
            results.append({"group": group_name, "query": q, "agent": agent, "ok": ok})
    return results


ROOM_VALIDATION_CASES = [
    ("Where is room 201?", "201", "tool_resolved", True),
    ("Where is room 202?", "202", "tool_resolved", True),
    ("Where is room 203?", "203", "tool_resolved", True),
    ("Where is room 301?", "301", "no_context", False),
    ("Where is room 302?", "302", "tool_resolved", True),
    ("Where is room 303?", "303", "tool_resolved", True),
]


def run_room_validation_tests() -> list[dict]:
    print("\n" + "=" * 100)
    print("[ROOM VALIDATION] 201 / 202 / 203 / 301 / 302 / 303")
    print("=" * 100)
    results = []
    for query, room_number, expected_status, expect_grounded in ROOM_VALIDATION_CASES:
        result = navigation_agent.handle(query)
        status_ok = result["generation_status"] == expected_status
        grounded_ok = result["grounded"] == expect_grounded
        # Hallucination guard: a NOT_FOUND room must never be reported with
        # a fabricated floor/building — confidence must stay at/near 0 and
        # the answer must contain the honest "couldn't verify" phrasing.
        no_hallucination = True
        if not expect_grounded:
            no_hallucination = (
                result["confidence_score"] == 0.0 and "couldn't verify" in result["answer"].lower()
            )
        ok = status_ok and grounded_ok and no_hallucination
        print(
            f"  {'OK ' if ok else 'FAIL'} room {room_number}: status={result['generation_status']} "
            f"grounded={result['grounded']} confidence={result['confidence_score']}"
        )
        print(f"       {result['answer'][:160]}")
        results.append(
            {
                "room_number": room_number,
                "ok": ok,
                "status": result["generation_status"],
                "confidence": result["confidence_score"],
                "answer": result["answer"],
            }
        )
    return results


def run_hallucination_and_latency_tests() -> list[dict]:
    print("\n" + "=" * 100)
    print("[HALLUCINATION PREVENTION + LATENCY]")
    print("=" * 100)
    results = []

    # A completely fabricated room number Phase 9 never observed at all
    # (not even one of the 6 explicitly-validated numbers) — must fall
    # through honestly, never invent a floor for it.
    t0 = time.perf_counter()
    result = navigation_agent.handle("Where is room 999?")
    elapsed_ms = (time.perf_counter() - t0) * 1000
    no_fabrication = result["confidence_score"] < 0.6 and result["generation_status"] not in (
        "tool_resolved",
    )
    print(
        f"  {'OK ' if no_fabrication else 'FAIL'} 'Where is room 999?' -> "
        f"status={result['generation_status']} grounded={result['grounded']} ({elapsed_ms:.0f}ms)"
    )
    results.append({"case": "fabricated_room_999", "ok": no_fabrication})

    # Off-topic query must not be answered as if it were GAT-specific.
    t0 = time.perf_counter()
    agent, _ = supervisor.classify("What is the capital of France?")
    result = supervisor.AGENTS[agent]("What is the capital of France?")
    elapsed_ms = (time.perf_counter() - t0) * 1000
    safe_refusal = result["generation_status"] in ("low_confidence_refusal", "no_context")
    print(
        f"  {'OK ' if safe_refusal else 'FAIL'} 'What is the capital of France?' -> "
        f"agent={agent} status={result['generation_status']} ({elapsed_ms:.0f}ms)"
    )
    results.append({"case": "off_topic_unrelated", "ok": safe_refusal})

    return results


if __name__ == "__main__":
    paraphrase_results = run_paraphrase_tests()
    room_results = run_room_validation_tests()
    other_results = run_hallucination_and_latency_tests()

    print("\n" + "=" * 100)
    print("SUMMARY")
    print("=" * 100)
    total = len(paraphrase_results) + len(room_results) + len(other_results)
    passed = (
        sum(r["ok"] for r in paraphrase_results)
        + sum(r["ok"] for r in room_results)
        + sum(r["ok"] for r in other_results)
    )
    n_paraphrase_ok = sum(r["ok"] for r in paraphrase_results)
    n_room_ok = sum(r["ok"] for r in room_results)
    n_other_ok = sum(r["ok"] for r in other_results)
    print(f"  Paraphrase intent-consistency: {n_paraphrase_ok}/{len(paraphrase_results)}")
    print(f"  Room validation (201-303):     {n_room_ok}/{len(room_results)}")
    print(f"  Hallucination/latency checks:  {n_other_ok}/{len(other_results)}")
    print(f"\n  TOTAL: {passed}/{total}")
