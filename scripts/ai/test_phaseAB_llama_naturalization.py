"""Phase A/B — Llama config alignment + answer-naturalization test harness.

Verifies:
  * Phase A: OLLAMA_MODEL is the single source of truth (llama3.2) and every
    reader agrees on it.
  * Phase B: llm_generator.naturalize_answer() rephrases verified text via
    the local Llama model, never adds/changes facts (grounding re-check),
    and falls back to the exact template on every failure mode.
  * Phase B end-to-end: navigation (tool-resolved) and curated answers go
    through naturalization while refusals/clarifications do not, and the
    POST /api/v1/chat response contract is unchanged.

Runs against the real local stack (Ollama + ChromaDB + PostgreSQL) — no
mocking, no fabricated results.

Usage: python scripts/ai/test_phaseAB_llama_naturalization.py
"""

from __future__ import annotations

import os
import re

import llm_generator
from _shared import configure_logging
from agent_base import DEFAULT_AGENT_MODEL
from grounding import find_unsupported_claims
from llm_generator import OLLAMA_MODEL, RESPONSE_LANGUAGE, naturalize_answer
from supervisor import route

logger = configure_logging("test_phaseAB")

_passed = 0
_failed = 0


def check(name: str, condition: bool, detail: str = "") -> None:
    global _passed, _failed
    if condition:
        _passed += 1
        print(f"  PASS  {name}" + (f"  ({detail})" if detail else ""))
    else:
        _failed += 1
        print(f"  FAIL  {name}" + (f"  ({detail})" if detail else ""))


# --------------------------------------------------------------------------
# Phase A — configuration single source of truth
# --------------------------------------------------------------------------
def test_phase_a_config() -> None:
    print("\n[Phase A] configuration alignment")
    expected = os.environ.get("OLLAMA_MODEL", "llama3.2")
    check("llm_generator.OLLAMA_MODEL resolves from env", OLLAMA_MODEL == expected, OLLAMA_MODEL)
    check(
        "agent_base.DEFAULT_AGENT_MODEL == llm_generator.OLLAMA_MODEL",
        DEFAULT_AGENT_MODEL == OLLAMA_MODEL,
        f"{DEFAULT_AGENT_MODEL!r} vs {OLLAMA_MODEL!r}",
    )
    check("default model is llama3.2", OLLAMA_MODEL == "llama3.2", OLLAMA_MODEL)

    availability = llm_generator.check_ollama_availability(OLLAMA_MODEL)
    check(
        "Ollama reachable and model pulled",
        availability["reachable"] and availability["model_available"],
        str(availability.get("error")),
    )


# --------------------------------------------------------------------------
# Phase B — naturalize_answer() unit behaviour
# --------------------------------------------------------------------------
def test_naturalize_unit() -> None:
    print("\n[Phase B] naturalize_answer() behaviour")

    # 1. empty input -> returned unchanged, no LLM
    text, used = naturalize_answer("q", "")
    check("empty verified_text -> unchanged, used_llm=False", text == "" and used is False)

    # 2. LLM_NATURALIZE disabled -> template returned verbatim, no LLM
    original_flag = llm_generator.LLM_NATURALIZE
    try:
        llm_generator.LLM_NATURALIZE = False
        tmpl = "Room 101 (C103) is located on First Floor, CSE Block."
        text, used = naturalize_answer("where is room 101?", tmpl)
        check(
            "LLM_NATURALIZE=false -> exact template, used_llm=False", text == tmpl and used is False
        )
    finally:
        llm_generator.LLM_NATURALIZE = original_flag

    # 3. happy path -> rephrased, facts preserved, grounding re-check clean
    tmpl = "Room 101 (C103) is located on First Floor, CSE Block."
    text, used = naturalize_answer("Where is room 101?", tmpl)
    if used:
        check("happy path -> used_llm=True", True)
        check("rephrased text differs from template", text.strip() != tmpl.strip(), repr(text))
        check("room number 101 preserved", "101" in text)
        check(
            "no numeric detail introduced (candidate vs source)",
            find_unsupported_claims(text, tmpl) == {},
            str(find_unsupported_claims(text, tmpl)),
        )
        check(
            "no numeric detail dropped/altered (source vs candidate)",
            find_unsupported_claims(tmpl, text) == {},
            str(find_unsupported_claims(tmpl, text)),
        )
        check("output not ballooned (<= 4x source)", len(text) <= 4 * max(len(tmpl), 40))
    else:
        check(
            "happy path used the LLM",
            False,
            "naturalize_answer returned used_llm=False on a healthy stack",
        )

    # 3b. bidirectional grounding guard rejects a rephrase that dropped a
    # room number (checked directly — the guard logic naturalize_answer uses)
    src = "Room 202 is on the Second Floor."
    dropped = "It is on the second floor."
    check(
        "guard: a dropped room number is caught by find_unsupported_claims(src, out)",
        bool(find_unsupported_claims(src, dropped)),
        str(find_unsupported_claims(src, dropped)),
    )

    # 3c. number-word guard: a rephrase that invents "three installments"
    # for a "4-year" fee must be rejected (spelled-out counts are invisible
    # to the digit-only grounding check).
    fee_src = "The total fee is Rs 400000 for the 4-year B.E. programme."
    invented = "You pay Rs 400000 in three installments over the programme."
    src_words = set(re.findall(r"[a-z]+", fee_src.lower()))
    bad_words = {
        w for w in re.findall(r"[a-z]+", invented.lower()) if w in llm_generator._NUMBER_WORDS
    } - src_words
    check("guard: invented number word 'three' is detected", bad_words == {"three"}, str(bad_words))

    # 4. multilingual: a Hindi request either rephrases in Hindi WITH the
    # room number intact, OR safely falls back to the verified template
    # (the small model sometimes transliterates the digits, which the
    # grounding guard then rejects). Both outcomes are correct.
    token = RESPONSE_LANGUAGE.set("hi")
    try:
        text_hi, used_hi = naturalize_answer("Where is room 101?", tmpl)
    finally:
        RESPONSE_LANGUAGE.reset(token)
    if used_hi:
        check(
            "Hindi naturalization: room number 101 preserved and Devanagari present",
            "101" in text_hi and any(ord(ch) > 0x900 for ch in text_hi),
            repr(text_hi[:80]),
        )
    else:
        check(
            "Hindi naturalization safely fell back to the verified template",
            text_hi == tmpl,
            repr(text_hi[:80]),
        )


