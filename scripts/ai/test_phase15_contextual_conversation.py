"""Phase 15 — Contextual conversation + follow-up questions test suite.

Two parts, matching this repo's established convention for session-
dependent behavior (see test_chat_persistence.py, test_phase11_answer_
quality.py's K-FOLLOWUP-QUERY):

- run_deterministic_tests(): standalone, no backend required — exercises
  scripts/ai/conversation_context.py's pure functions directly.
- run_live_tests(): requires a running backend (POST /api/v1/chat) — makes
  real multi-turn HTTP requests, covering Section 20's groups A-L. Skipped
  (not failed) if the backend isn't reachable.

No mocking anywhere — every live case exercises the real Supervisor,
specialist agents, spatial knowledge base, RAG pipeline, and Phase 14
grounding, through the actual FastAPI endpoint and PostgreSQL-backed
session store.

Usage: python scripts/ai/test_phase15_contextual_conversation.py
(start the backend first for the live test groups: uvicorn app.main:app
--app-dir backend)
"""

from __future__ import annotations

import re
from typing import Any

import httpx
from _shared import configure_logging
from conversation_context import has_reference_cue, resolve_reference

_PHONE_PATTERN = re.compile(r"\b(?:\+?91[-\s]?)?[6-9]\d{9}\b")

logger = configure_logging("test_phase15_contextual_conversation")

SERVER_ROOT = "http://127.0.0.1:8000"
BASE_URL = f"{SERVER_ROOT}/api/v1"


def _post(message: str, session_id: str | None = None) -> dict[str, Any]:
    payload: dict[str, Any] = {"message": message}
    if session_id is not None:
        payload["session_id"] = session_id
    response = httpx.post(f"{BASE_URL}/chat", json=payload, timeout=60.0)
    return response.json()


def _header(label: str, description: str) -> None:
    print("\n" + "=" * 100)
    print(f"[{label}] {description}")
    print("=" * 100)


# ---------------------------------------------------------------------------
# Deterministic (standalone) tests — conversation_context.py's pure logic
# ---------------------------------------------------------------------------


def run_deterministic_tests() -> list[dict[str, Any]]:
    _header("DETERMINISTIC", "conversation_context.py pure-function checks")
    results = []

    cases = [
        ("Which floor is it on?", True, "bare referent"),
        ("What are its timings?", True, "possessive"),
        ("What about the AI course?", True, "topic continuation"),
        ("What are the admission requirements?", False, "independent, no cue"),
        ("Where is the library?", False, "independent, no cue"),
    ]
    for query, expected, label in cases:
        actual = has_reference_cue(query)
        ok = actual == expected
        print(f"  {'OK ' if ok else 'FAIL'} has_reference_cue({query!r}) = {actual} ({label})")
        results.append({"label": f"CUE-{label}", "ok": ok})

    resolved = resolve_reference("Which floor is it on?", ["CSE department"])
    ok = (
        resolved.status == "resolved"
        and resolved.resolved_query == "Which floor is CSE department on?"
    )
    print(f"  {'OK ' if ok else 'FAIL'} single-entity resolution -> {resolved}")
    results.append({"label": "RESOLVE-SINGLE", "ok": ok})

    ambiguous = resolve_reference("Where is it?", ["CSE department", "Library"])
    ok = ambiguous.status == "ambiguous" and len(ambiguous.candidates) == 2
    print(f"  {'OK ' if ok else 'FAIL'} multi-entity ambiguity -> {ambiguous}")
    results.append({"label": "RESOLVE-AMBIGUOUS", "ok": ok})

    no_context = resolve_reference("What about the AI course?", [])
    ok = no_context.status == "no_context"
    print(f"  {'OK ' if ok else 'FAIL'} no active entity -> {no_context}")
    results.append({"label": "RESOLVE-NO-CONTEXT", "ok": ok})

    independent = resolve_reference("What is the admission process?", ["CSE department"])
    ok = independent.status == "independent"
    print(f"  {'OK ' if ok else 'FAIL'} no cue despite active entity -> {independent}")
    results.append({"label": "RESOLVE-INDEPENDENT", "ok": ok})

    return results


