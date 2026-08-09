"""Phase 7 — End-to-end test suite for POST /api/v1/chat.

Unlike every other scripts/ai/test_*.py, this one does NOT import the
pipeline directly — it makes real HTTP requests against a *running*
backend server (`uvicorn app.main:app --app-dir backend`), exactly as the
frontend does, to prove the actual wired-up endpoint works end to end
(Supervisor -> agent -> RAG/tools -> reranking/confidence -> Llama 3.2 ->
structured response), not just the underlying scripts/ai/ functions in
isolation (already covered by test_multi_agent.py / test_campus_tools.py).

Usage: python scripts/ai/test_chat_api.py
(requires the backend to already be running on BASE_URL)
"""

from __future__ import annotations

from typing import Any

import httpx
from _shared import configure_logging
from campus_tools import contact_lookup

logger = configure_logging("test_chat_api")

SERVER_ROOT = "http://127.0.0.1:8000"
BASE_URL = f"{SERVER_ROOT}/api/v1"
TIMEOUT_S = 60.0


def _post(message: str, session_id: str | None = None) -> httpx.Response:
    payload: dict[str, Any] = {"message": message}
    if session_id is not None:
        payload["session_id"] = session_id
    return httpx.post(f"{BASE_URL}/chat", json=payload, timeout=TIMEOUT_S)


def check_backend_reachable() -> bool:
    try:
        response = httpx.get(f"{SERVER_ROOT}/docs", timeout=5.0)
        return response.status_code == 200
    except httpx.RequestError as exc:
        logger.error("Backend not reachable at %s: %s", SERVER_ROOT, exc)
        return False


def _print_case(label: str, description: str, response: httpx.Response) -> dict[str, Any]:
    print("\n" + "=" * 100)
    print(f"[{label}] {description}")
    print("=" * 100)
    print(f"  HTTP status: {response.status_code}")
    if response.status_code != 200:
        print(f"  body: {response.text}")
        return {"label": label, "status_code": response.status_code, "body": response.json()}

    data = response.json()
    print(f"  selected_agent: {data.get('selected_agent')}")
    print(f"  status: {data.get('status')}")
    print(f"  confidence: {data.get('confidence')} ({data.get('confidence_level')})")
    print(f"  tool_used: {data.get('tool_used')}")
    print(f"  answer: {data.get('answer')}")
    if data.get("sources"):
        print(
            f"  sources: {len(data['sources'])} (untraceable: "
            f"{sum(1 for s in data['sources'] if not s.get('source_url'))})"
        )
    if data.get("navigation"):
        print(
            f"  navigation: {data['navigation']['from_label']} -> {data['navigation']['to_label']}"
            f" ({data['navigation']['total_distance']}m)"
        )
    if data.get("panorama"):
        print(f"  panorama: {data['panorama']['title']}")
    print(f"  session_id: {data.get('session_id')}")
    return {"label": label, "status_code": response.status_code, "body": data}


def run_tests() -> list[dict[str, Any]]:
    results = []

    results.append(
        _print_case(
            "1-CAMPUS-FACTUAL",
            "What facilities are available on campus?",
            _post("What facilities are available on campus?"),
        )
    )
    results.append(
        _print_case(
            "2-ADMISSION-ACADEMIC",
            "What undergraduate programs are offered?",
            _post("What undergraduate programs are offered?"),
        )
    )
    results.append(_print_case("3-ROOM-LOOKUP", "Where is Room 101?", _post("Where is Room 101?")))
    results.append(
        _print_case("4-NAVIGATION", "How do I get to Room 101?", _post("How do I get to Room 101?"))
    )
    results.append(
        _print_case(
            "5-PANORAMA-TOUR",
            "Show me the route to the auditorium. (real ambiguity expected — "
            "both a room and a building named 'Auditorium' exist)",
            _post("Show me the route to the auditorium."),
        )
    )

    # 6 — follow-up question via session support.
    first = _post("Where is the auditorium?")
    first_data = first.json()
    session_id = first_data.get("session_id")
    followup = _post("How do I get there?", session_id=session_id)
    print("\n" + "=" * 100)
    print("[6-FOLLOWUP] 'Where is the auditorium?' -> 'How do I get there?' (same session_id)")
    print("=" * 100)
    print(f"  turn 1: status={first_data.get('status')} answer={first_data.get('answer')}")
    followup_data = followup.json()
    print(f"  turn 2: status={followup_data.get('status')} answer={followup_data.get('answer')}")
    results.append(
        {"label": "6-FOLLOWUP", "status_code": followup.status_code, "body": followup_data}
    )

    results.append(
        _print_case(
            "7-UNSUPPORTED-CAMPUS-QUESTION",
            "What is the exact hostel mess menu for next Tuesday? (plausible GAT "
            "question, not covered by the knowledge base)",
            _post("What is the exact hostel mess menu for next Tuesday?"),
        )
    )
    results.append(
        _print_case(
            "8-UNRELATED",
            "What is the capital of France?",
            _post("What is the capital of France?"),
        )
    )

    # 9 — tool failure/unavailable. contact_lookup is the one NOT AVAILABLE
    # tool (Phase 6), but no agent currently routes any query to it, so
    # this can't be triggered through the chat endpoint itself — tested
    # directly instead, same as Phase 6's own H-TOOL-UNAVAILABLE case, and
    # honestly reported as such rather than faked through a chat message.
    print("\n" + "=" * 100)
    print("[9-TOOL-UNAVAILABLE] campus_tools.contact_lookup() — not reachable via /chat")
    print("=" * 100)
    contact_result = contact_lookup("official phone number")
    print(f"  status: {contact_result['status']}")
    print(f"  note: {contact_result['note']}")
    results.append({"label": "9-TOOL-UNAVAILABLE", "status_code": None, "body": contact_result})

    results.append(_print_case("10a-EMPTY-MESSAGE", "message=''", _post("")))
    print("\n" + "=" * 100)
    print("[10b-MISSING-FIELD] POST {} (no 'message' key at all)")
    print("=" * 100)
    missing_response = httpx.post(f"{BASE_URL}/chat", json={}, timeout=TIMEOUT_S)
    print(f"  HTTP status: {missing_response.status_code}")
    print(f"  body: {missing_response.text}")
    results.append(
        {"label": "10b-MISSING-FIELD", "status_code": missing_response.status_code, "body": None}
    )

    return results


def summarize(results: list[dict[str, Any]]) -> None:
    print("\n" + "=" * 100)
    print("SUMMARY")
    print("=" * 100)
    for r in results:
        body = r.get("body") or {}
        status = body.get("status") if isinstance(body, dict) else None
        agent = body.get("selected_agent") if isinstance(body, dict) else None
        print(f"  [{r['label']:28}] http={r['status_code']}  agent={agent}  status={status}")


if __name__ == "__main__":
    if not check_backend_reachable():
        print(
            "Backend not reachable at "
            f"{BASE_URL} — start it with "
            "`uvicorn app.main:app --app-dir backend --port 8000` first."
        )
        raise SystemExit(1)

    results = run_tests()
    summarize(results)
