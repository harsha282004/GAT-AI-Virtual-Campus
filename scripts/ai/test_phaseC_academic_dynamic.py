"""Phase C -- dynamic academic / institutional responses + safety guards.

Verifies the Phase C additions on top of the committed Phase A/B work:
  * academic_agent's "aggregated" department/program list is naturalized by
    the local Llama model, with a deterministic entity-preservation guard
    (every grounded name must survive the rephrase or the template stands);
  * naturalize_answer() gains a required_entities guard and localized-digit
    normalization for grounded identifiers;
  * refusal / clarification / spatial-evidence paths are untouched;
  * every failure mode (Ollama down, model error, missing entity, wrong
    identifier, hallucinated fact) falls back to the verified template.

Runs against the real local stack (Ollama llama3.2 + ChromaDB + PostgreSQL).
No mocking except the two explicit failure-injection tests (13, 14).

Usage: python scripts/ai/test_phaseC_academic_dynamic.py
"""

from __future__ import annotations

import llm_generator
from _shared import configure_logging
from grounding import find_unsupported_claims
from llm_generator import (
    RESPONSE_LANGUAGE,
    _canon_entity,
    _english_answer_drifts,
    _introduced_digit_runs,
    _missing_grounded_tokens,
    _normalize_grounded_digits,
    naturalize_answer,
)
from supervisor import route

logger = configure_logging("test_phaseC")

_passed = 0
_failed = 0


def check(name: str, ok: bool, detail: str = "") -> None:
    global _passed, _failed
    if ok:
        _passed += 1
        print(f"  PASS  {name}" + (f"  ({detail})" if detail else ""))
    else:
        _failed += 1
        print(f"  FAIL  {name}" + (f"  ({detail})" if detail else ""))


def info(name: str, detail: str = "") -> None:
    """A non-deterministic observation (does a given LLM run naturalize or
    safely fall back?) -- reported, never pass/fail."""
    print(f"  INFO  {name}" + (f"  ({detail})" if detail else ""))


_DEPT_QUERY = "What departments and programs does GAT offer?"


def _aggregated_baseline() -> tuple[list[str], str]:
    """The verified template + its grounded entity set, taken from
    academic_agent itself (not hand-written here)."""
    import academic_agent

    agg = academic_agent._aggregate_departments(_DEPT_QUERY)
    assert agg is not None
    return agg["_required_entities"], agg["answer"]


# --------------------------------------------------------------------------
# TEST 1 -- normal academic factual response (naturalized, grounded)
# TEST 3 -- aggregated list: all grounded entities preserved
# --------------------------------------------------------------------------
def test_1_and_3_academic_aggregated() -> None:
    print("\n[TEST 1 + 3] academic aggregated list -> naturalized, all entities preserved")
    entities, template = _aggregated_baseline()
    r = route(_DEPT_QUERY)
    check("routed to academic_agent", r["selected_agent"] == "academic_agent", r["selected_agent"])
    check("status is 'aggregated' (contract unchanged)", r["generation_status"] == "aggregated")
    check("grounded", r["grounded"] is True)
    check("sources present", len(r.get("sources") or []) >= len(entities) - 2)
    ans = r["answer"]
    naturalized = ans.strip() != template.strip()
    info(
        (
            "answer naturalized by Llama this run"
            if naturalized
            else "Llama output failed a guard this run -> safe template fallback (both are correct)"
        ),
    )
    cand_key = _canon_entity(ans)
    missing = [e for e in entities if _canon_entity(e) not in cand_key]
    check(
        "EVERY grounded department/program name present in the answer", missing == [], str(missing)
    )
    check(
        "no phone/currency/room/year detail introduced",
        find_unsupported_claims(ans, template) == {},
        str(find_unsupported_claims(ans, template)),
    )
    print(f"        answer: {ans[:300]}")


# --------------------------------------------------------------------------
# TEST 2 -- insufficient evidence -> safe refusal / fallback
# TEST 9 -- hallucinated campus fact -> rejected/fallback
# --------------------------------------------------------------------------
def test_2_insufficient_evidence() -> None:
    print("\n[TEST 2] unsupported campus fact -> no fabrication, Llama stays grounded")
    r = route("Is there a Department of Nuclear Engineering at GAT?")
    ans = r["answer"].lower()
    check(
        "answer does not assert a Nuclear Engineering department exists",
        "nuclear engineering department" not in ans
        or "no " in ans
        or "not" in ans
        or "does not" in ans,
        r["answer"][:160],
    )
    # The pipeline is non-deterministic here: depending on the run it either
    # falls to a curated answer, a low-confidence refusal, or a normal
    # grounded "generated" answer that CORRECTLY denies the department. All
    # are acceptable; what must never happen is a confident answer that
    # affirms a Nuclear Engineering department exists.
    affirms = "nuclear engineering department" in ans and not any(
        neg in ans for neg in ("no ", "not ", "does not", "n't", "isn't", "no explicit")
    )
    check(
        "never affirms a Nuclear Engineering department (curated / refusal / honest denial)",
        not affirms,
        f"status={r['generation_status']} answer={r['answer'][:160]!r}",
    )


