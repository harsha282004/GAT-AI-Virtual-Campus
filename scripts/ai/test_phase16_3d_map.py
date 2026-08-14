"""Phase 16 — Interactive 3D Campus Map test suite.

Phase 16 is primarily a FRONTEND phase (a new React Three Fiber scene) —
this project has no frontend unit-test runner anywhere (no Jest/Vitest/
Testing Library in frontend/package.json, confirmed unchanged since
Phase 1; every prior phase's "frontend check" has been `npm run
type-check` + `npm run lint`, never unit tests), so adding one now would
be a large, out-of-scope architectural addition just for this phase.
Instead this file:

- STRUCTURAL: confirms the real files/wiring this phase depends on exist
  (the route, the new components, the homepage/nav link, the added
  dependencies) — catches "the button still points to a dummy route"
  class mistakes without a browser.
- LIVE DATA: confirms the actual backend endpoints the 3D map's
  useBuildings()/useNodes()/useFloors() hooks call return real,
  non-fabricated data — no mocking.
- REGRESSION: re-runs the existing Phase 9-15 test suites unmodified and
  reports pass/fail, per Section 28 ("do not weaken existing tests").

`npm run type-check`, `npm run lint`, and `npm run build` are the actual
frontend correctness gate for this phase (see the Phase 16 report for
their results) — not duplicated here since they're plain shell commands,
not Python.

Usage: python scripts/ai/test_phase16_3d_map.py
(backend live-data checks are skipped, not failed, if the backend isn't
running on BASE_URL)
"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path
from typing import Any

import httpx
from _shared import configure_logging

logger = configure_logging("test_phase16_3d_map")

_REPO_ROOT = Path(__file__).resolve().parents[2]
_SCRIPTS_AI_DIR = Path(__file__).resolve().parent
_FRONTEND_SRC = _REPO_ROOT / "frontend" / "src"

SERVER_ROOT = "http://127.0.0.1:8000"
BASE_URL = f"{SERVER_ROOT}/api/v1"


def _header(label: str, description: str) -> None:
    print("\n" + "=" * 100)
    print(f"[{label}] {description}")
    print("=" * 100)


def _file_contains(path: Path, needle: str) -> bool:
    if not path.exists():
        return False
    return needle in path.read_text(encoding="utf-8")


# ---------------------------------------------------------------------------
# A-C — structural checks
# ---------------------------------------------------------------------------


def case_a_route_exists() -> dict[str, Any]:
    _header("A-ROUTE-EXISTS", "frontend/src/app/map/page.tsx renders the real 3D scene")
    page = _FRONTEND_SRC / "app" / "map" / "page.tsx"
    ok = page.exists() and _file_contains(page, "Map3DCampusView")
    rel = page.relative_to(_REPO_ROOT)
    print(f"  {'OK ' if ok else 'FAIL'} {rel} exists and uses Map3DCampusView")
    return {"label": "A-ROUTE-EXISTS", "ok": ok}


def case_b_homepage_link() -> dict[str, Any]:
    _header("B-HOMEPAGE-LINK", "Navbar '3D Map' link points at /map, not a dummy route")
    navbar = _FRONTEND_SRC / "components" / "layout" / "Navbar.tsx"
    ok = _file_contains(navbar, '"3D Map", href: "/map"')
    print(f"  {'OK ' if ok else 'FAIL'} Navbar links '3D Map' -> /map")
    return {"label": "B-HOMEPAGE-LINK", "ok": ok}


def case_c_scene_components_exist() -> dict[str, Any]:
    _header("C-SCENE-COMPONENTS", "the real R3F scene + supporting components exist")
    map3d_dir = _FRONTEND_SRC / "features" / "map3d"
    required = [
        "CampusScene3D.tsx",
        "BuildingMesh.tsx",
        "campusLayout.ts",
        "BuildingInfoPanel.tsx",
        "MapSearch.tsx",
        "Map3DErrorBoundary.tsx",
        "Map3DCampusView.tsx",
    ]
    missing = [name for name in required if not (map3d_dir / name).exists()]
    ok = not missing
    print(f"  {'OK ' if ok else 'FAIL'} missing={missing}")
    return {"label": "C-SCENE-COMPONENTS", "ok": ok}


def case_dependencies_added() -> dict[str, Any]:
    _header(
        "DEPENDENCIES",
        "three / @react-three/fiber / @react-three/drei added, no duplicate 3D engine",
    )
    package_json = (_REPO_ROOT / "frontend" / "package.json").read_text(encoding="utf-8")
    required = ['"three"', '"@react-three/fiber"', '"@react-three/drei"']
    missing = [dep for dep in required if dep not in package_json]
    # A second, competing 3D engine (e.g. babylonjs, pixi.js as a 3D lib)
    # would contradict Section 5's "do not introduce multiple competing 3D
    # engines" — checked as an explicit negative assertion, not just an
    # absence-of-error.
    competing = [name for name in ("babylonjs", "playcanvas") if f'"{name}"' in package_json]
    ok = not missing and not competing
    print(f"  {'OK ' if ok else 'FAIL'} missing={missing} competing_engines={competing}")
    return {"label": "DEPENDENCIES", "ok": ok}


# ---------------------------------------------------------------------------
# D — live data checks (real backend, no mocking)
# ---------------------------------------------------------------------------


def case_d_campus_data_loads() -> dict[str, Any] | None:
    _header("D-CAMPUS-DATA-LOADS", "GET /api/v1/buildings and /api/v1/nodes return real data")
    try:
        httpx.get(f"{SERVER_ROOT}/docs", timeout=3.0)
    except httpx.RequestError:
        print("  SKIPPED — backend not reachable at " + SERVER_ROOT)
        return None

    buildings_resp = httpx.get(f"{BASE_URL}/buildings", timeout=10.0)
    nodes_resp = httpx.get(f"{BASE_URL}/nodes", timeout=10.0)
    buildings = buildings_resp.json() if buildings_resp.status_code == 200 else []
    nodes = nodes_resp.json() if nodes_resp.status_code == 200 else []

    has_buildings = len(buildings) > 0
    has_positioned_node = any(
        n.get("pos_x") is not None and n.get("pos_y") is not None for n in nodes
    )
    ok = (
        buildings_resp.status_code == 200
        and nodes_resp.status_code == 200
        and has_buildings
        and has_positioned_node
    )
    print(
        f"  buildings={len(buildings)} nodes={len(nodes)} "
        f"has_positioned_node={has_positioned_node} ok={ok}"
    )
    if buildings:
        names = [b.get("name") for b in buildings]
        print(f"  building names (real, from DB): {names}")
    return {"label": "D-CAMPUS-DATA-LOADS", "ok": ok}


# ---------------------------------------------------------------------------
# K-N — regression (Phase 9-15, re-run unmodified)
# ---------------------------------------------------------------------------


def _run_script(script_name: str) -> tuple[bool, str]:
    result = subprocess.run(
        [sys.executable, str(_SCRIPTS_AI_DIR / script_name)],
        capture_output=True,
        text=True,
        timeout=600,
    )
    output = result.stdout + result.stderr
    match = re.search(r"(\d+)/(\d+)\s+(?:cases|groups)\s+passed", output)
    if match:
        passed, total = int(match.group(1)), int(match.group(2))
        return passed == total, f"{passed}/{total}"
    return result.returncode == 0, "no summary line found; exit=" + str(result.returncode)


def run_regression() -> list[dict[str, Any]]:
    _header(
        "K-N REGRESSION", "existing chat / RAG / navigation / grounding / contextual conversation"
    )
    results = []
    checks = [
        ("K-CHAT-RAG-MULTIAGENT", "test_phase13_multi_agent_routing.py"),
        ("L-NAVIGATION-SPATIAL", "test_campus_tools.py"),
        ("M-GROUNDING", "test_phase14_grounding_confidence.py"),
        ("N-CONTEXTUAL-CONVERSATION", "test_phase15_contextual_conversation.py"),
    ]
    for label, script in checks:
        ok, detail = _run_script(script)
        print(f"  {'OK ' if ok else 'FAIL'} [{label}] {script} -> {detail}")
        results.append({"label": label, "ok": ok})
    return results


def run_all() -> list[dict[str, Any]]:
    results = [
        case_a_route_exists(),
        case_b_homepage_link(),
        case_c_scene_components_exist(),
        case_dependencies_added(),
    ]
    live = case_d_campus_data_loads()
    if live is not None:
        results.append(live)
    results += run_regression()
    return results


def summarize(results: list[dict[str, Any]]) -> None:
    print("\n" + "=" * 100)
    print("SUMMARY")
    print("=" * 100)
    for r in results:
        print(f"  [{r['label']:28}] {'PASS' if r['ok'] else 'FAIL'}")
    passed = sum(1 for r in results if r["ok"])
    print(f"\n  {passed}/{len(results)} cases passed")


if __name__ == "__main__":
    all_results = run_all()
    summarize(all_results)
