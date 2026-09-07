"""Phase 4 — Grounded LLM answer generation.

Wires the full pipeline together: hybrid retrieval (Phase 2,
hybrid_retrieval.py) -> reranking (Phase 3, reranker.py) -> confidence
scoring (Phase 3, confidence.py) -> grounded LLM generation (this module)
-> a source-traceable answer. No Phase 1-3 code is modified; this module
only imports and calls it.

LLM runtime: Ollama, called via LangChain (`langchain_ollama.ChatOllama`)
— per the project's approved stack (CLAUDE.md: "LLM ... called via
LangChain — local, no external API key"). No OpenAI or other paid/external
API is ever used. Preferred model for this phase is **llama3.2** (this
phase's explicit instruction); overridable via the existing OLLAMA_MODEL
env var already used by backend/app/core/config.py, so one .env value can
drive both. If Ollama itself is unreachable, or the preferred model isn't
pulled, this is reported as a typed status — never silently substituted
for a different model, and never papered over with a fabricated answer.

Usage:
    from llm_generator import answer_question
    result = answer_question("What undergraduate programs are offered?")

PHASE 14 ADDITION — grounding.find_unsupported_claims() runs on every
successful generation, right before it is returned: a deterministic check
for specific-looking claims (phone numbers, currency amounts, room numbers,
years) in the LLM's own answer that don't trace back to the CONTEXT it was
given. This is a safety net layered on top of the existing confidence gate
below, not a replacement for it — LOW confidence still refuses before the
LLM is even called, as it always has.
"""

from __future__ import annotations

import os
import re
import threading
import time
from contextvars import ContextVar
from typing import Any

import ollama
from _shared import configure_logging
from confidence import compute_confidence
from grounding import build_grounding_failure_result, find_unsupported_claims
from hybrid_retrieval import DEFAULT_CANDIDATE_N, hybrid_search
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_ollama import ChatOllama
from reranker import DEFAULT_TOP_K, rerank

logger = configure_logging("llm_generator")

OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
# PHASE A — single source of truth for the local model: the OLLAMA_MODEL
# env var (see .env.example), defaulting to llama3.2 (the model this
# project actually runs on). backend/app/core/config.py and
# agent_base.DEFAULT_AGENT_MODEL read the same var with the same default,
# so there is exactly one place to change the model.
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.2")
REQUEST_TIMEOUT_S = 60

# PHASE B — naturalization: when true (default), already-verified
# deterministic/tool-resolved and curated answers are rephrased
# conversationally by the same local Llama model before display. Facts are
# never added or changed: naturalize_answer() only ever asks the model to
# rephrase, re-runs the same numeric grounding check against the verified
# source text, and falls straight back to that source text on any failure.
# Set LLM_NATURALIZE=false to always return the raw templates.
LLM_NATURALIZE = os.environ.get("LLM_NATURALIZE", "true").strip().lower() not in (
    "0",
    "false",
    "no",
    "off",
)

# Phase 10 timeout investigation: a single Ollama generation call on this
# CPU-only setup already takes ~7-9s in isolation — already thin against a
# 10s frontend timeout. Measured live: two concurrent chat requests both
# hitting Ollama at once did NOT run at roughly the same ~8s each — they
# both slowed to 17s and 45s respectively (CPU contention), because
# chat.py's handler runs in Starlette's thread pool with no limit on how
# many of those threads can call Ollama at the same moment. This is the
# actual root cause behind reported "timeout of 10000ms exceeded" reports
# under any real concurrent load — not a retrieval/routing/NLU problem
# (retrieval completes in single-digit milliseconds; every routing test in
# this phase resolved correctly and fast). Bounding concurrent Ollama calls
# to 1 turns "N requests all degrade together" into "requests queue and
# each gets the full ~8s service time in turn" — slower under load in
# aggregate (inherent to a single CPU-bound local model), but predictable
# per-request latency instead of an unbounded multiplicative blowup.
# Configurable, not hidden behind a bigger timeout value.
_OLLAMA_MAX_CONCURRENT = int(os.environ.get("OLLAMA_MAX_CONCURRENT_REQUESTS", "1"))
_ollama_semaphore = threading.Semaphore(_OLLAMA_MAX_CONCURRENT)