def test_2b_drift_guard_unit() -> None:
    print("\n[TEST 2b] English drift guard: a contact answer rephrased into an invented list")
    source = (
        "You can reach GAT's admission office at: Phone 080-28603158 / 080-28603157, "
        "Email admissions@gat.ac.in. Address: Global Academy of Technology, Bengaluru 560098."
    )
    invented = (
        "There is a Department of Electronics and Communication Engineering and a "
        "Department of Computer Science and Engineering at Global Academy of Technology."
    )
    check(
        "drift guard rejects the invented department list (mostly new wording)",
        _english_answer_drifts(invented, source),
    )
    faithful = (
        "You can contact GAT's admission office by phone at 080-28603158 or 080-28603157, "
        "or email admissions@gat.ac.in; the address is Global Academy of Technology, Bengaluru."
    )
    check(
        "drift guard accepts a faithful rephrase of the same source",
        not _english_answer_drifts(faithful, source),
    )


def test_9_hallucinated_fact_guard() -> None:
    print("\n[TEST 9] a rephrase that invents a campus fact is rejected by the guards")
    src = "The CSE department is on the Third Floor of the Main Building."
    hallucinated = "The CSE department is on the Third Floor of the Main Building, room 512."
    # room 512 is not in the source -> introduced-claim guard catches it
    check(
        "introduced room number is detected",
        bool(find_unsupported_claims(hallucinated, src)),
        str(find_unsupported_claims(hallucinated, src)),
    )


# --------------------------------------------------------------------------
# TEST 4 -- missing entity -> reject   |   TEST 5 -- complete set -> accept
# --------------------------------------------------------------------------
def test_4_and_5_entity_guard() -> None:
    print("\n[TEST 4 + 5] entity-preservation guard (deterministic membership)")
    required = ["Alpha Dept", "Beta Dept", "Gamma Dept", "Delta Dept"]
    src = "GAT offers: Alpha Dept, Beta Dept, Gamma Dept, Delta Dept."

    # complete set -> accepted (guard passes; LLM may still be used)
    complete = "You can study Alpha Dept, Beta Dept, Gamma Dept and Delta Dept at GAT."
    cand_key = _canon_entity(complete)
    check(
        "TEST 5: complete set -> guard passes",
        all(_canon_entity(e) in cand_key for e in required),
    )

    # missing 'Gamma Dept' -> guard must reject (naturalize would keep template)
    dropped = "You can study Alpha Dept, Beta Dept and Delta Dept at GAT."
    cand_key = _canon_entity(dropped)
    miss = [e for e in required if _canon_entity(e) not in cand_key]
    check("TEST 4: missing entity -> guard rejects", miss == ["Gamma Dept"], str(miss))

    # end-to-end: naturalize_answer with a deliberately-unsatisfiable entity
    # must return the exact source text
    out, used = naturalize_answer(
        "list", src, required_entities=[*required, "Nonexistent Dept That Cannot Appear"]
    )
    check(
        "TEST 4 e2e: unsatisfiable entity -> exact template, used_llm=False",
        out == src and not used,
    )


# --------------------------------------------------------------------------
# TEST 6 -- room identifier preserved   |   TEST 7 -- wrong room -> reject
# --------------------------------------------------------------------------
def test_6_and_7_identifier() -> None:
    print("\n[TEST 6 + 7] room identifier preservation")
    src = "The Library is located in LIB 204."
    out, used = naturalize_answer("where is the library?", src)
    if used:
        check("TEST 6: LIB preserved", "lib" in out.lower())
        check("TEST 6: 204 preserved", "204" in out)
        check("TEST 6: no identifier drifted", find_unsupported_claims(src, out) == {})
    else:
        check("TEST 6: safe fallback to template", out == src)
    # TEST 7: a candidate that drifts the identifier ("204" -> "205") has no
    # "room" keyword for find_unsupported_claims to key on -- the generic
    # introduced-number guard catches it instead.
    wrong = "The Library is located in LIB 205."
    check(
        "TEST 7: drifted identifier digit is detected as introduced",
        _introduced_digit_runs(wrong, src) == {"205"},
        str(_introduced_digit_runs(wrong, src)),
    )
    check(
        "TEST 7: a faithful rephrase introduces no new number",
        _introduced_digit_runs("The library sits in LIB 204 on campus.", src) == set(),
    )


