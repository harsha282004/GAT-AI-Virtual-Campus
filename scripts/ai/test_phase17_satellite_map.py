"""Phase 17 — Real Satellite Campus Map + Geographic Coordinates test suite.

Same rationale as scripts/ai/test_phase16_3d_map.py: this is primarily a
frontend phase (a new Google Maps satellite view + a small backend schema
addition), and this project has no frontend unit-test runner anywhere
(confirmed unchanged since Phase 1). So this file:

- STRUCTURAL: confirms the real files/wiring this phase depends on exist
  (the satellite map components, the mode-toggle wired into /map, the
  centralized coordinate config, the added dependency, the env var).
- SECURITY: greps the whole repo for a literal Google Maps API key
  pattern (AIzaSy...) to catch an accidentally hardcoded key (Section 12).
- LIVE DATA: confirms GET /api/v1/buildings now serves the new
  latitude/longitude fields (present, and — honestly — still null, since
  no building has been surveyed yet).
- REGRESSION: re-runs the existing Phase 13-16 test suites unmodified.

`npm run type-check`, `npm run lint`, and `npm run build` are the actual
frontend correctness gate for this phase (see the Phase 17 report for
their results) — not duplicated here, same as Phase 16's script.

Usage: python scripts/ai/test_phase17_satellite_map.py
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

logger = configure_logging("test_phase17_satellite_map")

_REPO_ROOT = Path(__file__).resolve().parents[2]
_SCRIPTS_AI_DIR = Path(__file__).resolve().parent
_FRONTEND_SRC = _REPO_ROOT / "frontend" / "src"

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
# A-D — structural checks
# ---------------------------------------------------------------------------


def case_a_satellite_components_exist() -> dict[str, Any]:
    _header("A-SATELLITE-COMPONENTS", "the real satellite map components exist")
    map_sat_dir = _FRONTEND_SRC / "features" / "mapSatellite"
    required = [
        "SatelliteCampusMap.tsx",
        "GoogleSatelliteMap.tsx",
        "CampusMarker.tsx",
        "BuildingMarker.tsx",
        "BuildingGeoInfoPanel.tsx",
        "SatelliteMapUnavailable.tsx",
    ]
    missing = [name for name in required if not (map_sat_dir / name).exists()]
    ok = not missing
    print(f"  {'OK ' if ok else 'FAIL'} missing={missing}")
    return {"label": "A-SATELLITE-COMPONENTS", "ok": ok}


def case_b_map_page_uses_toggle() -> dict[str, Any]:
    _header("B-MAP-PAGE-TOGGLE", "/map renders CampusMapView (satellite primary, 3D preserved)")
    page = _FRONTEND_SRC / "app" / "map" / "page.tsx"
    ok = page.exists() and _file_contains(page, "CampusMapView")
    view = _FRONTEND_SRC / "features" / "campusMap" / "CampusMapView.tsx"
    ok = ok and view.exists() and _file_contains(view, "Map3DCampusView")
    print(f"  {'OK ' if ok else 'FAIL'} map/page.tsx uses CampusMapView, which still renders Map3DCampusView")
    return {"label": "B-MAP-PAGE-TOGGLE", "ok": ok}


def case_c_centralized_location_config() -> dict[str, Any]:
    _header("C-LOCATION-CONFIG", "a single centralized GAT coordinate config exists (Section 4)")
    config = _FRONTEND_SRC / "config" / "campusLocation.ts"
    ok = (
        config.exists()
        and _file_contains(config, "GAT_CAMPUS_CENTER")
        and _file_contains(config, "latitude")
        and _file_contains(config, "longitude")
    )
    print(f"  {'OK ' if ok else 'FAIL'} frontend/src/config/campusLocation.ts exports GAT_CAMPUS_CENTER")
    return {"label": "C-LOCATION-CONFIG", "ok": ok}


def case_d_dependency_and_env_wired() -> dict[str, Any]:
    _header("D-DEPENDENCY-ENV", "@vis.gl/react-google-maps added, NEXT_PUBLIC_GOOGLE_MAPS_API_KEY documented")
    package_json = (_REPO_ROOT / "frontend" / "package.json").read_text(encoding="utf-8")
    env_example = (_REPO_ROOT / ".env.example").read_text(encoding="utf-8")
    has_dep = '"@vis.gl/react-google-maps"' in package_json
    has_env_var = "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY" in env_example
    ok = has_dep and has_env_var
    print(f"  {'OK ' if ok else 'FAIL'} has_dep={has_dep} has_env_var={has_env_var}")
    return {"label": "D-DEPENDENCY-ENV", "ok": ok}


# ---------------------------------------------------------------------------
# E — security check
# ---------------------------------------------------------------------------


def case_e_no_hardcoded_api_key() -> dict[str, Any]:
    _header("E-NO-HARDCODED-KEY", "no literal Google Maps API key string anywhere in the repo")
    offenders: list[str] = []
    skip_dirs = {".git", "node_modules", ".next", "venv", "__pycache__"}
    for path in _REPO_ROOT.rglob("*"):
        if not path.is_file():
            continue
        if any(part in skip_dirs for part in path.parts):
            continue
        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except (OSError, UnicodeDecodeError):
            continue
        if GOOGLE_API_KEY_PATTERN.search(text):
            offenders.append(str(path.relative_to(_REPO_ROOT)))
    ok = not offenders
    print(f"  {'OK ' if ok else 'FAIL'} offenders={offenders}")
    return {"label": "E-NO-HARDCODED-KEY", "ok": ok}


# ---------------------------------------------------------------------------
# F — live data check (real backend, no mocking)
# ---------------------------------------------------------------------------


def case_f_building_geo_fields_live() -> dict[str, Any] | None:
    _header("F-BUILDING-GEO-FIELDS", "GET /api/v1/buildings serves the new latitude/longitude fields")
    try:
        httpx.get(f"{SERVER_ROOT}/docs", timeout=3.0)
    except httpx.RequestError:
        print("  SKIPPED — backend not reachable at " + SERVER_ROOT)
        return None

    resp = httpx.get(f"{BASE_URL}/buildings", timeout=10.0)
    buildings = resp.json() if resp.status_code == 200 else []
    has_buildings = len(buildings) > 0
    fields_present = all("latitude" in b and "longitude" in b for b in buildings)
    all_null_today = all(b.get("latitude") is None and b.get("longitude") is None for b in buildings)
    ok = resp.status_code == 200 and has_buildings and fields_present
    print(
        f"  status={resp.status_code} buildings={len(buildings)} fields_present={fields_present} "
        f"all_null_today={all_null_today} (expected True — no survey done yet) ok={ok}"
    )
    return {"label": "F-BUILDING-GEO-FIELDS", "ok": ok}


# ---------------------------------------------------------------------------
# G-J — regression (Phase 13-16, re-run unmodified)
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
    _header("G-J REGRESSION", "existing multi-agent / grounding / contextual conversation / 3D map")
    results = []
    checks = [
        ("G-MULTIAGENT", "test_phase13_multi_agent_routing.py"),
        ("H-GROUNDING", "test_phase14_grounding_confidence.py"),
        ("I-CONTEXTUAL-CONVERSATION", "test_phase15_contextual_conversation.py"),
        ("J-3D-MAP", "test_phase16_3d_map.py"),
    ]
    for label, script in checks:
        ok, detail = _run_script(script)
        print(f"  {'OK ' if ok else 'FAIL'} [{label}] {script} -> {detail}")
        results.append({"label": label, "ok": ok})
    return results


def run_all() -> list[dict[str, Any]]:
    results = [
        case_a_satellite_components_exist(),
        case_b_map_page_uses_toggle(),
        case_c_centralized_location_config(),
        case_d_dependency_and_env_wired(),
        case_e_no_hardcoded_api_key(),
    ]
    live = case_f_building_geo_fields_live()
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
