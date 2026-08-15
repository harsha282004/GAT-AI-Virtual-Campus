"""Phase 18 — User Location on the Real Satellite Campus Map test suite.

Same rationale as Phase 16/17's own test scripts: this is a frontend-only
phase (a geolocation hook + a marker/circle overlay on the existing
Phase 17 satellite map), and this project has no frontend unit-test
runner. So this file:

- STRUCTURAL: confirms the real files/wiring this phase depends on exist
  (the hook, the marker, the distance helper, the "My Location" button
  wired into SatelliteCampusMap, centerOnUser wired into the map handle).
- REAL-API CHECK: greps useUserLocation.ts to confirm it actually calls
  the browser's navigator.geolocation.getCurrentPosition/watchPosition
  (not a mock/fake position generator) — catches the "silently hardcode
  a demo coordinate" failure mode this phase explicitly forbids.
- SECURITY: re-checks the whole repo for a hardcoded Google Maps API key
  (Section 12 carried over from Phase 17 — nothing about this phase
  should have introduced one).
- REGRESSION: re-runs only the true LEAF test scripts directly
  (test_phase13/test_campus_tools/test_phase14/test_phase15 — none of
  which call any other script) rather than test_phase16_3d_map.py or
  test_phase17_satellite_map.py, both of which already nest a full
  13/14/15 re-run themselves. Calling either of those here would
  compound two extra layers of redundant real-LLM calls on top of an
  already-long chain and risks a slow/timed-out run for no extra
  coverage. Phase 16/17's own structural wiring (the pieces this phase
  actually extended) is instead re-verified directly and cheaply, with
  no subprocess, in case_f_map3d_and_satellite_still_wired below.

`npm run type-check`, `npm run lint`, and `npm run build` are the actual
frontend correctness gate for this phase — not duplicated here.

Usage: python scripts/ai/test_phase18_user_location.py
"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path
from typing import Any

from _shared import configure_logging

logger = configure_logging("test_phase18_user_location")

_REPO_ROOT = Path(__file__).resolve().parents[2]
_SCRIPTS_AI_DIR = Path(__file__).resolve().parent
_MAP_SAT_DIR = _REPO_ROOT / "frontend" / "src" / "features" / "mapSatellite"

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


def case_a_location_files_exist() -> dict[str, Any]:
    _header("A-LOCATION-FILES", "the real user-location components/hook exist")
    required = [
        "useUserLocation.ts",
        "UserLocationMarker.tsx",
        "UserLocationStatusBanner.tsx",
        "geoDistance.ts",
    ]
    missing = [name for name in required if not (_MAP_SAT_DIR / name).exists()]
    ok = not missing
    print(f"  {'OK ' if ok else 'FAIL'} missing={missing}")
    return {"label": "A-LOCATION-FILES", "ok": ok}


def case_b_real_geolocation_api_used() -> dict[str, Any]:
    _header("B-REAL-GEOLOCATION-API", "useUserLocation.ts calls the real browser Geolocation API")
    hook = _MAP_SAT_DIR / "useUserLocation.ts"
    has_get_current = _file_contains(hook, "navigator.geolocation.getCurrentPosition")
    has_watch = _file_contains(hook, "navigator.geolocation.watchPosition")
    has_clear = _file_contains(hook, "navigator.geolocation.clearWatch")
    # geo.coords.* is where the REAL lat/lng/accuracy must come from — a
    # hardcoded number assigned directly to `latitude:`/`longitude:`
    # anywhere in this file would be exactly the fabricated-coordinate
    # failure mode this phase explicitly forbids.
    uses_real_coords = _file_contains(hook, "geo.coords.latitude") and _file_contains(
        hook, "geo.coords.longitude"
    )
    ok = has_get_current and has_watch and has_clear and uses_real_coords
    print(
        f"  {'OK ' if ok else 'FAIL'} getCurrentPosition={has_get_current} watchPosition={has_watch} "
        f"clearWatch={has_clear} uses_real_coords={uses_real_coords}"
    )
    return {"label": "B-REAL-GEOLOCATION-API", "ok": ok}


def case_c_wired_into_satellite_map() -> dict[str, Any]:
    _header("C-WIRED-INTO-MAP", "My Location button + centerOnUser wired into the satellite map")
    satellite_map = _MAP_SAT_DIR / "SatelliteCampusMap.tsx"
    google_map = _MAP_SAT_DIR / "GoogleSatelliteMap.tsx"
    has_hook_use = _file_contains(satellite_map, "useUserLocation")
    has_marker_render = _file_contains(google_map, "UserLocationMarker")
    has_center_on_user = _file_contains(google_map, "centerOnUser") and _file_contains(
        satellite_map, "centerOnUser"
    )
    # resetView (Phase 17, GAT campus) and centerOnUser (Phase 18, real
    # user GPS) must both still exist as distinct actions — Section "MAP
    # CAMERA BEHAVIOR" requires they never collapse into one.
    has_reset_view = _file_contains(google_map, "resetView") and _file_contains(
        satellite_map, "resetView"
    )
    ok = has_hook_use and has_marker_render and has_center_on_user and has_reset_view
    print(
        f"  {'OK ' if ok else 'FAIL'} hook_used={has_hook_use} marker_rendered={has_marker_render} "
        f"centerOnUser_wired={has_center_on_user} resetView_still_present={has_reset_view}"
    )
    return {"label": "C-WIRED-INTO-MAP", "ok": ok}


def case_d_no_immediate_permission_request() -> dict[str, Any]:
    _header(
        "D-NO-AUTO-PERMISSION-REQUEST",
        "location isn't requested until the user clicks (no getCurrentPosition on mount)",
    )
    hook = _MAP_SAT_DIR / "useUserLocation.ts"
    text = hook.read_text(encoding="utf-8") if hook.exists() else ""
    # The only two useEffect(..., []) mount-time effects in this file
    # must be feature-detection and the unmount-cleanup — neither may
    # call getCurrentPosition/watchPosition. requestLocation() (called
    # only from the "My Location" button in SatelliteCampusMap.tsx) is
    # where those calls are expected to live instead.
    mount_effects = re.findall(r"useEffect\(\(\) => \{(.*?)\}, \[\]\);", text, re.DOTALL)
    calls_geo_on_mount = any(
        "getCurrentPosition" in block or "watchPosition(" in block for block in mount_effects
    )
    ok = not calls_geo_on_mount and len(mount_effects) >= 1
    print(f"  {'OK ' if ok else 'FAIL'} mount_effects_found={len(mount_effects)} calls_geo_on_mount={calls_geo_on_mount}")
    return {"label": "D-NO-AUTO-PERMISSION-REQUEST", "ok": ok}


# ---------------------------------------------------------------------------
# E — security check (carried over from Phase 17)
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
# F — regression (Phase 17, which itself cascades through 13-16)
# ---------------------------------------------------------------------------


def _run_script(script_name: str) -> tuple[bool, str]:
    result = subprocess.run(
        [sys.executable, str(_SCRIPTS_AI_DIR / script_name)],
        capture_output=True,
        text=True,
        timeout=900,
    )
    output = result.stdout + result.stderr
    match = re.search(r"(\d+)/(\d+)\s+(?:cases|groups)\s+passed", output)
    if match:
        passed, total = int(match.group(1)), int(match.group(2))
        return passed == total, f"{passed}/{total}"
    return result.returncode == 0, "no summary line found; exit=" + str(result.returncode)


def case_f_map3d_and_satellite_still_wired() -> dict[str, Any]:
    _header(
        "F-PRIOR-PHASES-STILL-WIRED",
        "Phase 16 3D view + Phase 17 satellite view wiring untouched by this phase",
    )
    frontend_src = _REPO_ROOT / "frontend" / "src"
    map3d_dir = frontend_src / "features" / "map3d"
    page = frontend_src / "app" / "map" / "page.tsx"
    campus_map_view = frontend_src / "features" / "campusMap" / "CampusMapView.tsx"

    map3d_intact = all(
        (map3d_dir / name).exists()
        for name in ("CampusScene3D.tsx", "BuildingMesh.tsx", "campusLayout.ts", "Map3DCampusView.tsx")
    )
    toggle_intact = (
        page.exists()
        and _file_contains(page, "CampusMapView")
        and campus_map_view.exists()
        and _file_contains(campus_map_view, "Map3DCampusView")
        and _file_contains(campus_map_view, "SatelliteCampusMap")
    )
    satellite_intact = all(
        (_MAP_SAT_DIR / name).exists()
        for name in ("GoogleSatelliteMap.tsx", "CampusMarker.tsx", "BuildingMarker.tsx", "BuildingGeoInfoPanel.tsx")
    )
    ok = map3d_intact and toggle_intact and satellite_intact
    print(
        f"  {'OK ' if ok else 'FAIL'} map3d_intact={map3d_intact} toggle_intact={toggle_intact} "
        f"satellite_intact={satellite_intact}"
    )
    return {"label": "F-PRIOR-PHASES-STILL-WIRED", "ok": ok}


def run_regression() -> list[dict[str, Any]]:
    _header("G-J REGRESSION", "existing multi-agent / grounding / contextual conversation / navigation")
    results = []
    checks = [
        ("G-MULTIAGENT", "test_phase13_multi_agent_routing.py"),
        ("H-NAVIGATION-SPATIAL", "test_campus_tools.py"),
        ("I-GROUNDING", "test_phase14_grounding_confidence.py"),
        ("J-CONTEXTUAL-CONVERSATION", "test_phase15_contextual_conversation.py"),
    ]
    for label, script in checks:
        ok, detail = _run_script(script)
        print(f"  {'OK ' if ok else 'FAIL'} [{label}] {script} -> {detail}")
        results.append({"label": label, "ok": ok})
    return results


def run_all() -> list[dict[str, Any]]:
    results = [
        case_a_location_files_exist(),
        case_b_real_geolocation_api_used(),
        case_c_wired_into_satellite_map(),
        case_d_no_immediate_permission_request(),
        case_e_no_hardcoded_api_key(),
        case_f_map3d_and_satellite_still_wired(),
    ]
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
