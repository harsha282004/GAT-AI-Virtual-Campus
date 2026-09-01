"""Conversational / small-talk intent layer — behaviour tests.

Verifies that:
  * greetings / gratitude / farewell / "how are you" / "what can you do" /
    acknowledgements get a short conversational reply and NEVER touch
    retrieval, BM25, the DB, or the LLM;
  * every campus question ("Where is the library?", "Who is the CSE HOD?",
    aggregated lists, navigation) still routes to the correct agent and is
    completely unchanged;
  * an unsupported campus question still gets the existing safe refusal;
  * the reply follows the request's selected language (RESPONSE_LANGUAGE);
  * detection is strict — a greeting bundled with a real question is NOT
    treated as small talk.

Detection tests are pure/instant. The routing/regression checks call the
real supervisor.route() against the live stack (ChromaDB + PostgreSQL +
Ollama), same as the other test_*.py files here.

Usage: python scripts/ai/test_smalltalk_conversational.py
"""

from __future__ import annotations

import smalltalk
from _shared import configure_logging
from llm_generator import RESPONSE_LANGUAGE
from supervisor import route

logger = configure_logging("test_smalltalk")

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


# --------------------------------------------------------------------------
# 1. detect() — categories + strictness
# --------------------------------------------------------------------------
def test_detection() -> None:
    print("\n[detection] small talk is recognised; campus questions are not")
    expected: list[tuple[str, str | None]] = [
        ("Hi", "greeting"),
        ("Hello", "greeting"),
        ("Hey there", "greeting"),
        ("Hii", "greeting"),
        ("Good morning", "greeting_morning"),
        ("Good afternoon", "greeting_afternoon"),
        ("Good evening", "greeting_evening"),
        ("How are you?", "how_are_you"),
        ("how are you doing", "how_are_you"),
        ("What can you do?", "capabilities"),
        ("who are you", "identity"),
        ("nice to meet you", "nicety"),
        ("Thank you", "gratitude"),
        ("Thanks a lot", "gratitude"),
        ("thank you so much", "gratitude"),
        ("Bye", "farewell"),
        ("goodbye", "farewell"),
        ("see you later", "farewell"),
        ("ok", "acknowledgement"),
        ("got it", "acknowledgement"),
        ("alright", "acknowledgement"),
        # NOT small talk — a real campus question, or a greeting + a question
        ("Where is the library?", None),
        ("Who is the CSE HOD?", None),
        ("What departments are available?", None),
        ("How do I get to the auditorium?", None),
        ("Hi, where is the library?", None),
        ("Good morning, where is the canteen?", None),
        ("How do I bake a chocolate cake?", None),
        ("What is the capital of France?", None),
        ("can you help me with admission", None),
        ("what are the morning class timings", None),
    ]
    for message, want in expected:
        got = smalltalk.detect(message)
        check(f"detect({message!r}) -> {want}", got == want, f"got {got!r}")


# --------------------------------------------------------------------------
# 2. Conversational messages: reply, no RAG, contract intact
# --------------------------------------------------------------------------
_CONTRACT_KEYS = {
    "original_query",
    "selected_agent",
    "generation_status",
    "answer",
    "sources",
    "grounded",
    "confidence_score",
    "confidence_level",
}


def test_conversational_routing() -> None:
    print("\n[routing] conversational messages -> conversation_agent, no retrieval")
    for message in [
        "Hi",
        "Hello",
        "Hey there",
        "Good morning",
        "How are you?",
        "Thank you",
        "Thanks a lot",
        "Bye",
        "What can you do?",
    ]:
        r = route(message)
        check(
            f"{message!r}: selected_agent == conversation_agent",
            r["selected_agent"] == smalltalk.CONVERSATION_AGENT,
            r["selected_agent"],
        )
        check(
            f"{message!r}: status == conversational",
            r["generation_status"] == "conversational",
            r["generation_status"],
        )
        check(f"{message!r}: response contract intact", _CONTRACT_KEYS.issubset(r.keys()))
        check(f"{message!r}: non-empty reply", bool(r["answer"].strip()), repr(r["answer"][:70]))
        check(
            f"{message!r}: no retrieval happened",
            r.get("retrieved_context") == [] and (r.get("sources") or []) == [],
        )
        check(f"{message!r}: no LLM model was used", r.get("model") is None, str(r.get("model")))
        check(
            f"{message!r}: not a tool/navigation/panorama result",
            r.get("tool_used") is None and r.get("navigation") is None,
        )