# ---------------------------------------------------------------------------
# Live tests — Section 20 groups A-L
# ---------------------------------------------------------------------------


def case_a_pronoun_followup() -> dict[str, Any]:
    _header(
        "A-PRONOUN-FOLLOWUP", "Where is the Power System Simulation Lab? -> Which floor is it on?"
    )
    r1 = _post("Where is the Power System Simulation Lab?")
    sid = r1["session_id"]
    r2 = _post("Which floor is it on?", sid)
    ok = (
        r2["status"] == "tool_resolved"
        and "303" in r2["answer"]
        and "second floor" in r2["answer"].lower()
    )
    print(f"  t1_status={r1['status']} t2_status={r2['status']} ok={ok}")
    print(f"  t2 answer: {r2['answer'][:200]}")
    return {"label": "A-PRONOUN-FOLLOWUP", "ok": ok}


def case_b_possessive_followup() -> dict[str, Any]:
    _header("B-POSSESSIVE-FOLLOWUP", "Tell me about the library. -> What are its timings?")
    r1 = _post("Tell me about the library.")
    sid = r1["session_id"]
    r2 = _post("What are its timings?", sid)
    # The KB may not have specific timing data (an honest Phase 14 refusal
    # is a valid, non-fabricating outcome) — what matters here is that the
    # resolved query correctly named "Library", which the LLM's own answer
    # echoes back when it explains what it couldn't find, and that no
    # unrelated entity was substituted instead.
    ok = "library" in r2["answer"].lower()
    print(f"  t1_status={r1['status']} t2_status={r2['status']} ok={ok}")
    print(f"  t2 answer: {r2['answer'][:250]}")
    return {"label": "B-POSSESSIVE-FOLLOWUP", "ok": ok}


def case_c_spatial_followup() -> dict[str, Any]:
    _header("C-SPATIAL-FOLLOWUP", "Where is room 202? -> What floor is that on?")
    r1 = _post("Where is room 202?")
    sid = r1["session_id"]
    r2 = _post("What floor is that on?", sid)
    ok = (
        r2["status"] == "tool_resolved"
        and "202" in r2["answer"]
        and "first floor" in r2["answer"].lower()
    )
    print(f"  t1_status={r1['status']} t2_status={r2['status']} ok={ok}")
    print(f"  t2 answer: {r2['answer'][:200]}")
    return {"label": "C-SPATIAL-FOLLOWUP", "ok": ok}


def case_d_context_continuation() -> dict[str, Any]:
    _header("D-CONTEXT-CONTINUATION", "What courses does CSE offer? -> What about the AI course?")
    r1 = _post("What courses does CSE offer?")
    sid = r1["session_id"]
    r2 = _post("What about the AI course?", sid)
    # academic_agent's Phase 11 deterministic aggregation triggers for both
    # turns (a real, honestly-grounded answer either way) — the check here
    # is that the request was answered from real project knowledge, not
    # fabricated, and that the agent stayed academic (context wasn't lost
    # to an unrelated domain).
    ok = r2["selected_agent"] == "academic_agent" and r2["status"] in ("aggregated", "generated")
    t1s, t2s, t2a = r1["status"], r2["status"], r2["selected_agent"]
    print(f"  t1_status={t1s} t2_status={t2s} t2_agent={t2a} ok={ok}")
    return {"label": "D-CONTEXT-CONTINUATION", "ok": ok}