SYSTEM_PROMPT = """You are the GAT Virtual Campus Assistant, answering questions about \
Global Academy of Technology (GAT) using ONLY the official GAT context supplied to you below.

Rules you must follow exactly:
- Answer only using the supplied CONTEXT. Do not invent GAT facts.
- Do not assume information that is not present in the CONTEXT.
- Do not use general knowledge, prior training data, or assumptions about colleges in \
general to fill in missing GAT-specific information.
- If the CONTEXT does not contain enough information to answer confidently, say so \
explicitly — state that the available official GAT information does not provide a \
reliable answer to this specific question, rather than guessing.
- Never invent faculty names, phone numbers, departments, fees, timings, locations, \
rules, courses, or facilities that are not explicitly stated in the CONTEXT.
- Be concise and useful. Preserve important factual details (numbers, names, dates) \
exactly as given in the CONTEXT.
- If multiple context passages provide information, combine them carefully without \
contradicting each other; if they conflict, note the discrepancy rather than picking \
one arbitrarily.
- Do not mention chunk IDs, retrieval scores, or internal system implementation \
details in your answer — write for a prospective student or visitor, not a developer."""

# Selected UI language for this request ("en"/"kn"/"hi") — set by
# app.api.v1.chat.chat() at the top of each request (same thread, plain
# synchronous call chain down to generate_answer() below, so no cross-
# thread propagation concern) and read here only, to append a language
# instruction to the system prompt. Never touches retrieval, embeddings,
# the intent classifier, or navigation — this is the smallest change that
# makes generation itself language-aware, per this phase's instruction.
RESPONSE_LANGUAGE: ContextVar[str] = ContextVar("response_language", default="en")

_LANGUAGE_INSTRUCTIONS: dict[str, str] = {
    "kn": (
        "\n\nRespond in natural, fluent Kannada (ಕನ್ನಡ) — not a literal "
        "word-for-word translation. Keep proper nouns exactly as given in the "
        "CONTEXT and untranslated: GAT, Global Academy of Technology, VTU, "
        "department abbreviations (CSE, ISE, ECE, EEE, ME, CE), person names, "
        "room/building numbers, and URLs."
    ),
    "hi": (
        "\n\nRespond in natural, fluent Hindi (हिन्दी) — not a literal "
        "word-for-word translation. Keep proper nouns exactly as given in the "
        "CONTEXT and untranslated: GAT, Global Academy of Technology, VTU, "
        "department abbreviations (CSE, ISE, ECE, EEE, ME, CE), person names, "
        "room/building numbers, and URLs."
    ),
}

MEDIUM_CONFIDENCE_ADDENDUM = (
    "\n\nThe retrieved context for this question is only moderately relevant. "
    "If you are not fully certain the context actually answers the question, say so "
    "explicitly rather than guessing, and describe only what the context does support."
)

LOW_CONFIDENCE_MESSAGE = (
    "The available official GAT information does not provide a reliable answer to this "
    "question. Please check the official GAT website (https://www.gat.ac.in/) or contact "
    "the institution directly for accurate information."
)

# PHASE B/C — the ONE naturalization system prompt, reused by every caller
# (agent_base curated answers, navigation_agent tool answers, academic_agent
# aggregated lists). The first two sentences are verbatim from the Phase B
# specification; the rest reinforces "rephrase only, invent nothing" against
# a small local model's tendencies. A language instruction
# (_LANGUAGE_INSTRUCTIONS) is appended per request so Kannada/Hindi work.
NATURALIZE_SYSTEM_PROMPT = (
    "You are the response-generation layer of a grounded campus assistant. "
    "Rephrase the following verified information as a natural, conversational "
    "response in the user's language. Do not add, infer, remove, or change any "
    "facts, numbers, names, room numbers, building codes, locations, URLs, "
    "dates, timings, contact details, or other factual information. If the "
    "verified information is a list, include every item exactly once and change "
    "none of the item names. Keep the response short and do not add any "
    "greeting, opinion, directions, or suggestion that is not present in the "
    "verified information. Never use your own knowledge about this or any "
    "college."
)

