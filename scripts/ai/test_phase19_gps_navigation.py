"""Phase 19 — GPS-to-Campus Navigation Integration test suite.

Same rationale as Phase 16/17/18's own test scripts: this is mostly a
frontend phase (GPS -> nearest node -> existing navigation graph) plus
one small, reuse-only backend endpoint, and this project has no frontend
unit-test runner. So this file:

- STRUCTURAL: confirms the real files/wiring this phase depends on exist.
- PRESERVATION: confirms Phase 16/17/18 files were not deleted or
  replaced.
- REUSE CHECKS: confirms the new backend endpoint imports the EXISTING
  app.navigation engine rather than reimplementing pathfinding, and that
  the frontend's nearest-node logic reuses Phase 18's geoDistance.ts
  rather than a second haversine implementation.
- SAFETY CHECKS: no fabricated coordinates, no GPS persistence, no
  hardcoded fake position, no hardcoded Google Maps API key.
- LIVE DATA: exercises the real GET /api/v1/navigate endpoint against
  the running backend with two real node IDs (independent of whether any
  node has a surveyed lat/lng yet — that's a separate, expected gap,
  see case_h below).
- REGRESSION: re-runs the true leaf test scripts directly (not
  test_phase17/18's own wrapper scripts, which already nest a full
  13/14/15 re-run — see test_phase18_user_location.py's docstring for
  why compounding those is avoided).

`npm run type-check`, `npm run lint`, and `npm run build` are the actual
frontend correctness gate for this phase — not duplicated here.
`ruff`/`black`/`mypy` are the backend gate for the one new file.

Usage: python scripts/ai/test_phase19_gps_navigation.py
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

logger = configure_logging("test_phase19_gps_navigation")

_REPO_ROOT = Path(__file__).resolve().parents[2]
_SCRIPTS_AI_DIR = Path(__file__).resolve().parent
_FRONTEND_SRC = _REPO_ROOT / "frontend" / "src"
_MAP_SAT_DIR = _FRONTEND_SRC / "features" / "mapSatellite"
_MAP3D_DIR = _FRONTEND_SRC / "features" / "map3d"

SERVER_ROOT = "http://127.0.0.1:8000"
BASE_URL = f"{SERVER_ROOT}/api/v1"

GOOGLE_API_KEY_PATTERN = re.compile(r"AIzaSy[0-9A-Za-z_\-]{33}")


def _header(label: str, description: str) -> None:
    print("\n" + "=" * 100)
    print(f"[{label}] {description}")
    print("=" * 100)


def _file_contains(path: Path, needle: str) -> bool:
    if not path.exists():
        return False
    return needle in path.read_text(encoding="utf-8")


# ---------------------------------------------------------------------------
# A-D — structural / preservation checks
# ---------------------------------------------------------------------------


def case_a_phase19_files_exist() -> dict[str, Any]:
    _header("A-PHASE19-FILES", "the real GPS-navigation integration files exist")
    frontend_required = [
        "findNearestCampusNode.ts",
        "resolveDestinationNode.ts",
        "useCampusNavigation.ts",
        "NavigationPanel.tsx",
        "RoutePolyline.tsx",
    ]
    missing = [name for name in frontend_required if not (_MAP_SAT_DIR / name).exists()]
    backend_file = _REPO_ROOT / "backend" / "app" / "api" / "v1" / "navigate.py"
    types_file = _FRONTEND_SRC / "types" / "navigation.ts"
    api_file = _FRONTEND_SRC / "api" / "navigate.ts"
    ok = not missing and backend_file.exists() and types_file.exists() and api_file.exists()
    print(
        f"  {'OK ' if ok else 'FAIL'} missing_frontend={missing} "
        f"backend_exists={backend_file.exists()} types_exist={types_file.exists()} "
        f"api_client_exists={api_file.exists()}"
    )
    return {"label": "A-PHASE19-FILES", "ok": ok}


def case_b_phase16_17_18_preserved() -> dict[str, Any]:
    _header("B-PRIOR-PHASES-PRESERVED", "Phase 16/17/18 files were not deleted or replaced")
    map3d_intact = all(
        (_MAP3D_DIR / name).exists()
        for name in ("CampusScene3D.tsx", "BuildingMesh.tsx", "campusLayout.ts", "Map3DCampusView.tsx")
    )
    phase17_intact = all(
        (_MAP_SAT_DIR / name).exists()
        for name in ("GoogleSatelliteMap.tsx", "CampusMarker.tsx", "BuildingMarker.tsx", "BuildingGeoInfoPanel.tsx")
    )
    phase18_intact = all(
        (_MAP_SAT_DIR / name).exists()
        for name in ("useUserLocation.ts", "UserLocationMarker.tsx", "UserLocationStatusBanner.tsx", "geoDistance.ts")
    )
    toggle_intact = _file_contains(
        _FRONTEND_SRC / "app" / "map" / "page.tsx", "CampusMapView"
    ) and _file_contains(
        _FRONTEND_SRC / "features" / "campusMap" / "CampusMapView.tsx", "Map3DCampusView"
    )
    ok = map3d_intact and phase17_intact and phase18_intact and toggle_intact
    print(
        f"  {'OK ' if ok else 'FAIL'} map3d_intact={map3d_intact} phase17_intact={phase17_intact} "
        f"phase18_intact={phase18_intact} toggle_intact={toggle_intact}"
    )
    return {"label": "B-PRIOR-PHASES-PRESERVED", "ok": ok}


def case_c_gps_state_reused_not_duplicated() -> dict[str, Any]:
    _header("C-GPS-STATE-REUSED", "useCampusNavigation consumes Phase 18's GPS state, no second watcher")
    nav_hook = _MAP_SAT_DIR / "useCampusNavigation.ts"
    imports_phase18_type = _file_contains(nav_hook, 'from "./useUserLocation"')
    calls_geolocation_directly = _file_contains(nav_hook, "navigator.geolocation")
    satellite_map = _MAP_SAT_DIR / "SatelliteCampusMap.tsx"
    # Exactly one REAL useUserLocation() call should exist in the whole
    # satellite feature (Phase 18's own) — useCampusNavigation must take
    # userPosition as a parameter, not call the hook itself. Excludes the
    # hook's own `export function useUserLocation():` definition line and
    # any doc-comment lines (` * ...` / `// ...`) that merely mention the
    # hook by name — those aren't invocations.
    call_pattern = re.compile(r"(?<!function )\buseUserLocation\(\)")
    use_user_location_call_count = 0
    for f in _MAP_SAT_DIR.glob("*.ts*"):
        for line in f.read_text(encoding="utf-8").splitlines():
            stripped = line.strip()
            if stripped.startswith("*") or stripped.startswith("//"):
                continue
            use_user_location_call_count += len(call_pattern.findall(line))
    ok = (
        imports_phase18_type
        and not calls_geolocation_directly
        and use_user_location_call_count == 1
        and _file_contains(satellite_map, "useCampusNavigation(")
    )
    print(
        f"  {'OK ' if ok else 'FAIL'} imports_phase18_type={imports_phase18_type} "
        f"calls_geolocation_directly={calls_geolocation_directly} "
        f"useUserLocation_call_sites={use_user_location_call_count}"
    )
    return {"label": "C-GPS-STATE-REUSED", "ok": ok}


def case_d_nearest_node_reuses_haversine() -> dict[str, Any]:
    _header("D-NEAREST-NODE-REUSE", "findNearestCampusNode reuses geoDistance.ts, no second formula")
    nearest_node_file = _MAP_SAT_DIR / "findNearestCampusNode.ts"
    imports_shared_helper = _file_contains(nearest_node_file, 'from "./geoDistance"')
    # A second independent haversine implementation (its own asin/sqrt/
    # Math.PI trig block) would violate "do not create duplicate
    # helpers" — geoDistance.ts (Phase 18) is the only file allowed to
    # define the formula itself.
    other_geo_files = [
        f
        for f in _MAP_SAT_DIR.glob("*.ts")
        if f.name not in ("geoDistance.ts", "findNearestCampusNode.ts")
    ]
    duplicated_formula = any("Math.asin" in f.read_text(encoding="utf-8") for f in other_geo_files)
    ok = imports_shared_helper and not duplicated_formula
    print(f"  {'OK ' if ok else 'FAIL'} imports_shared_helper={imports_shared_helper} duplicated_formula={duplicated_formula}")
    return {"label": "D-NEAREST-NODE-REUSE", "ok": ok}


# ---------------------------------------------------------------------------
# E-G — reuse / no-duplication checks (backend)
# ---------------------------------------------------------------------------


def case_e_backend_reuses_existing_engine() -> dict[str, Any]:
    _header("E-BACKEND-ENGINE-REUSE", "navigate.py imports the EXISTING A* engine, reimplements nothing")
    navigate_py = (_REPO_ROOT / "backend" / "app" / "api" / "v1" / "navigate.py").read_text(
        encoding="utf-8"
    )
    imports_existing = (
        "from app.navigation import" in navigate_py
        and "build_graph" in navigate_py
        and "find_shortest_path" in navigate_py
        and "format_directions" in navigate_py
    )
    # A real reimplementation would define its own heapq/priority-queue
    # search loop in this file — it must not.
    no_new_search_loop = "heapq" not in navigate_py
    router_registered = _file_contains(
        _REPO_ROOT / "backend" / "app" / "api" / "v1" / "__init__.py", "navigate"
    )
    ok = imports_existing and no_new_search_loop and router_registered
    print(
        f"  {'OK ' if ok else 'FAIL'} imports_existing_engine={imports_existing} "
        f"no_new_search_loop={no_new_search_loop} router_registered={router_registered}"
    )
    return {"label": "E-BACKEND-ENGINE-REUSE", "ok": ok}


def case_f_no_fabricated_coordinates() -> dict[str, Any]:
    _header("F-NO-FABRICATED-COORDINATES", "no hardcoded fallback lat/lng anywhere in the new code")
    new_files = [
        _MAP_SAT_DIR / "findNearestCampusNode.ts",
        _MAP_SAT_DIR / "resolveDestinationNode.ts",
        _MAP_SAT_DIR / "useCampusNavigation.ts",
        _MAP_SAT_DIR / "RoutePolyline.tsx",
        _REPO_ROOT / "backend" / "app" / "api" / "v1" / "navigate.py",
    ]
    # A fabricated fallback would look like a literal decimal degree
    # (e.g. `latitude: 12.9` or `lat: 77.5`) assigned outside of real
    # data flow — these files should only ever read node.latitude/
    # node.longitude from real fetched data, never assign a literal.
    offenders = []
    literal_pattern = re.compile(r"(latitude|longitude|\blat\b|\blng\b)\s*[:=]\s*-?\d+\.\d+")
    for f in new_files:
        if not f.exists():
            continue
        if literal_pattern.search(f.read_text(encoding="utf-8")):
            offenders.append(str(f.relative_to(_REPO_ROOT)))
    ok = not offenders
    print(f"  {'OK ' if ok else 'FAIL'} offenders={offenders}")
    return {"label": "F-NO-FABRICATED-COORDINATES", "ok": ok}


def case_g_no_gps_persistence_or_logging() -> dict[str, Any]:
    _header("G-NO-GPS-PERSISTENCE", "GPS data isn't sent to the backend, persisted, or logged")
    nav_hook = (_MAP_SAT_DIR / "useCampusNavigation.ts").read_text(encoding="utf-8")
    no_storage = "localStorage" not in nav_hook and "sessionStorage" not in nav_hook
    no_console_log = "console.log" not in nav_hook
    # The ONLY network call in this hook should be navigateApi.getRoute(),
    # which takes node IDs, never raw coordinates. Checked against the
    # endpoint's actual CODE, not its docstring/comments (which may
    # legitimately mention "latitude" while explaining that it's never
    # handled) — strip the module docstring and comment lines first.
    navigate_py_raw = (_REPO_ROOT / "backend" / "app" / "api" / "v1" / "navigate.py").read_text(
        encoding="utf-8"
    )
    navigate_py_code = re.sub(r'""".*?"""', "", navigate_py_raw, count=1, flags=re.DOTALL)
    navigate_py_code = "\n".join(
        line for line in navigate_py_code.splitlines() if not line.strip().startswith("#")
    )
    backend_takes_node_ids_not_coords = (
        "start_node_id" in navigate_py_code
        and "latitude" not in navigate_py_code
        and "longitude" not in navigate_py_code
    )
    ok = no_storage and no_console_log and backend_takes_node_ids_not_coords
    print(
        f"  {'OK ' if ok else 'FAIL'} no_storage={no_storage} no_console_log={no_console_log} "
        f"backend_node_ids_only={backend_takes_node_ids_not_coords}"
    )
    return {"label": "G-NO-GPS-PERSISTENCE", "ok": ok}


def case_h_missing_coordinate_handling() -> dict[str, Any]:
    _header("H-MISSING-COORDINATE-HANDLING", "graceful 'not available yet' path when no node has real geo data")
    nearest_node_file = _MAP_SAT_DIR / "findNearestCampusNode.ts"
    returns_null_when_none = _file_contains(nearest_node_file, "return null")
    panel = _MAP_SAT_DIR / "NavigationPanel.tsx"
    has_fallback_copy = _file_contains(panel, "No supported GPS starting point")
    ok = returns_null_when_none and has_fallback_copy
    print(f"  {'OK ' if ok else 'FAIL'} returns_null_when_none={returns_null_when_none} has_fallback_copy={has_fallback_copy}")
    return {"label": "H-MISSING-COORDINATE-HANDLING", "ok": ok}


def case_i_no_hardcoded_api_key() -> dict[str, Any]:
    _header("I-NO-HARDCODED-KEY", "no literal Google Maps API key string anywhere in the repo")
    offenders: list[str] = []
    skip_dirs = {".git", "node_modules", ".next", "venv", "__pycache__"}
    for path in _REPO_ROOT.rglob("*"):
        if not path.is_file() or any(part in skip_dirs for part in path.parts):
            continue
        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except (OSError, UnicodeDecodeError):
            continue
        if GOOGLE_API_KEY_PATTERN.search(text):
            offenders.append(str(path.relative_to(_REPO_ROOT)))
    ok = not offenders
    print(f"  {'OK ' if ok else 'FAIL'} offenders={offenders}")
    return {"label": "I-NO-HARDCODED-KEY", "ok": ok}


# ---------------------------------------------------------------------------
# J — live data check (real backend, no mocking)
# ---------------------------------------------------------------------------


def case_j_navigate_endpoint_live() -> dict[str, Any] | None:
    _header("J-NAVIGATE-ENDPOINT-LIVE", "GET /api/v1/navigate computes a real route via the reused A* engine")
    try:
        httpx.get(f"{SERVER_ROOT}/docs", timeout=3.0)
    except httpx.RequestError:
        print("  SKIPPED — backend not reachable at " + SERVER_ROOT)
        return None

    nodes_resp = httpx.get(f"{BASE_URL}/nodes", timeout=10.0)
    nodes = nodes_resp.json() if nodes_resp.status_code == 200 else []
    entrance_nodes = [n for n in nodes if n.get("node_type") == "entrance"]
    geocoded_nodes = [n for n in nodes if n.get("latitude") is not None and n.get("longitude") is not None]

    ok = True
    if len(entrance_nodes) >= 2:
        a, b = entrance_nodes[0]["id"], entrance_nodes[1]["id"]
        route_resp = httpx.get(
            f"{BASE_URL}/navigate",
            params={"start_node_id": a, "destination_node_id": b},
            timeout=10.0,
        )
        route_ok = route_resp.status_code == 200 and "turn_by_turn" in route_resp.json()
        ok = ok and route_ok
        print(f"  route {a}->{b}: status={route_resp.status_code} route_ok={route_ok}")
    else:
        print("  SKIPPED route computation — fewer than 2 entrance nodes in live data")

    error_resp = httpx.get(
        f"{BASE_URL}/navigate", params={"start_node_id": 999999, "destination_node_id": 1}, timeout=10.0
    )
    error_ok = error_resp.status_code == 404
    ok = ok and error_ok
    print(f"  invalid start_node_id -> status={error_resp.status_code} (expect 404) ok={error_ok}")

    print(
        f"  nodes={len(nodes)} geocoded_nodes={len(geocoded_nodes)} "
        f"(0 expected today — no on-site GPS survey has been done; this is honest, not a bug)"
    )
    return {"label": "J-NAVIGATE-ENDPOINT-LIVE", "ok": ok}


# ---------------------------------------------------------------------------
# K-N — regression (true leaf scripts only, no nested wrappers)
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
    _header("K-N REGRESSION", "existing multi-agent / navigation-spatial / grounding / contextual conversation")
    results = []
    checks = [
        ("K-MULTIAGENT", "test_phase13_multi_agent_routing.py"),
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
        case_a_phase19_files_exist(),
        case_b_phase16_17_18_preserved(),
        case_c_gps_state_reused_not_duplicated(),
        case_d_nearest_node_reuses_haversine(),
        case_e_backend_reuses_existing_engine(),
        case_f_no_fabricated_coordinates(),
        case_g_no_gps_persistence_or_logging(),
        case_h_missing_coordinate_handling(),
        case_i_no_hardcoded_api_key(),
    ]
    live = case_j_navigate_endpoint_live()
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