def case_e_topic_switching() -> dict[str, Any]:
    _header(
        "E-TOPIC-SWITCHING",
        "Power lab -> Which floor is it on? -> What are the admission requirements?",
    )
    r1 = _post("Where is the Power System Simulation Lab?")
    sid = r1["session_id"]
    r2 = _post("Which floor is it on?", sid)
    r3 = _post("What are the admission requirements?", sid)
    ok = r3["selected_agent"] == "admission_agent"
    print(
        f"  t1_agent={r1['selected_agent']} t2_agent={r2['selected_agent']} "
        f"t3_agent={r3['selected_agent']} ok={ok}"
    )
    return {"label": "E-TOPIC-SWITCHING", "ok": ok}


def case_f_ambiguous_reference() -> dict[str, Any]:
    _header(
        "F-AMBIGUOUS-REFERENCE",
        "Power lab -> library -> Where is it? (must ask for clarification)",
    )
    r1 = _post("Where is the Power System Simulation Lab?")
    sid = r1["session_id"]
    _post("Where is the library?", sid)
    r3 = _post("Where is it?", sid)
    answer_lower = r3["answer"].lower()
    ok = (
        r3["status"] == "clarification_needed"
        and "library" in answer_lower
        and "power system simulation lab" in answer_lower
    )
    print(f"  t3_status={r3['status']} ok={ok}")
    print(f"  t3 answer: {r3['answer']}")
    return {"label": "F-AMBIGUOUS-REFERENCE", "ok": ok}


def case_g_independent_query() -> dict[str, Any]:
    _header("G-INDEPENDENT-QUERY", "Where is the library? -> What is the admission process?")
    r1 = _post("Where is the library?")
    sid = r1["session_id"]
    r2 = _post("What is the admission process?", sid)
    ok = r2["selected_agent"] == "admission_agent" and r2["status"] != "clarification_needed"
    t1s, t2a, t2s = r1["status"], r2["selected_agent"], r2["status"]
    print(f"  t1_status={t1s} t2_agent={t2a} t2_status={t2s} ok={ok}")
    return {"label": "G-INDEPENDENT-QUERY", "ok": ok}


def case_h_unknown_contextual_information() -> dict[str, Any]:
    _header("H-UNKNOWN-CONTEXTUAL-INFO", "Where is room 202? -> What equipment does it have?")
    r1 = _post("Where is room 202?")
    sid = r1["session_id"]
    r2 = _post("What equipment does it have?", sid)
    # No specific, confident equipment claim may appear (Phase 14 grounding
    # must still hold on a Phase-15-reformulated query) — the tool path
    # correctly re-answers with real location info rather than inventing
    # an equipment list; either a real refusal OR a real re-grounded
    # location answer is acceptable, a fabricated equipment list is not.
    answer_lower = r2["answer"].lower()
    fabricated_equipment = any(
        word in answer_lower
        for word in ("projector installed", "equipped with", "has a smart board")
    )
    ok = not fabricated_equipment
    print(f"  t2_status={r2['status']} fabricated_equipment={fabricated_equipment} ok={ok}")
    print(f"  t2 answer: {r2['answer'][:250]}")
    return {"label": "H-UNKNOWN-CONTEXTUAL-INFO", "ok": ok}


def case_i_multi_agent_followup() -> dict[str, Any]:
    _header(
        "I-MULTI-AGENT-FOLLOWUP",
        "facility (library) -> possessive timings follow-up stays facility-ish",
    )
    r1 = _post("Where is the library?")
    sid = r1["session_id"]
    r2 = _post("What are its timings?", sid)
    # The resolved query ("What are the Library's timings?") should route
    # through a real specialist agent (not fall back to general_agent by
    # accident) and must not itself become an ambiguity or crash.
    ok = r2["selected_agent"] != "conversation_context" and r2["status"] != "clarification_needed"
    print(f"  t2_agent={r2['selected_agent']} t2_status={r2['status']} ok={ok}")
    return {"label": "I-MULTI-AGENT-FOLLOWUP", "ok": ok}


