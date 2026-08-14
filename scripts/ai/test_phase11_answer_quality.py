"""Phase 11 — Advanced RAG answer generation, grounding, and response
quality test suite.

Exercises the REAL pipeline end-to-end (supervisor.route(), the specialist
agents, spatial_knowledge.py, context_selection.py) — no mocking, every
answer checked here came from the actual retrieval/reranking/confidence/
generation pipeline or the real Phase 9 spatial knowledge base. Covers the
Phase 11 spec's test groups A-L (Section 19) plus a dedicated
hallucination-prevention sweep (Section 18): nonexistent room/department/
laboratory, unsupported fee/salary/staff questions, and an ambiguous
location query.

Two parts:
- run_pipeline_tests(): standalone, calls supervisor.route()/
  navigation_agent.handle() directly. No running backend required.
- run_followup_test(): the one case (K, conversational follow-up) that
  needs a live backend + session persistence, same approach as
  test_chat_persistence.py — makes real HTTP requests against BASE_URL.
  Skipped (not failed) if the backend isn't reachable.

Usage: python scripts/ai/test_phase11_answer_quality.py
"""

from __future__ import annotations

import re
import time
from typing import Any

import httpx
from _shared import configure_logging
from supervisor import route

logger = configure_logging("test_phase11_answer_quality")

SERVER_ROOT = "http://127.0.0.1:8000"
BASE_URL = f"{SERVER_ROOT}/api/v1"

_REFUSAL_MARKERS = (
    "couldn't verify",
    "could not verify",
    "does not provide",
    "not provide a reliable answer",
    "no information",
    "cannot confirm",
    "not available",
    "does not contain",
    "unable to",
    "i don't have",
    "i do not have",
    "cannot provide",
    "not explicitly stated",
    "not mentioned",
    "does not specify",
)


def _looks_like_honest_refusal(answer: str) -> bool:
    lower = (answer or "").lower()
    return any(marker in lower for marker in _REFUSAL_MARKERS)


def _header(label: str, description: str) -> None:
    print("\n" + "=" * 100)
    print(f"[{label}] {description}")
    print("=" * 100)


# ---------------------------------------------------------------------------
# Section 19 — A-L
# ---------------------------------------------------------------------------


def case_a_course_query() -> dict[str, Any]:
    _header("A-COURSE-QUERY", "What all courses are available in college?")
    result = route("What all courses are available in college?")
    answer = result["answer"] or ""
    ok = (
        result["selected_agent"] == "academic_agent"
        and result["generation_status"] == "aggregated"
        and "engineering" in answer.lower()
        and len(answer) < 700  # focused, not a raw context dump
    )
    print(f"  agent={result['selected_agent']} status={result['generation_status']} ok={ok}")
    print(f"  answer: {answer[:300]}")
    return {"label": "A-COURSE-QUERY", "ok": ok}


def case_b_department_query() -> dict[str, Any]:
    _header("B-DEPARTMENT-QUERY", "What departments are available?")
    result = route("What departments are available?")
    answer = result["answer"] or ""
    ok = (
        result["selected_agent"] == "academic_agent"
        and result["generation_status"] == "aggregated"
        and "computer science" in answer.lower()
    )
    print(f"  agent={result['selected_agent']} status={result['generation_status']} ok={ok}")
    print(f"  answer: {answer[:300]}")
    return {"label": "B-DEPARTMENT-QUERY", "ok": ok}


def case_c_paraphrased_department_query() -> dict[str, Any]:
    _header("C-PARAPHRASED-DEPARTMENT", "Which branches does the college have?")
    result = route("Which branches does the college have?")
    answer = result["answer"] or ""
    ok = (
        result["selected_agent"] == "academic_agent"
        and result["generation_status"] == "aggregated"
        and "engineering" in answer.lower()
    )
    print(f"  agent={result['selected_agent']} status={result['generation_status']} ok={ok}")
    print(f"  answer: {answer[:300]}")
    return {"label": "C-PARAPHRASED-DEPARTMENT", "ok": ok}