# A rephrase should never balloon; output much longer than the source
# almost certainly means the model added content, so it is rejected in
# favour of the verified template.
_NATURALIZE_MAX_EXPANSION = 4.0

# Cardinal number words. If a naturalized answer introduces one of these
# that is not in the verified source (e.g. inventing "three installments"
# for a "4-year" fee), the rephrase is rejected — the deterministic
# numeric grounding check only sees digit strings, not spelled-out counts.
_NUMBER_WORDS = frozenset(
    "zero one two three four five six seven eight nine ten eleven twelve "
    "thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty "
    "thirty forty fifty sixty seventy eighty ninety hundred thousand "
    "million billion".split()
)

# PHASE C — localized decimal digits -> ASCII. A small local model in
# Kannada/Hindi mode sometimes renders a grounded identifier ("Room 204")
# with Devanagari/Kannada digits, which then fails the digit-based
# grounding check. Normalizing digit CODEPOINTS only (never letters, never
# meaning) lets the identifier verify against the source instead of forcing
# a fall back to the English template. Covers Devanagari, Kannada, Telugu,
# Tamil, Bengali, Gurmukhi, Gujarati, Arabic-Indic and full-width digits.
_LOCALIZED_DIGIT_RANGES = (
    0x0660,  # Arabic-Indic
    0x06F0,  # Extended Arabic-Indic
    0x0966,  # Devanagari
    0x09E6,  # Bengali
    0x0A66,  # Gurmukhi
    0x0AE6,  # Gujarati
    0x0BE6,  # Tamil
    0x0C66,  # Telugu
    0x0CE6,  # Kannada
    0xFF10,  # Full-width
)
_DIGIT_TRANSLATION = {base + d: ord("0") + d for base in _LOCALIZED_DIGIT_RANGES for d in range(10)}


def _normalize_grounded_digits(text: str) -> str:
    """Map localized decimal digits to ASCII 0-9. Digit characters only."""
    return text.translate(_DIGIT_TRANSLATION)


# PHASE C — generic "did the rephrase invent a number" guard. A drifted
# identifier digit ("LIB 204" -> "LIB 205", "Block 3" -> "Block 5") carries
# no "room"/phone/year keyword for grounding.find_unsupported_claims() to
# key on, so that check alone would miss it. Digit runs shorter than this
# are ignored for the same reason grounding.py ignores them (incidental list
# counts, single/two-digit numbers coincidentally matching).
_MIN_GROUNDED_DIGIT_RUN = 3


def _introduced_digit_runs(candidate: str, source: str) -> set[str]:
    """Digit runs of >= _MIN_GROUNDED_DIGIT_RUN digits that appear in
    ``candidate`` but nowhere in ``source`` (thousand-separator commas
    stripped first, so "50,000" == "50000")."""

    def runs(value: str) -> set[str]:
        value = re.sub(r"(?<=\d),(?=\d)", "", value)
        return {r for r in re.findall(r"\d+", value) if len(r) >= _MIN_GROUNDED_DIGIT_RUN}

    return runs(candidate) - runs(source)


# PHASE C — "hard" grounded tokens that must survive a rephrase VERBATIM in
# every language. The naturalization prompt already tells the model to keep
# proper nouns / codes / numbers / URLs untranslated; this verifies it
# actually did. Without it, a Kannada/Hindi rephrase that silently drops
# "LIB 204" (or invents a whole new answer) passes every other guard,
# because those are English-only or digit-in-a-keyword-context only.
_URL_OR_EMAIL = re.compile(r"https?://\S+|\b[\w.+-]+@[\w-]+\.[\w.-]+\b", re.IGNORECASE)
_ACRONYM = re.compile(r"\b[A-Z]{2,}\b")  # GAT, VTU, CSE, ISE, LIB, KCET, AI, ML...
# a digit run standing on its own — not the "103" inside a "C103" room code,
# which the model may legitimately reword, and not a 1-2 digit incidental.
_STANDALONE_NUMBER = re.compile(r"(?<![A-Za-z0-9])\d{3,}(?![A-Za-z0-9])")