# --------------------------------------------------------------------------
# TEST 8 -- multilingual numeric normalization
# --------------------------------------------------------------------------
def test_8_multilingual_digits() -> None:
    print("\n[TEST 8] localized digit normalization for grounded identifiers")
    check(
        "Devanagari / Kannada / Arabic-Indic digits -> ASCII",
        _normalize_grounded_digits("Room २०४ / ೧೦೧ / ٣٠٥") == "Room 204 / 101 / 305",
    )
    check(
        "letters and meaning untouched", _normalize_grounded_digits("LIB Block A") == "LIB Block A"
    )
    # the grounded-hard-token guard works in ANY language (this is what
    # protects a Kannada/Hindi rephrase that silently drops "LIB 204")
    src = "The Library is located in LIB 204."
    check(
        "dropped identifier detected regardless of language",
        set(_missing_grounded_tokens("पुस्तकालय भवन में है।", src)) == {"LIB", "204"},
        str(_missing_grounded_tokens("पुस्तकालय भवन में है।", src)),
    )
    check(
        "Hindi rephrase that keeps LIB 204 passes the guard",
        _missing_grounded_tokens("पुस्तकालय LIB 204 में स्थित है।", src) == [],
    )
    # end-to-end Hindi: number survives (normalized) OR safe fallback
    token = RESPONSE_LANGUAGE.set("hi")
    try:
        out_hi, used_hi = naturalize_answer("where is the library?", src)
    finally:
        RESPONSE_LANGUAGE.reset(token)
    if used_hi:
        check("Hindi: 204 present as ASCII after normalization", "204" in out_hi, repr(out_hi[:90]))
    else:
        check("Hindi: safe fallback to verified template", out_hi == src)


# --------------------------------------------------------------------------
# TEST 10 -- refusal unchanged   |   TEST 11 -- clarification unchanged
# --------------------------------------------------------------------------
def test_10_refusal() -> None:
    print("\n[TEST 10] out-of-domain question -> fixed refusal, unchanged")
    r = route("What is the capital of France?")
    check("status low_confidence_refusal", r["generation_status"] == "low_confidence_refusal")
    check(
        "exact LOW_CONFIDENCE_MESSAGE",
        r["answer"].strip() == llm_generator.LOW_CONFIDENCE_MESSAGE.strip(),
        r["answer"][:70],
    )


def test_11_clarification() -> None:
    print("\n[TEST 11] ambiguous location -> clarification, not naturalized")
    r = route("Where is the auditorium?")
    check(
        "status clarification_needed or a grounded spatial/tool status",
        r["generation_status"]
        in ("clarification_needed", "tool_resolved", "tool_resolved_low_confidence", "no_context"),
        r["generation_status"],
    )
    if r["generation_status"] == "clarification_needed":
        check("clarification still asks the user to choose", "?" in r["answer"], r["answer"][:120])


# --------------------------------------------------------------------------
# TEST 12 -- spatial evidence enforced (not naturalized away)
# --------------------------------------------------------------------------
def test_12_spatial_evidence() -> None:
    print("\n[TEST 12] spatial answer keeps its inline Evidence: provenance")
    r = route("Where is room 303?")
    check(
        "tool_used spatial_knowledge",
        r.get("tool_used") == "spatial_knowledge",
        str(r.get("tool_used")),
    )
    if r["grounded"] and r["generation_status"].startswith("tool_resolved"):
        check(
            "answer still contains 'Evidence:'",
            "evidence" in r["answer"].lower(),
            r["answer"][:160],
        )


# --------------------------------------------------------------------------
# TEST 13 -- Ollama unavailable -> fallback
# TEST 14 -- model timeout/error -> fallback
# --------------------------------------------------------------------------
def test_13_ollama_unavailable() -> None:
    print("\n[TEST 13] Ollama unavailable -> exact template, never raises")
    src = "The Library is located in LIB 204."
    orig = llm_generator.check_ollama_availability
    llm_generator.check_ollama_availability = lambda m=None: {
        "reachable": False,
        "model_available": False,
        "available_models": [],
        "error": "ConnectionError (injected)",
    }
    try:
        out, used = naturalize_answer("q", src)
        check("returns exact template, used_llm=False", out == src and not used)
    finally:
        llm_generator.check_ollama_availability = orig


def test_14_model_error() -> None:
    print("\n[TEST 14] model raises mid-generation -> exact template, never raises")
    src = "The Library is located in LIB 204."
    orig = llm_generator.ChatOllama

    class _Boom:
        def __init__(self, *a, **k): ...
        def invoke(self, *a, **k):
            raise TimeoutError("injected timeout")

    llm_generator.ChatOllama = _Boom
    try:
        out, used = naturalize_answer("q", src)
        check("returns exact template, used_llm=False", out == src and not used)
    finally:
        llm_generator.ChatOllama = orig


def main() -> None:
    print("=" * 72)
    print("Phase C -- dynamic academic responses + entity / identifier / fallback guards")
    print("=" * 72)
    test_1_and_3_academic_aggregated()
    test_2_insufficient_evidence()
    test_2b_drift_guard_unit()
    test_4_and_5_entity_guard()
    test_6_and_7_identifier()
    test_8_multilingual_digits()
    test_9_hallucinated_fact_guard()
    test_10_refusal()
    test_11_clarification()
    test_12_spatial_evidence()
    test_13_ollama_unavailable()
    test_14_model_error()
    print("\n" + "=" * 72)
    print(f"RESULT: {_passed} passed, {_failed} failed")
    print("=" * 72)
    raise SystemExit(1 if _failed else 0)


if __name__ == "__main__":
    main()