def case_d_room_query() -> dict[str, Any]:
    _header("D-ROOM-QUERY", "Where is room 202?")
    result = route("Where is room 202?")
    answer = result["answer"] or ""
    ok = (
        result["selected_agent"] == "navigation_agent"
        and result["generation_status"] == "tool_resolved"
        and result["grounded"]
        and "202" in answer
    )
    print(f"  status={result['generation_status']} grounded={result['grounded']} ok={ok}")
    print(f"  answer: {answer[:300]}")
    return {"label": "D-ROOM-QUERY", "ok": ok}


def case_e_paraphrased_room_query() -> dict[str, Any]:
    _header("E-PARAPHRASED-ROOM", "Where can I find 202?")
    result = route("Where can I find 202?")
    answer = result["answer"] or ""
    ok = (
        result["selected_agent"] == "navigation_agent"
        and result["generation_status"] == "tool_resolved"
        and "202" in answer
    )
    print(f"  status={result['generation_status']} ok={ok}")
    print(f"  answer: {answer[:300]}")
    return {"label": "E-PARAPHRASED-ROOM", "ok": ok}


def case_f_floor_query() -> dict[str, Any]:
    _header("F-FLOOR-QUERY", "Which floor is room 303 on?")
    result = route("Which floor is room 303 on?")
    answer = result["answer"] or ""
    ok = (
        result["selected_agent"] == "navigation_agent"
        and result["generation_status"] == "tool_resolved"
        and "second floor" in answer.lower()
    )
    print(f"  status={result['generation_status']} ok={ok}")
    print(f"  answer: {answer[:300]}")
    return {"label": "F-FLOOR-QUERY", "ok": ok}


def case_g_laboratory_query() -> dict[str, Any]:
    _header("G-LABORATORY-QUERY", "Where is the Power System Simulation Lab?")
    result = route("Where is the Power System Simulation Lab?")
    answer = result["answer"] or ""
    # Phase 11 fix: this used to be falsely "ambiguous" (a Phase 9 "room"
    # record and a Phase 9 "laboratory" record for the exact same real
    # room, sourced from two different evidence photos, were not
    # recognized as the same place) — see spatial_knowledge.py's
    # room_names_to_key. Now resolves to a single grounded answer.
    ok = (
        result["selected_agent"] == "navigation_agent"
        and result["generation_status"] == "tool_resolved"
        and "303" in answer
        and "second floor" in answer.lower()
    )
    print(f"  status={result['generation_status']} ok={ok}")
    print(f"  answer: {answer[:300]}")
    return {"label": "G-LABORATORY-QUERY", "ok": ok}


def case_h_facility_query() -> dict[str, Any]:
    _header("H-FACILITY-QUERY", "Where are the washrooms?")
    result = route("Where are the washrooms?")
    answer = result["answer"] or ""
    # Phase 11 fix: "washrooms" previously matched nothing at all in the
    # spatial KB (only the literal word "Toilet" was indexed) — see
    # spatial_knowledge.py's _SYNONYMS. A washroom genuinely exists on
    # several different floors, so the honest answer is a multi-location
    # listing, not a single pick.
    ok = (
        result["selected_agent"] == "navigation_agent"
        and result["generation_status"] == "clarification_needed"
        and "toilet" in answer.lower()
    )
    print(f"  status={result['generation_status']} ok={ok}")
    print(f"  answer: {answer[:300]}")
    return {"label": "H-FACILITY-QUERY", "ok": ok}


def case_i_unsupported_room() -> dict[str, Any]:
    _header("I-UNSUPPORTED-ROOM", "Where is room 999?")
    t0 = time.perf_counter()
    result = route("Where is room 999?")
    elapsed_ms = (time.perf_counter() - t0) * 1000
    answer = result["answer"] or ""
    ok = (
        not result["grounded"]
        and result["confidence_score"] == 0.0
        and _looks_like_honest_refusal(answer)
        and elapsed_ms < 3000  # Phase 10's fast-path — no full RAG round trip
    )
    print(
        f"  grounded={result['grounded']} confidence={result['confidence_score']} "
        f"latency_ms={elapsed_ms:.0f} ok={ok}"
    )
    print(f"  answer: {answer[:300]}")
    return {"label": "I-UNSUPPORTED-ROOM", "ok": ok}