def _missing_grounded_tokens(candidate: str, source: str) -> list[str]:
    """Tokens present in ``source`` that a faithful rephrase must still
    contain — standalone >= _MIN_GROUNDED_DIGIT_RUN-digit numbers, pure
    ALL-CAPS acronyms / codes (GAT, LIB, CSE, ...), and URLs / emails —
    that are absent from ``candidate`` (compared case-insensitively; digits
    already ASCII-normalized by the caller). A non-empty list means a
    grounded identifier was dropped or the model wandered off the source
    entirely -> keep the verified template."""
    cand_low = candidate.lower()
    no_thousands = re.sub(r"(?<=\d),(?=\d)", "", source)
    required = (
        _STANDALONE_NUMBER.findall(no_thousands)
        + _ACRONYM.findall(source)
        + _URL_OR_EMAIL.findall(source)
    )
    seen: set[str] = set()
    missing: list[str] = []
    for tok in required:
        key = tok.lower()
        if key in seen:
            continue
        seen.add(key)
        if key not in cand_low:
            missing.append(tok)
    return missing


# PHASE C — words too common to signal "the model wandered off the source".
# Used only by _english_answer_drifts() below.
_DRIFT_STOPWORDS = frozenset(
    "this that these those there their they them then than with without into "
    "onto from your yours will would shall should must have here does did "
    "done been being also more most some such only just very much many both "
    "each what when where which while about above below because however "
    "therefore please note information following provide contact located "
    "location".split()
)


def _english_answer_drifts(candidate: str, source: str) -> bool:
    """True when an English rephrase is *mostly* words that never occur in
    the verified source — the signature of a small local model answering
    from its own knowledge instead of rephrasing (observed live: a
    contact-office answer rephrased into an invented list of departments,
    which no numeric/entity guard caught because it introduced no numbers
    and had no required_entities).

    English only. A Kannada/Hindi rephrase shares almost no tokens with the
    English source by design, so this is skipped for those languages and the
    digit / number-word / entity / length guards carry the load there."""
    source_low = source.lower()
    tokens = [w for w in re.findall(r"[a-z]{4,}", candidate.lower()) if w not in _DRIFT_STOPWORDS]
    if len(tokens) < 6:
        return False
    novel = [w for w in tokens if w not in source_low]
    return len(novel) >= 4 and len(novel) / len(tokens) > 0.5


def _canon_entity(value: str) -> str:
    """Fold a list-item name to a comparison key: lowercase, ``&`` -> ``and``,
    every run of non-alphanumerics -> a single space. So
    'Computer Science & Engineering (AI & ML)' and
    'computer science and engineering, ai and ml' compare equal."""
    value = value.lower().replace("&", " and ")
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", value)).strip()


def warmup_model(model: str = OLLAMA_MODEL) -> None:
    """Preloads `model` into Ollama's memory with an empty-prompt generate
    call (Ollama's documented warmup pattern — loads weights without
    generating tokens) and keeps it resident for 30 minutes. Without this,
    the FIRST real chat request after a backend restart pays Ollama's
    multi-second model-load cost on top of normal generation latency,
    which can push a single request past the frontend's 10s axios timeout
    (frontend/src/api/client.ts) even though retrieval/confidence were
    already fast. Called once at startup (see app.main's lifespan calling
    app.api.v1.chat.warmup()), same spirit as that function's existing
    retriever/reranker warmup. Never raises — if Ollama is unreachable at
    boot, the first real request will surface that the normal way."""
    try:
        ollama.Client(host=OLLAMA_BASE_URL).generate(model=model, prompt="", keep_alive="30m")
    except Exception as exc:  # noqa: BLE001 — warmup failing must not crash startup
        logger.warning("Ollama model warmup failed (will retry on first real request): %s", exc)