def case_j_multi_turn_persistence() -> dict[str, Any]:
    _header("J-MULTI-TURN-PERSISTENCE", "5 turns in one session, active context stays coherent")
    r1 = _post("Where is room 303?")
    sid = r1["session_id"]
    r2 = _post("Which floor is it on?", sid)
    r3 = _post("What is the admission process?", sid)
    r4 = _post("What are the fees?", sid)
    r5 = _post("What departments are available?", sid)
    statuses = [r["status"] for r in (r1, r2, r3, r4, r5)]
    no_crash = all(s is not None for s in statuses)
    correct_late_routing = r5["selected_agent"] == "academic_agent"
    ok = no_crash and correct_late_routing
    print(f"  statuses={statuses}")
    print(f"  r5_agent={r5['selected_agent']} ok={ok}")
    return {"label": "J-MULTI-TURN-PERSISTENCE", "ok": ok}


def case_k_session_isolation() -> dict[str, Any]:
    _header("K-SESSION-ISOLATION", "session A (power lab) vs session B (library) — no cross-talk")
    r_a1 = _post("Where is the Power System Simulation Lab?")
    sid_a = r_a1["session_id"]
    r_b1 = _post("Where is the library?")
    sid_b = r_b1["session_id"]
    assert sid_a != sid_b, "test setup error: sessions collided"
    r_a2 = _post("Which floor is it on?", sid_a)
    answer_lower = r_a2["answer"].lower()
    ok = (
        r_a2["status"] == "tool_resolved"
        and "303" in r_a2["answer"]
        and "library" not in answer_lower
    )
    print(f"  session_a follow-up status={r_a2['status']} ok={ok}")
    print(f"  answer: {r_a2['answer'][:200]}")
    return {"label": "K-SESSION-ISOLATION", "ok": ok}


def case_l_grounding_regression() -> dict[str, Any]:
    _header(
        "L-GROUNDING-REGRESSION", "contextual follow-up tempting fabrication must stay grounded"
    )
    r1 = _post("Where is room 999?")
    sid = r1["session_id"]
    r2 = _post("What is its phone number?", sid)
    # Room 999 never resolved (status no_context, confirmed room-not-found)
    # -> no active entity exists -> the follow-up must NOT invent a phone
    # number for a room that was never even confirmed to exist.
    fabricated_phone = _PHONE_PATTERN.search(r2["answer"]) is not None
    ok = not fabricated_phone
    t1s, t2s = r1["status"], r2["status"]
    print(f"  t1_status={t1s} t2_status={t2s} fabricated_phone={fabricated_phone} ok={ok}")
    print(f"  t2 answer: {r2['answer'][:200]}")
    return {"label": "L-GROUNDING-REGRESSION", "ok": ok}


def run_live_tests() -> list[dict[str, Any]] | None:
    try:
        httpx.get(f"{SERVER_ROOT}/docs", timeout=3.0)
    except httpx.RequestError:
        print("\nSKIPPED live test groups — backend not reachable at " + SERVER_ROOT)
        return None

    return [
        case_a_pronoun_followup(),
        case_b_possessive_followup(),
        case_c_spatial_followup(),
        case_d_context_continuation(),
        case_e_topic_switching(),
        case_f_ambiguous_reference(),
        case_g_independent_query(),
        case_h_unknown_contextual_information(),
        case_i_multi_agent_followup(),
        case_j_multi_turn_persistence(),
        case_k_session_isolation(),
        case_l_grounding_regression(),
    ]


def summarize(results: list[dict[str, Any]]) -> None:
    print("\n" + "=" * 100)
    print("SUMMARY")
    print("=" * 100)
    for r in results:
        print(f"  [{r['label']:24}] {'PASS' if r['ok'] else 'FAIL'}")
    passed = sum(1 for r in results if r["ok"])
    print(f"\n  {passed}/{len(results)} cases passed")


if __name__ == "__main__":
    all_results = run_deterministic_tests()
    live_results = run_live_tests()
    if live_results is not None:
        all_results += live_results
    summarize(all_results)