def case_j_unsupported_salary() -> dict[str, Any]:
    _header("J-UNSUPPORTED-SALARY", "What is the salary of every professor?")
    result = route("What is the salary of every professor?")
    answer = result["answer"] or ""
    no_fabricated_figure = re.search(r"(?:rs\.?|inr|₹)\s*[\d,]+", answer.lower()) is None
    ok = (
        result["generation_status"] in ("low_confidence_refusal", "no_context")
        or _looks_like_honest_refusal(answer)
    ) and no_fabricated_figure
    print(
        f"  status={result['generation_status']} "
        f"no_fabricated_figure={no_fabricated_figure} ok={ok}"
    )
    print(f"  answer: {answer[:300]}")
    return {"label": "J-UNSUPPORTED-SALARY", "ok": ok}


def run_followup_test() -> dict[str, Any] | None:
    _header("K-FOLLOWUP-QUERY", "'Where is the Power System Simulation Lab?' -> 'Which floor?'")
    try:
        httpx.get(f"{SERVER_ROOT}/docs", timeout=3.0)
    except httpx.RequestError:
        print("  SKIPPED — backend not reachable at " + SERVER_ROOT)
        return None

    first = httpx.post(
        f"{BASE_URL}/chat",
        json={"message": "Where is the Power System Simulation Lab?"},
        timeout=60.0,
    ).json()
    session_id = first.get("session_id")
    followup = httpx.post(
        f"{BASE_URL}/chat",
        json={"message": "Which floor?", "session_id": session_id},
        timeout=60.0,
    ).json()
    answer = (followup.get("answer") or "").lower()
    # Phase 11 fix: chat.py's _extract_location_mentioned() didn't
    # recognize spatial_knowledge.py's tool_result shape at all, so a
    # spatial answer never left anything in session memory for a follow-up
    # to resolve against — "Which floor?" (no indicator word at all, so
    # _FOLLOWUP_INDICATOR_PATTERN never matched it either) silently became
    # a brand-new, contextless question. Both gaps are fixed now.
    ok = followup.get("status") == "tool_resolved" and ("second floor" in answer or "303" in answer)
    print(f"  turn1 status={first.get('status')}")
    print(f"  turn2 status={followup.get('status')} ok={ok}")
    print(f"  turn2 answer: {followup.get('answer', '')[:300]}")
    return {"label": "K-FOLLOWUP-QUERY", "ok": ok}


def case_l_virtual_tour_query() -> dict[str, Any]:
    _header("L-VIRTUAL-TOUR-QUERY", "Can I see the CSE area in the virtual tour?")
    result = route("Can I see the CSE area in the virtual tour?")
    answer = (result["answer"] or "").lower()
    forbidden_navigation_phrases = (
        "turn left",
        "turn right",
        "proceed to",
        "take the stairs",
        "navigate to",
        "start navigation",
        "get directions",
        "shortest path",
    )
    no_navigation_reintroduced = not any(p in answer for p in forbidden_navigation_phrases)
    ok = result["selected_agent"] == "navigation_agent" and no_navigation_reintroduced
    print(
        f"  agent={result['selected_agent']} status={result['generation_status']} "
        f"no_navigation_reintroduced={no_navigation_reintroduced} ok={ok}"
    )
    print(f"  answer: {answer[:300]}")
    return {"label": "L-VIRTUAL-TOUR-QUERY", "ok": ok}


# ---------------------------------------------------------------------------
# Section 18 — hallucination-prevention sweep
# ---------------------------------------------------------------------------


def case_hallucination_nonexistent_department() -> dict[str, Any]:
    _header("HALLUCINATION-DEPARTMENT", "Is there a Department of Nuclear Engineering?")
    result = route("Is there a Department of Nuclear Engineering?")
    answer = result["answer"] or ""
    claims_it_exists = bool(re.search(r"\byes\b.{0,40}nuclear engineering", answer.lower()))
    ok = not claims_it_exists and (
        result["generation_status"] in ("low_confidence_refusal", "no_context")
        or _looks_like_honest_refusal(answer)
        or "aeronautical" in answer.lower()  # a correct, grounded correction is also honest
        or "civil" in answer.lower()
    )
    print(f"  status={result['generation_status']} claims_it_exists={claims_it_exists} ok={ok}")
    print(f"  answer: {answer[:300]}")
    return {"label": "HALLUCINATION-DEPARTMENT", "ok": ok}