def check_ollama_availability(model: str = OLLAMA_MODEL) -> dict[str, Any]:
    """Probes the local Ollama service directly (cheaper and clearer than
    instantiating a ChatOllama and sending a full chat request just to test
    reachability). Never raises — always returns a status dict so callers
    can degrade gracefully instead of crashing."""
    try:
        response = ollama.Client(host=OLLAMA_BASE_URL).list()
    except Exception as exc:
        return {
            "reachable": False,
            "model_available": False,
            "available_models": [],
            "error": f"{type(exc).__name__}: {exc}",
        }

    available_models = [m.model for m in response.models if m.model]
    # Match ignoring tag (":latest" etc.) so "llama3.2" matches "llama3.2:latest".
    model_available = any(name.split(":")[0] == model.split(":")[0] for name in available_models)
    return {
        "reachable": True,
        "model_available": model_available,
        "available_models": available_models,
        "error": None if model_available else f"model '{model}' not found in `ollama list`",
    }


def _build_context_block(context_chunks: list[dict[str, Any]]) -> str:
    parts = []
    for i, chunk in enumerate(context_chunks, start=1):
        title = chunk.get("source_title") or chunk.get("source_url") or "unknown source"
        parts.append(f"[{i}] (Source: {title})\n{chunk.get('text', '')}")
    return "\n\n".join(parts)


