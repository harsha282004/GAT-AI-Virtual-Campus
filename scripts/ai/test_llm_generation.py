"""Phase 4 — Grounded LLM generation test harness (Step 8-9).

Exercises the full pipeline (hybrid retrieval -> reranking -> confidence ->
generation) end to end via llm_generator.answer_question(), across the
cases the spec calls for: relevant GAT questions, an unrelated question,
a low-confidence case, and Ollama's actual current availability. Reports
whether each answer is grounded/traceable, without ever claiming
hallucination has been eliminated.

Usage: python scripts/ai/test_llm_generation.py
"""

from __future__ import annotations

from _shared import configure_logging
from llm_generator import answer_question, check_ollama_availability
from test_hybrid_retrieval import run_traceability_audit

logger = configure_logging("test_llm_generation")

# This phase's explicitly preferred model. Passed explicitly to every call
# below rather than relying on llm_generator.OLLAMA_MODEL's default,
# because the project's pre-existing .env sets OLLAMA_MODEL=llama3 (a
# legacy default from before this phase existed) — which would otherwise
# silently shadow llama3.2 even though llama3.2 is the model actually
# pulled and the one this phase is meant to exercise.
TEST_MODEL = "llama3.2"

# A, B, C — relevant / institutional questions the knowledge base should
# have real content for.
RELEVANT_QUESTIONS = [
    "What undergraduate programs are offered at GAT?",
    "What departments are available at GAT?",
    "What facilities are available on the campus?",
]

# D — deliberately outside the GAT knowledge base.
UNRELATED_QUESTION = "What is the capital of France?"

# E — chosen to plausibly retrieve only thin/tangential evidence (no
# "trigger a low-confidence result on demand" hook exists, nor should one
# be added just to make a test pass — this is a real query run through the
# real pipeline, same as every other case here).
LOW_CONFIDENCE_CANDIDATE_QUESTION = "What is the exact hostel mess menu for next Tuesday?"


def _print_result(label: str, result: dict) -> dict:
    print("\n" + "=" * 100)
    print(f"[{label}] QUESTION: {result['question']}")
    print("=" * 100)
    print(f"  confidence: {result['confidence']}  ({result['confidence_level']})")
    print(f"  generation_status: {result['generation_status']}")
    print(f"  grounded: {result['grounded']}")
    if result.get("error"):
        print(f"  error: {result['error']}")
    print(f"  answer: {result['answer']}")
    print(f"  sources ({len(result['sources'])}):")
    for s in result["sources"][:5]:
        page_str = f" (page {s['page']})" if s.get("page") else ""
        print(f"    - {s['title']}{page_str}  [{s['source_url']}]")
    return result


def run_tests() -> list[dict]:
    availability = check_ollama_availability(model=TEST_MODEL)
    print("=" * 100)
    print(f"OLLAMA AVAILABILITY CHECK (model={TEST_MODEL})")
    print("=" * 100)
    print(f"  reachable: {availability['reachable']}")
    print(f"  model_available: {availability['model_available']}")
    print(f"  available_models: {availability['available_models']}")
    if availability["error"]:
        print(f"  error: {availability['error']}")

    results = []

    for i, question in enumerate(RELEVANT_QUESTIONS, start=1):
        results.append(
            _print_result(f"RELEVANT-{chr(64 + i)}", answer_question(question, model=TEST_MODEL))
        )

    results.append(
        _print_result("UNRELATED-D", answer_question(UNRELATED_QUESTION, model=TEST_MODEL))
    )
    results.append(
        _print_result(
            "LOW-CONFIDENCE-CANDIDATE-E",
            answer_question(LOW_CONFIDENCE_CANDIDATE_QUESTION, model=TEST_MODEL),
        )
    )

    # F — Ollama-unavailable / failure case. If Ollama genuinely isn't
    # reachable right now (the common case in this dev environment — see
    # the availability check above), the relevant-question results above
    # already exercise this path for real; this section makes that
    # explicit rather than leaving it implicit.
    print("\n" + "=" * 100)
    print("[OLLAMA-FAILURE-CASE-F] Explicit check")
    print("=" * 100)
    if not availability["reachable"] or not availability["model_available"]:
        print("  Ollama/model is NOT available in this environment right now.")
        print(
            "  Every RELEVANT/UNRELATED/LOW-CONFIDENCE result above with "
            "generation_status in {'ollama_unreachable', 'model_unavailable'} "
            "is a real (not simulated) instance of this failure case."
        )
    else:
        print("  Ollama and the preferred model ARE available — failure case not exercised live.")

    return results


def summarize(results: list[dict]) -> None:
    print("\n" + "=" * 100)
    print("SUMMARY")
    print("=" * 100)
    for r in results:
        print(
            f"  [{r['generation_status']:22}] grounded={str(r['grounded']):5}  "
            f"conf={r['confidence']:.4f} ({r['confidence_level']:>6})  {r['question']}"
        )

    generated = [r for r in results if r["generation_status"] == "generated"]
    refused = [r for r in results if r["generation_status"] == "low_confidence_refusal"]
    unavailable = [
        r for r in results if r["generation_status"] in ("ollama_unreachable", "model_unavailable")
    ]
    failed = [r for r in results if r["generation_status"] == "generation_failed"]

    print(
        f"\n  generated={len(generated)}  low_confidence_refusal={len(refused)}  "
        f"ollama_unavailable={len(unavailable)}  generation_failed={len(failed)}  "
        f"total={len(results)}"
    )

    untraceable = [
        r for r in results if r["sources"] and any(not s.get("source_url") for s in r["sources"])
    ]
    print(f"  results with an untraceable (missing source_url) source: {len(untraceable)}")

    print(
        "\n  NOTE: this does not prove hallucination is eliminated — it demonstrates that "
        "generation is confidence-gated and grounded in retrieved, source-traceable context "
        "when it does run, and safely refuses/degrades when it doesn't."
    )


if __name__ == "__main__":
    results = run_tests()
    summarize(results)
    audit = run_traceability_audit()
    print(f"\nCorpus-wide traceability (Phase 1-3 unaffected): {audit}")