def case_hallucination_nonexistent_laboratory() -> dict[str, Any]:
    _header("HALLUCINATION-LABORATORY", "Where is the Quantum Computing Lab?")
    result = route("Where is the Quantum Computing Lab?")
    answer = result["answer"] or ""
    fabricated_room = bool(re.search(r"\broom\s*\d{2,4}\b", answer.lower())) and result["grounded"]
    ok = not fabricated_room
    print(f"  status={result['generation_status']} grounded={result['grounded']} ok={ok}")
    print(f"  answer: {answer[:300]}")
    return {"label": "HALLUCINATION-LABORATORY", "ok": ok}


def case_hallucination_unsupported_facility() -> dict[str, Any]:
    _header("HALLUCINATION-FACILITY", "Is there a swimming pool on campus?")
    result = route("Is there a swimming pool on campus?")
    answer = result["answer"] or ""
    claims_yes_with_details = bool(re.search(r"\byes\b.{0,60}swimming pool", answer.lower()))
    ok = not claims_yes_with_details
    print(
        f"  status={result['generation_status']} "
        f"claims_yes_with_details={claims_yes_with_details} ok={ok}"
    )
    print(f"  answer: {answer[:300]}")
    return {"label": "HALLUCINATION-FACILITY", "ok": ok}


def case_hallucination_unsupported_staff() -> dict[str, Any]:
    _header("HALLUCINATION-STAFF", "What is Dr. R. Rajkumar's phone number?")
    result = route("What is Dr. R. Rajkumar's phone number?")
    answer = result["answer"] or ""
    fabricated_phone = re.search(r"\b(?:\+?91[-\s]?)?[6-9]\d{9}\b", answer) is not None
    ok = not fabricated_phone
    print(f"  status={result['generation_status']} fabricated_phone={fabricated_phone} ok={ok}")
    print(f"  answer: {answer[:300]}")
    return {"label": "HALLUCINATION-STAFF", "ok": ok}


def case_hallucination_ambiguous_location() -> dict[str, Any]:
    _header("HALLUCINATION-AMBIGUOUS", "Where is CSE?")
    result = route("Where is CSE?")
    answer = result["answer"] or ""
    # CSE genuinely has multiple real documented locations (HOD office,
    # staff rooms on two floors) — the honest answer lists them, it does
    # not silently pick one and present it as THE location.
    ok = result["generation_status"] == "clarification_needed" and "floor" in answer.lower()
    print(f"  status={result['generation_status']} ok={ok}")
    print(f"  answer: {answer[:300]}")
    return {"label": "HALLUCINATION-AMBIGUOUS", "ok": ok}


def run_pipeline_tests() -> list[dict[str, Any]]:
    return [
        case_a_course_query(),
        case_b_department_query(),
        case_c_paraphrased_department_query(),
        case_d_room_query(),
        case_e_paraphrased_room_query(),
        case_f_floor_query(),
        case_g_laboratory_query(),
        case_h_facility_query(),
        case_i_unsupported_room(),
        case_j_unsupported_salary(),
        case_l_virtual_tour_query(),
        case_hallucination_nonexistent_department(),
        case_hallucination_nonexistent_laboratory(),
        case_hallucination_unsupported_facility(),
        case_hallucination_unsupported_staff(),
        case_hallucination_ambiguous_location(),
    ]


def summarize(results: list[dict[str, Any]]) -> None:
    print("\n" + "=" * 100)
    print("SUMMARY")
    print("=" * 100)
    for r in results:
        print(f"  [{r['label']:32}] {'PASS' if r['ok'] else 'FAIL'}")
    passed = sum(1 for r in results if r["ok"])
    print(f"\n  {passed}/{len(results)} cases passed")


if __name__ == "__main__":
    results = run_pipeline_tests()
    followup = run_followup_test()
    if followup is not None:
        results.append(followup)
    summarize(results)