def _build_sources(context_chunks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Sources are assembled from the retrieved chunks' own metadata only —
    never parsed out of the LLM's generated text — so a citation can never
    exist unless it traces back to an actual retrieved chunk."""
    sources = []
    for chunk in context_chunks:
        sources.append(
            {
                "title": chunk.get("source_title"),
                "source_url": chunk.get("source_url"),
                "page": chunk.get("page"),
            }
        )
    return sources


def _validate_inputs(
    query: str, context_chunks: list[dict[str, Any]], confidence: dict[str, Any]
) -> None:
    if not query or not query.strip():
        raise ValueError("query must be a non-empty string")
    if not isinstance(context_chunks, list):
        raise ValueError("context_chunks must be a list")
    if "category" not in confidence or "confidence" not in confidence:
        raise ValueError("confidence must be a confidence.compute_confidence() result")


def generate_answer(
    query: str,
    retrieved_context: list[dict[str, Any]],
    confidence: dict[str, Any],
    model: str = OLLAMA_MODEL,
) -> dict[str, Any]:
    """query -> grounded, source-traceable answer.

    retrieved_context: reranker.rerank() output (chunk_id/text/source_url/
    source_title/page/... per chunk).
    confidence: confidence.compute_confidence() output for this same
    retrieved_context — reused as-is, no new confidence math here.
    """
    _validate_inputs(query, retrieved_context, confidence)
    category = confidence["category"]
    sources = _build_sources(retrieved_context)

    if not retrieved_context:
        return {
            "question": query,
            "answer": LOW_CONFIDENCE_MESSAGE,
            "confidence": confidence["confidence"],
            "confidence_level": category,
            "sources": [],
            "grounded": False,
            "generation_status": "no_context",
            "model": None,
        }

    # Step 5 — confidence-aware generation: LOW confidence skips the LLM
    # entirely and returns a fixed safe response. This is deliberate, not
    # a fallback-of-convenience — low confidence means retrieval itself
    # already signaled the evidence is too weak to trust, so asking the
    # LLM to "try anyway" would just move the risk of an unsupported
    # answer from retrieval into generation instead of removing it.
    if category == "LOW":
        return {
            "question": query,
            "answer": LOW_CONFIDENCE_MESSAGE,
            "confidence": confidence["confidence"],
            "confidence_level": category,
            "sources": sources,
            "grounded": False,
            "generation_status": "low_confidence_refusal",
            "model": None,
        }

    availability = check_ollama_availability(model)
    if not availability["reachable"]:
        logger.warning("Ollama unreachable: %s", availability["error"])
        return {
            "question": query,
            "answer": None,
            "confidence": confidence["confidence"],
            "confidence_level": category,
            "sources": sources,
            "grounded": False,
            "generation_status": "ollama_unreachable",
            "model": None,
            "error": availability["error"],
        }
    if not availability["model_available"]:
        logger.warning(
            "Preferred model '%s' not available in Ollama (have: %s)",
            model,
            availability["available_models"],
        )
        return {
            "question": query,
            "answer": None,
            "confidence": confidence["confidence"],
            "confidence_level": category,
            "sources": sources,
            "grounded": False,
            "generation_status": "model_unavailable",
            "model": model,
            "error": availability["error"],
        }

    system_prompt = SYSTEM_PROMPT
    if category == "MEDIUM":
        system_prompt += MEDIUM_CONFIDENCE_ADDENDUM
    language_instruction = _LANGUAGE_INSTRUCTIONS.get(RESPONSE_LANGUAGE.get())
    if language_instruction:
        system_prompt += language_instruction

    context_block = _build_context_block(retrieved_context)
    user_prompt = (
        f"CONTEXT:\n{context_block}\n\nQUESTION: {query}\n\nAnswer using only the CONTEXT above."
    )

    try:
        llm = ChatOllama(
            base_url=OLLAMA_BASE_URL,
            model=model,
            client_kwargs={"timeout": REQUEST_TIMEOUT_S},
        )
        wait_start = time.perf_counter()
        with _ollama_semaphore:
            queue_wait_s = time.perf_counter() - wait_start
            if queue_wait_s > 0.05:
                logger.info(
                    "Ollama call queued %.2fs behind another in-flight generation "
                    "(max concurrent=%d)",
                    queue_wait_s,
                    _OLLAMA_MAX_CONCURRENT,
                )
            response = llm.invoke(
                [SystemMessage(content=system_prompt), HumanMessage(content=user_prompt)]
            )
        answer_text = (
            response.content if isinstance(response.content, str) else str(response.content)
        )
    except Exception as exc:  # noqa: BLE001 — any Ollama/LangChain failure degrades, never crashes
        logger.error("Ollama generation failed: %s: %s", type(exc).__name__, exc)
        return {
            "question": query,
            "answer": None,
            "confidence": confidence["confidence"],
            "confidence_level": category,
            "sources": sources,
            "grounded": False,
            "generation_status": "generation_failed",
            "model": model,
            "error": f"{type(exc).__name__}: {exc}",
        }

    answer_text = answer_text.strip()
    unsupported_claims = find_unsupported_claims(answer_text, context_block)
    if unsupported_claims:
        logger.warning(
            "Grounding check failed for query=%r: unsupported claims %s in generated answer",
            query,
            unsupported_claims,
        )
        return build_grounding_failure_result(query, confidence, sources, model, unsupported_claims)

    return {
        "question": query,
        "answer": answer_text,
        "confidence": confidence["confidence"],
        "confidence_level": category,
        "sources": sources,
        "grounded": True,
        "generation_status": "generated",
        "model": model,
    }


def naturalize_answer(
    query: str,
    verified_text: str,
    *,
    model: str = OLLAMA_MODEL,
    required_entities: list[str] | None = None,
    context: str = "naturalize",
) -> tuple[str, bool]:
    """PHASE B/C — rephrase already-verified deterministic/curated/aggregated
    text conversationally via the local Llama model.

    ``required_entities`` (PHASE C): every string here must still appear in
    the rephrase (``&``/punctuation/whitespace-folded, case-insensitive).
    Used for aggregated lists so the model cannot silently drop a
    department/program. ``context`` only tags log lines.

    Returns ``(text, used_llm)``. The returned ``text`` is ALWAYS safe to
    show: on any failure — LLM_NATURALIZE disabled, empty input, Ollama
    unreachable, model missing, timeout, exception, empty output, output
    that balloons past _NATURALIZE_MAX_EXPANSION, output that fails the
    numeric grounding check generate_answer() uses (run BOTH ways against
    ``verified_text`` after localized digits are normalized to ASCII: no
    phone/currency/room/year detail introduced, none dropped or altered),
    output that introduces a spelled-out number word absent from the
    source, output that introduces any other >=3-digit number absent from
    the source (a drifted identifier), output that DROPS a grounded hard
    token present in the source (a >=3-digit number, an ALL-CAPS acronym /
    building code, a URL / email — checked in every language), an English
    rephrase that is mostly wording absent from the source (the model
    answered from its own knowledge), or output missing a
    ``required_entities`` item — this returns ``(verified_text, False)``
    and the caller shows the original template unchanged. It never raises.

    Facts are neither added nor removed: the model is only asked to
    rephrase (NATURALIZE_SYSTEM_PROMPT), its output is grounding-checked
    both directions against the source text, and the source text is the
    fallback.
    """
    if not LLM_NATURALIZE:
        return verified_text, False
    text = (verified_text or "").strip()
    if not text:
        return verified_text, False

    try:
        availability = check_ollama_availability(model)
        if not (availability["reachable"] and availability["model_available"]):
            logger.info(
                "[%s] naturalization skipped (ollama unavailable: %s); keeping template.",
                context,
                availability["error"],
            )
            return verified_text, False

        system_prompt = NATURALIZE_SYSTEM_PROMPT
        language_instruction = _LANGUAGE_INSTRUCTIONS.get(RESPONSE_LANGUAGE.get())
        if language_instruction:
            system_prompt += language_instruction

        user_prompt = (
            f"USER QUESTION: {query}\n\n"
            f"VERIFIED INFORMATION (rephrase this exactly, add nothing):\n{text}"
        )

        llm = ChatOllama(
            base_url=OLLAMA_BASE_URL,
            model=model,
            client_kwargs={"timeout": REQUEST_TIMEOUT_S},
        )
        started = time.perf_counter()
        with _ollama_semaphore:
            response = llm.invoke(
                [SystemMessage(content=system_prompt), HumanMessage(content=user_prompt)]
            )
        elapsed_ms = (time.perf_counter() - started) * 1000
        candidate = (
            response.content if isinstance(response.content, str) else str(response.content)
        ).strip()
        # PHASE C — fold localized digits in a grounded identifier back to
        # ASCII (digit codepoints only) BEFORE every check, and return this
        # normalized form.
        candidate = _normalize_grounded_digits(candidate)

        if not candidate:
            return verified_text, False
        if len(candidate) > _NATURALIZE_MAX_EXPANSION * max(len(text), 40):
            logger.warning(
                "[%s] naturalization output ballooned for query=%r; keeping template.",
                context,
                query,
            )
            return verified_text, False

        # Same deterministic grounding check generate_answer() applies, run
        # BOTH directions: the rephrase may neither INTRODUCE a
        # phone/currency/room/year detail absent from the source
        # (candidate vs text) nor DROP OR ALTER one present in the source
        # (text vs candidate). Either failure -> keep the verified template.
        introduced = find_unsupported_claims(candidate, text)
        dropped = find_unsupported_claims(text, candidate)
        if introduced or dropped:
            logger.warning(
                "[%s] naturalization changed a verifiable detail for query=%r "
                "(introduced=%s dropped=%s); keeping template.",
                context,
                query,
                introduced,
                dropped,
            )
            return verified_text, False

        # find_unsupported_claims only sees digit strings — also reject a
        # rephrase that introduces a spelled-out count absent from the
        # source (e.g. "three installments" for a "4-year" fee).
        src_words = set(re.findall(r"[a-z]+", text.lower()))
        new_number_words = {
            w for w in re.findall(r"[a-z]+", candidate.lower()) if w in _NUMBER_WORDS
        } - src_words
        if new_number_words:
            logger.warning(
                "[%s] naturalization introduced number word(s) %s absent from the source "
                "for query=%r; keeping template.",
                context,
                sorted(new_number_words),
                query,
            )
            return verified_text, False

        # PHASE C — every grounded "hard" token (>=3-digit number, ALL-CAPS
        # acronym / building code, URL / email) in the source must survive
        # the rephrase verbatim, in ANY language. This is the one guard that
        # also protects Kannada/Hindi output: it catches a rephrase that
        # dropped "LIB 204" or wandered off the source entirely, which the
        # English-only drift check and the keyword-scoped
        # find_unsupported_claims both miss.
        missing_tokens = _missing_grounded_tokens(candidate, text)
        if missing_tokens:
            logger.warning(
                "[%s] naturalization dropped grounded token(s) %s for query=%r; "
                "keeping template.",
                context,
                missing_tokens,
                query,
            )
            return verified_text, False

        # PHASE C — a rephrase must not invent a number that has no
        # room/phone/year keyword for the check above to catch (drifted
        # identifiers, "Block 3" -> "Block 5", an invented count).
        invented_numbers = _introduced_digit_runs(candidate, text)
        if invented_numbers:
            logger.warning(
                "[%s] naturalization introduced number(s) %s absent from the source "
                "for query=%r; keeping template.",
                context,
                sorted(invented_numbers),
                query,
            )
            return verified_text, False

        # PHASE C — an English rephrase that is mostly words absent from the
        # verified source means the model answered from its own knowledge
        # (observed: a contact answer rephrased into an invented department
        # list). Skipped for kn/hi, where token overlap with the English
        # source is near zero by design.
        if RESPONSE_LANGUAGE.get() == "en" and _english_answer_drifts(candidate, text):
            logger.warning(
                "[%s] naturalization drifted off the verified source (mostly new "
                "wording) for query=%r; keeping template.",
                context,
                query,
            )
            return verified_text, False

        # PHASE C — deterministic entity-preservation guard for lists.
        if required_entities:
            cand_key = _canon_entity(candidate)
            missing = [
                e
                for e in required_entities
                if _canon_entity(e) and _canon_entity(e) not in cand_key
            ]
            if missing:
                logger.warning(
                    "[%s] naturalization dropped required list item(s) %s for query=%r; "
                    "keeping template.",
                    context,
                    missing,
                    query,
                )
                return verified_text, False

        logger.info(
            "[%s] naturalized answer for query=%r in %.0f ms (%d required entities checked)",
            context,
            query,
            elapsed_ms,
            len(required_entities or []),
        )
        return candidate, True
    except Exception as exc:  # noqa: BLE001 — naturalization must never break a request
        logger.warning(
            "[%s] naturalization failed (%s: %s); keeping template answer.",
            context,
            type(exc).__name__,
            exc,
        )
        return verified_text, False


def answer_question(
    query: str, top_k: int = DEFAULT_TOP_K, model: str = OLLAMA_MODEL
) -> dict[str, Any]:
    """Full pipeline convenience function: hybrid retrieval -> reranking ->
    confidence -> grounded generation, exactly matching this phase's
    diagram. Reuses Phase 2/3 code as-is (hybrid_search, rerank,
    compute_confidence) — no retrieval/reranking/confidence logic is
    duplicated here."""
    candidates = hybrid_search(query, top_k=DEFAULT_CANDIDATE_N)
    reranked = rerank(query, candidates, top_k=top_k)
    confidence = compute_confidence(reranked, query)
    return generate_answer(query, reranked, confidence, model=model)


if __name__ == "__main__":
    demo_query = "What undergraduate programs are offered at GAT?"
    availability = check_ollama_availability()
    print(f"Ollama availability: {availability}")
    result = answer_question(demo_query)
    print(f"\nQuestion: {result['question']}")
    print(
        f"Status: {result['generation_status']}  "
        f"(confidence={result['confidence']}, {result['confidence_level']})"
    )
    print(f"Answer: {result['answer']}")
    print(f"Sources: {result['sources']}")