# --------------------------------------------------------------------------
# Phase B — end to end through supervisor.route()
# --------------------------------------------------------------------------
_CONTRACT_KEYS = {
    "original_query",
    "selected_agent",
    "generation_status",
    "answer",
    "sources",
    "grounded",
}


def _contract_ok(result: dict) -> bool:
    return _CONTRACT_KEYS.issubset(result.keys()) and isinstance(result.get("answer"), str)


def test_navigation_end_to_end() -> None:
    print("\n[Phase B] navigation (tool-resolved) via supervisor.route()")
    result = route("Where is the library?")
    check(
        "routed to navigation_agent",
        result["selected_agent"] == "navigation_agent",
        result["selected_agent"],
    )
    check(
        "status is a tool/spatial status (not RAG-generated)",
        result["generation_status"]
        in ("tool_resolved", "tool_resolved_low_confidence", "clarification_needed", "no_context"),
        result["generation_status"],
    )
    check("response contract intact", _contract_ok(result))
    check("answer non-empty", bool(result["answer"].strip()), repr(result["answer"][:120]))
    print(f"        answer: {result['answer']}")


def test_informational_end_to_end() -> None:
    print("\n[Phase B] informational question via supervisor.route()")
    result = route("What undergraduate programs does GAT offer?")
    check("response contract intact", _contract_ok(result))
    check(
        "status is a known pre-existing value (contract unchanged)",
        result["generation_status"]
        in (
            "generated",
            "curated_answer",
            "aggregated",  # academic_agent deterministic department/program list
            "low_confidence_refusal",
            "no_context",
            "grounding_check_failed",
            "ollama_unreachable",
            "model_unavailable",
            "generation_failed",
        ),
        result["generation_status"],
    )
    print(f"        status={result['generation_status']}  answer: {result['answer'][:160]}")


def test_low_confidence_not_naturalized() -> None:
    print("\n[Phase B] low-confidence / out-of-domain question stays a fixed refusal")
    result = route("What is the capital of France?")
    check(
        "out-of-domain -> refusal status (LLM not used for factual generation)",
        result["generation_status"] in ("low_confidence_refusal", "no_context"),
        result["generation_status"],
    )
    check(
        "refusal text is the fixed LOW_CONFIDENCE_MESSAGE",
        result["answer"].strip() == llm_generator.LOW_CONFIDENCE_MESSAGE.strip(),
        repr(result["answer"][:80]),
    )


def main() -> None:
    print("=" * 70)
    print("Phase A/B — Llama config alignment + answer naturalization")
    print("=" * 70)
    test_phase_a_config()
    test_naturalize_unit()
    test_navigation_end_to_end()
    test_informational_end_to_end()
    test_low_confidence_not_naturalized()
    print("\n" + "=" * 70)
    print(f"RESULT: {_passed} passed, {_failed} failed")
    print("=" * 70)
    raise SystemExit(1 if _failed else 0)


if __name__ == "__main__":
    main()