def test_greeting_reply_text() -> None:
    print("\n[reply] English replies match the intended wording")
    cases = {
        "Hi": "How can I help",
        "Good morning": "Good morning",
        "Good afternoon": "Good afternoon",
        "How are you?": "doing well",
        "Thank you": "welcome",
        "Bye": "Goodbye",
    }
    for message, fragment in cases.items():
        r = route(message)
        check(
            f"{message!r} reply contains {fragment!r}",
            fragment.lower() in r["answer"].lower(),
            repr(r["answer"]),
        )


# --------------------------------------------------------------------------
# 3. Campus questions unchanged
# --------------------------------------------------------------------------
def test_campus_questions_unchanged() -> None:
    print("\n[regression] campus questions still route to the right agent")
    r = route("Where is the library?")
    check(
        "'Where is the library?' -> navigation_agent",
        r["selected_agent"] == "navigation_agent",
        r["selected_agent"],
    )

    r = route("Who is the CSE HOD?")
    check(
        "'Who is the CSE HOD?' -> academic/general agent, grounded pipeline",
        r["selected_agent"] in ("academic_agent", "general_agent"),
        r["selected_agent"],
    )
    check(
        "'Who is the CSE HOD?' NOT conversational",
        r["generation_status"] != "conversational",
        r["generation_status"],
    )

    r = route("Where is room 303?")
    check(
        "'Where is room 303?' -> spatial tool, Evidence preserved",
        r.get("tool_used") == "spatial_knowledge" and "evidence" in r["answer"].lower(),
        r["answer"][:120],
    )

    r = route("What departments are available?")
    check(
        "'What departments are available?' -> academic_agent, aggregated",
        r["selected_agent"] == "academic_agent" and r["generation_status"] == "aggregated",
        r["generation_status"],
    )
    check(
        "aggregated answer still grounded with sources",
        r["grounded"] and len(r.get("sources") or []) > 0,
    )


def test_unsupported_question_still_refuses() -> None:
    print("\n[regression] an unsupported question still gets the safe refusal")
    r = route("What is the capital of France?")
    check(
        "off-topic -> safe refusal (not conversational, not fabricated)",
        r["generation_status"] in ("low_confidence_refusal", "no_context") and not r["grounded"],
        r["generation_status"],
    )


# --------------------------------------------------------------------------
# 4. Multilingual
# --------------------------------------------------------------------------
def test_multilingual_reply() -> None:
    print("\n[multilingual] reply follows RESPONSE_LANGUAGE, English is the fallback")
    for lang, needles in (("hi", ("नमस्ते", "सहायता")), ("kn", ("ನಮಸ್ಕಾರ", "ಸಹಾಯ"))):
        token = RESPONSE_LANGUAGE.set(lang)
        try:
            r = route("Hi")
        finally:
            RESPONSE_LANGUAGE.reset(token)
        check(
            f"{lang}: greeting reply is in {lang}",
            any(n in r["answer"] for n in needles),
            repr(r["answer"]),
        )
        check(f"{lang}: status still conversational", r["generation_status"] == "conversational")

    token = RESPONSE_LANGUAGE.set("fr")  # unsupported -> English fallback
    try:
        r = route("Thank you")
    finally:
        RESPONSE_LANGUAGE.reset(token)
    check(
        "unsupported language -> English fallback reply",
        "welcome" in r["answer"].lower(),
        repr(r["answer"]),
    )

    # native-script greeting is detected directly
    check("Devanagari 'नमस्ते' detected as greeting", smalltalk.detect("नमस्ते") == "greeting")
    check(
        "Kannada 'ಧನ್ಯವಾದಗಳು' detected as gratitude", smalltalk.detect("ಧನ್ಯವಾದಗಳು") == "gratitude"
    )


def main() -> None:
    print("=" * 72)
    print("Conversational / small-talk intent layer")
    print("=" * 72)
    test_detection()
    test_conversational_routing()
    test_greeting_reply_text()
    test_campus_questions_unchanged()
    test_unsupported_question_still_refuses()
    test_multilingual_reply()
    print("\n" + "=" * 72)
    print(f"RESULT: {_passed} passed, {_failed} failed")
    print("=" * 72)
    raise SystemExit(1 if _failed else 0)


if __name__ == "__main__":
    main()
