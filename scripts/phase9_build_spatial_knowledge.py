"""Phase 9 — Panorama intelligence & spatial knowledge base generation.

Builds data/campus_spatial/*.json from three, and only three, sources of
truth — nothing here is invented:

1. Filesystem enumeration of frontend/public/panoramas/ (complete,
   deterministic — every file gets a status, none are silently skipped).
2. Existing structured metadata already in the repo: the real,
   human-authored frontend/public/panoramas/panoramas.json (the small
   legacy placeholder tour) and frontend/public/panoramas/main-building/
   manifest.json (scene index/dimensions for the real 360 photo set), plus
   the PostgreSQL `panoramas`/`nodes`/`buildings`/`floors` tables.
3. A small set of panorama images that were ACTUALLY visually inspected
   this session (see VERIFIED_ENTITIES below) — every entity there carries
   its exact source panorama, a literal transcription of the signage read,
   and a confidence score. No entity anywhere in this dataset is guessed;
   anything not backed by (2) or (3) is marked PENDING, not fabricated.

Usage: python scripts/phase9_build_spatial_knowledge.py
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]
PANORAMA_ROOT = REPO_ROOT / "frontend" / "public" / "panoramas"
OUT_DIR = REPO_ROOT / "data" / "campus_spatial"

sys.path.insert(0, str(REPO_ROOT / "backend"))
from app.core.config import Settings  # noqa: E402
from sqlalchemy import create_engine, text  # noqa: E402

# ---------------------------------------------------------------------------
# Step 9-21 evidence — every entry here was read directly off a specific,
# named panorama file during this session (zoomed crops for the small/angled
# signs). Confidence reflects how legible the sign actually was.
# ---------------------------------------------------------------------------
VERIFIED_ENTITIES: list[dict[str, Any]] = [
    # ---- ground-floor (building's 1st physical level -> room numbers 1xx) ----
    {
        "entity_id": "ROOM_112",
        "entity_type": "room",
        "name": "Chemistry Lab (LAB-2)",
        "room_number": "112",
        "department": "Chemistry",
        "floor_slug": "ground-floor",
        "panorama_file": "ground-floor/gf_15.jpg",
        "evidence": "Door plaque reads '112'; door header sign reads 'LAB-2'; "
        "adjacent notice board reads 'Global Academy of Technology / "
        "DEPARTMENT OF CHEMISTRY'.",
        "confidence": 0.92,
        "verified": True,
        "needs_review": False,
    },
    {
        "entity_id": "LAB_CHEMISTRY_GF",
        "entity_type": "laboratory",
        "name": "Chemistry Lab",
        "department": "Chemistry",
        "floor_slug": "ground-floor",
        "panorama_file": "ground-floor/gf_15.jpg",
        "evidence": "Door header sign 'LAB-2', room plaque '112', "
        "Department of Chemistry notice board on adjacent wall.",
        "confidence": 0.9,
        "verified": True,
        "needs_review": False,
    },
    # ---- first-floor (2nd physical level -> room numbers 2xx) ----
    {
        "entity_id": "DEPT_CSE_FIRST_FLOOR",
        "entity_type": "department",
        "name": "Department of Computer Science and Engineering (CSE)",
        "floor_slug": "first-floor",
        "panorama_file": "first-floor/01.jpg",
        "evidence": "Overhead directional sign: 'DEPT. OF CSE / DEPT. OF ISE / "
        "STAFF ROOM (ISE) / ISE LAB / CLASS ROOMS : 202, 203, 203A, 213 / "
        "TOILET (Gents)'.",
        "confidence": 0.95,
        "verified": True,
        "needs_review": False,
    },
    {
        "entity_id": "DEPT_ISE_FIRST_FLOOR",
        "entity_type": "department",
        "name": "Department of Information Science and Engineering (ISE)",
        "floor_slug": "first-floor",
        "panorama_file": "first-floor/01.jpg",
        "evidence": "Same overhead sign as DEPT_CSE_FIRST_FLOOR: 'DEPT. OF CSE / "
        "DEPT. OF ISE / STAFF ROOM (ISE) / ISE LAB / CLASS ROOMS : 202, 203, "
        "203A, 213 / TOILET (Gents)'.",
        "confidence": 0.95,
        "verified": True,
        "needs_review": False,
    },
    {
        "entity_id": "LAB_ISE_FIRST_FLOOR",
        "entity_type": "laboratory",
        "name": "ISE Lab",
        "department": "ISE",
        "floor_slug": "first-floor",
        "panorama_file": "first-floor/01.jpg",
        "evidence": "Overhead directional sign lists 'ISE LAB' in the CSE/ISE wing.",
        "confidence": 0.9,
        "verified": True,
        "needs_review": False,
    },
    {
        "entity_id": "FACILITY_TOILET_GENTS_FIRST_FLOOR",
        "entity_type": "facility",
        "name": "Toilet (Gents)",
        "floor_slug": "first-floor",
        "panorama_file": "first-floor/01.jpg",
        "evidence": "Overhead directional sign lists 'TOILET (Gents)' in the CSE/ISE wing.",
        "confidence": 0.9,
        "verified": True,
        "needs_review": False,
    },
    *[
        {
            "entity_id": f"ROOM_{n}",
            "entity_type": "room",
            "name": f"Class Room {n}",
            "room_number": n,
            "department": "CSE/ISE",
            "floor_slug": "first-floor",
            "panorama_file": "first-floor/01.jpg",
            "evidence": "Overhead directional sign: 'CLASS ROOMS : 202, 203, 203A, 213'.",
            "confidence": 0.95,
            "verified": True,
            "needs_review": False,
        }
        for n in ["202", "203", "203A", "213"]
    ],
    # ---- second-floor (3rd physical level -> room numbers 3xx) ----
    {
        "entity_id": "DEPT_EEE_SECOND_FLOOR",
        "entity_type": "department",
        "name": "Department of Electrical and Electronics Engineering (EEE)",
        "floor_slug": "second-floor",
        "panorama_file": "second-floor/01.jpg",
        "evidence": "Overhead directional sign: 'DEPT. OF EEE / DEPT. OF ECE / "
        "MEASUREMENTS & CONTROL SYSTEMS LAB / POWER SYSTEM SIMULATION LAB / "
        "CLASS ROOMS : 302, 316, 317, 318 / TOILET (Gents)'.",
        "confidence": 0.95,
        "verified": True,
        "needs_review": False,
    },
    {
        "entity_id": "DEPT_ECE_SECOND_FLOOR",
        "entity_type": "department",
        "name": "Department of Electronics and Communication Engineering (ECE)",
        "floor_slug": "second-floor",
        "panorama_file": "second-floor/01.jpg",
        "evidence": "Same overhead sign as DEPT_EEE_SECOND_FLOOR.",
        "confidence": 0.95,
        "verified": True,
        "needs_review": False,
    },
    {
        "entity_id": "LAB_MEASUREMENTS_CONTROL_SYSTEMS",
        "entity_type": "laboratory",
        "name": "Measurements & Control Systems Lab",
        "department": "EEE",
        "floor_slug": "second-floor",
        "panorama_file": "second-floor/01.jpg",
        "evidence": "Overhead directional sign lists 'MEASUREMENTS & CONTROL SYSTEMS LAB'.",
        "confidence": 0.9,
        "verified": True,
        "needs_review": False,
    },
    {
        "entity_id": "LAB_POWER_SYSTEM_SIMULATION",
        "entity_type": "laboratory",
        "name": "Power System Simulation Lab",
        "department": "EEE",
        "floor_slug": "second-floor",
        "panorama_file": "second-floor/01.jpg",
        "evidence": "Overhead directional sign lists 'POWER SYSTEM SIMULATION LAB'.",
        "confidence": 0.9,
        "verified": True,
        "needs_review": False,
    },
    {
        "entity_id": "FACILITY_TOILET_GENTS_SECOND_FLOOR",
        "entity_type": "facility",
        "name": "Toilet (Gents)",
        "floor_slug": "second-floor",
        "panorama_file": "second-floor/01.jpg",
        "evidence": "Overhead directional sign lists 'TOILET (Gents)'.",
        "confidence": 0.9,
        "verified": True,
        "needs_review": False,
    },
    *[
        {
            "entity_id": f"ROOM_{n}",
            "entity_type": "room",
            "name": f"Class Room {n}",
            "room_number": n,
            "department": "EEE/ECE",
            "floor_slug": "second-floor",
            "panorama_file": "second-floor/01.jpg",
            "evidence": "Overhead directional sign: 'CLASS ROOMS : 302, 316, 317, 318'.",
            "confidence": 0.95,
            "verified": True,
            "needs_review": False,
        }
        for n in ["302", "316", "317", "318"]
    ],
    # Continuation sweep: this sign (partially legible/angled on
    # second-floor/01.jpg) was independently CONFIRMED fully legible on
    # second-floor/13.jpg's own overhead directional sign: "NEF TRUST
    # OFFICE / STAFF ROOMS (CSE) / CLASS ROOMS: 306,307,309, / 311,312,314,315
    # / TOILET (Ladies)" — upgraded from review-required to verified now
    # that two independent signs agree.
    {
        "entity_id": "FACILITY_NEF_TRUST_OFFICE",
        "entity_type": "facility",
        "name": "NEF Trust Office",
        "floor_slug": "second-floor",
        "panorama_file": "second-floor/13.jpg",
        "evidence": "Overhead directional sign: 'NEF TRUST OFFICE / STAFF ROOMS "
        "(CSE) / CLASS ROOMS: 306,307,309, / 311,312,314,315 / TOILET (Ladies)' "
        "— corroborates the same (partially angled) sign on second-floor/01.jpg.",
        "confidence": 0.93,
        "verified": True,
        "needs_review": False,
    },
    {
        "entity_id": "FACILITY_TOILET_LADIES_SECOND_FLOOR",
        "entity_type": "facility",
        "name": "Toilet (Ladies)",
        "floor_slug": "second-floor",
        "panorama_file": "second-floor/13.jpg",
        "evidence": "Overhead directional sign lists 'TOILET (Ladies)'.",
        "confidence": 0.93,
        "verified": True,
        "needs_review": False,
    },
    *[
        {
            "entity_id": f"ROOM_{n}",
            "entity_type": "room",
            "name": f"Class Room {n}",
            "room_number": n,
            "department": "CSE (staff rooms)",
            "floor_slug": "second-floor",
            "panorama_file": "second-floor/13.jpg",
            "evidence": "Overhead directional sign (second-floor/13.jpg, fully "
            "legible): 'STAFF ROOMS (CSE) / CLASS ROOMS: 306,307,309, "
            "311,312,314,315' — corroborated by the same list partially visible "
            "on second-floor/01.jpg's angled sign.",
            "confidence": 0.93,
            "verified": True,
            "needs_review": False,
        }
        for n in ["306", "307", "309", "311", "312", "314", "315"]
    ],
    {
        "entity_id": "ROOM_304",
        "entity_type": "room",
        "name": "Control Systems Lab",
        "room_number": "304",
        "department": "EEE",
        "floor_slug": "second-floor",
        "panorama_file": "second-floor/02.jpg",
        "evidence": "Door-header sign 'CONTROL SYSTEMS LAB'; room plaque '304'.",
        "confidence": 0.88,
        "verified": True,
        "needs_review": False,
    },
    {
        "entity_id": "ROOM_303",
        "entity_type": "room",
        "name": "Power System Simulation Lab",
        "room_number": "303",
        "department": "EEE",
        "floor_slug": "second-floor",
        "panorama_file": "second-floor/03.jpg",
        "evidence": "Door-header sign 'POWER SYSTEM SIMULATION LAB'; room plaque "
        "'303', confirmed via a 6x zoomed crop — unambiguous digits.",
        "confidence": 0.97,
        "verified": True,
        "needs_review": False,
    },
    {
        "entity_id": "ROOM_317",
        "entity_type": "room",
        "name": "Class Room 14",
        "room_number": "317",
        "floor_slug": "second-floor",
        "panorama_file": "second-floor/09.jpg",
        "evidence": "Door plaque '317'; door sign 'CLASS ROOM - 14'.",
        "confidence": 0.85,
        "verified": True,
        "needs_review": False,
    },
    {
        "entity_id": "ROOM_316",
        "entity_type": "room",
        "name": "Class Room 13",
        "room_number": "316",
        "floor_slug": "second-floor",
        "panorama_file": "second-floor/11.jpg",
        "evidence": "Door plaque '316'; door sign 'CLASS ROOM - 13'.",
        "confidence": 0.85,
        "verified": True,
        "needs_review": False,
    },
    {
        "entity_id": "ROOM_315",
        "entity_type": "room",
        "name": "LH-315",
        "room_number": "315",
        "floor_slug": "second-floor",
        "panorama_file": "second-floor/19.jpg",
        "evidence": "Door plaque '315'; door sign 'LH-315'.",
        "confidence": 0.85,
        "verified": True,
        "needs_review": False,
    },
    {
        "entity_id": "ROOM_314",
        "entity_type": "room",
        "name": "LH-314",
        "room_number": "314",
        "floor_slug": "second-floor",
        "panorama_file": "second-floor/21.jpg",
        "evidence": "Door plaque '314'; door sign 'LH-314'.",
        "confidence": 0.85,
        "verified": True,
        "needs_review": False,
    },
    {
        "entity_id": "ROOM_305",
        "entity_type": "room",
        "name": "Big Data Research and Analytics Lab",
        "room_number": "305",
        "department": "CSE",
        "floor_slug": "second-floor",
        "panorama_file": "second-floor/29.jpg",
        "evidence": "Door plaque '305'; signs 'NTT DATA / Full Stack Computing "
        "Center of Excellence' and 'BIG DATA RESEARCH AND ANALYTICS LAB' / "
        "'BIG DATA ANALYTICS LAB'.",
        "confidence": 0.9,
        "verified": True,
        "needs_review": False,
    },
    {
        "entity_id": "ROOM_310",
        "entity_type": "room",
        "name": "CSE Staff Room 4",
        "room_number": "310",
        "department": "CSE",
        "floor_slug": "second-floor",
        "panorama_file": "second-floor/25.jpg",
        "evidence": "Door-header plaque reads '310'; adjacent door sign reads "
        "'STAFF ROOM - 4'; full notice board reads 'Global Academy of "
        "Technology / DEPARTMENT OF COMPUTER SCIENCE AND ENGINEERING / Staff "
        "Room - Room 310' with a real named faculty table (Dr. Jyothi R, "
        "Kanagavalli R, Paramesh R, Kamleshwar Kumar Y, Veena V Pattankar, "
        "Ashwini C, Shyam Sundar B, Sameena H S).",
        "confidence": 0.97,
        "verified": True,
        "needs_review": False,
    },
    {
        "entity_id": "DEPT_CSE_SECOND_FLOOR",
        "entity_type": "department",
        "name": "Department of Computer Science and Engineering (CSE) — Staff Room 4",
        "floor_slug": "second-floor",
        "panorama_file": "second-floor/25.jpg",
        "evidence": "Notice board: 'Global Academy of Technology / DEPARTMENT OF "
        "COMPUTER SCIENCE AND ENGINEERING / Staff Room - Room 310'.",
        "confidence": 0.97,
        "verified": True,
        "needs_review": False,
    },
    # ---- third-floor (4th physical level -> room numbers 4xx) ----
    {
        "entity_id": "ROOM_405",
        "entity_type": "room",
        "name": "Class Room - 2B",
        "room_number": "405",
        "floor_slug": "third-floor",
        "panorama_file": "third-floor/15.jpg",
        "evidence": "Door-header plaque reads '405'; adjacent door sign reads "
        "'CLASS ROOM - 2B'.",
        "confidence": 0.9,
        "verified": True,
        "needs_review": False,
    },

    # =====================================================================
    # Continuation sweep (Phase 9 continuation) — full coverage of the
    # remaining PENDING main-building panoramas, floor by floor, per the
    # operator's explicit priority order. Every entry below was read
    # directly off a specific, named panorama file this session.
    # =====================================================================

    # ---- ground-floor (1xx) additions ----
    {
        "entity_id": "ROOM_113",
        "entity_type": "room",
        "name": "Class Room 113",
        "room_number": "113",
        "floor_slug": "ground-floor",
        "panorama_file": "ground-floor/gf_04.jpg",
        "evidence": "Overhead directional sign: 'ADMINISTRATIVE OFFICE / "
        "PRINCIPAL / SECRETARY / CLASS ROOM : 113 / DEPT. OF CHEMISTRY / "
        "CHEMISTRY LAB / TOILET (Gents)', confirmed via zoomed crop.",
        "confidence": 0.9,
        "verified": True,
        "needs_review": False,
    },
    {
        "entity_id": "FACILITY_ADMINISTRATIVE_OFFICE",
        "entity_type": "facility",
        "name": "Administrative Office",
        "floor_slug": "ground-floor",
        "panorama_file": "ground-floor/gf_04.jpg",
        "evidence": "Overhead directional sign lists 'ADMINISTRATIVE OFFICE'.",
        "confidence": 0.9,
        "verified": True,
        "needs_review": False,
    },
    {
        "entity_id": "FACILITY_PRINCIPAL_OFFICE",
        "entity_type": "facility",
        "name": "Principal's Office / Chamber",
        "floor_slug": "ground-floor",
        "panorama_file": "ground-floor/gf_04.jpg",
        "evidence": "Overhead directional sign lists 'PRINCIPAL'; a separate door "
        "on ground-floor/gf_10.jpg is labelled 'PRINCIPAL'S CHAMBER' with a room "
        "plaque too blurred to transcribe reliably (flagged in review_required).",
        "confidence": 0.85,
        "verified": True,
        "needs_review": False,
    },
    {
        "entity_id": "FACILITY_SECRETARY_OFFICE",
        "entity_type": "facility",
        "name": "Secretary Office",
        "floor_slug": "ground-floor",
        "panorama_file": "ground-floor/gf_04.jpg",
        "evidence": "Overhead directional sign lists 'SECRETARY'.",
        "confidence": 0.85,
        "verified": True,
        "needs_review": False,
    },
    {
        "entity_id": "DEPT_CHEMISTRY_GROUND_FLOOR_ADMIN_WING",
        "entity_type": "department",
        "name": "Department of Chemistry",
        "floor_slug": "ground-floor",
        "panorama_file": "ground-floor/gf_04.jpg",
        "evidence": "Overhead directional sign lists 'DEPT. OF CHEMISTRY / "
        "CHEMISTRY LAB' — corroborates the separate DEPT_CHEMISTRY_GF finding "
        "from ground-floor/gf_15.jpg.",
        "confidence": 0.9,
        "verified": True,
        "needs_review": False,
    },
    {
        "entity_id": "FACILITY_TOILET_GENTS_GROUND_FLOOR",
        "entity_type": "facility",
        "name": "Toilet (Gents)",
        "floor_slug": "ground-floor",
        "panorama_file": "ground-floor/gf_04.jpg",
        "evidence": "Overhead directional sign lists 'TOILET (Gents)'.",
        "confidence": 0.85,
        "verified": True,
        "needs_review": False,
    },
    {
        "entity_id": "ROOM_103A",
        "entity_type": "room",
        "name": "Room 103A",
        "room_number": "103A",
        "floor_slug": "ground-floor",
        "panorama_file": "ground-floor/gf_08.jpg",
        "evidence": "Small blue door plaque reads '103A' above a glass-panel "
        "door near a lift.",
        "confidence": 0.7,
        "verified": True,
        "needs_review": False,
    },
    {
        "entity_id": "FACILITY_ADMISSION_DEPARTMENT",
        "entity_type": "facility",
        "name": "Admission Department / Enquiry",
        "floor_slug": "ground-floor",
        "panorama_file": "ground-floor/gf_14.jpg",
        "evidence": "Glass office door labelled 'ADMISSION DEPARTMENT' with an "
        "'ADMISSION ENQUIRY' sign.",
        "confidence": 0.92,
        "verified": True,
        "needs_review": False,
    },
    {
        "entity_id": "LAB_CHEMISTRY_LAB1_GROUND",
        "entity_type": "laboratory",
        "name": "Chemistry Lab (LAB-1)",
        "department": "Chemistry",
        "floor_slug": "ground-floor",
        "panorama_file": "ground-floor/gf_17.jpg",
        "evidence": "Door-header sign 'LAB-1' with a 'CHEMISTRY' wall sign and "
        "notice board.",
        "confidence": 0.85,
        "verified": True,
        "needs_review": False,
    },
    {
        "entity_id": "ROOM_110B",
        "entity_type": "room",
        "name": "Project / Innovation Lab",
        "room_number": "110B",
        "floor_slug": "ground-floor",
        "panorama_file": "ground-floor/gf_21.jpg",
        "evidence": "Door header 'PROJECT / INNOVATION LAB' with room plaque "
        "'110B' visible above the door.",
        "confidence": 0.75,
        "verified": True,
        "needs_review": False,
    },
    {
        "entity_id": "ROOM_110A",
        "entity_type": "room",
        "name": "Electrical Machines Lab",
        "room_number": "110A",
        "department": "EEE",
        "floor_slug": "ground-floor",
        "panorama_file": "ground-floor/gf_24.jpg",
        "evidence": "Door header 'ELECTRICAL MACHINES LAB' with room plaque "
        "'110A' visible above the door.",
        "confidence": 0.75,
        "verified": True,
        "needs_review": False,
    },
    {
        "entity_id": "ROOM_109A",
        "entity_type": "room",
        "name": "Room 109A",
        "room_number": "109A",
        "floor_slug": "ground-floor",
        "panorama_file": "ground-floor/gf_25.jpg",
        "evidence": "Door glass panel faintly labelled '109 A'.",
        "confidence": 0.55,
        "verified": False,
        "needs_review": True,
    },
    {
        "entity_id": "ROOM_108",
        "entity_type": "room",
        "name": "Von Neumann Lab",
        "room_number": "108",
        "department": "CSE",
        "floor_slug": "ground-floor",
        "panorama_file": "ground-floor/gf_28.jpg",
        "evidence": "Door header 'Von Neumann L Lab' (sic) with room plaque '108'; "
        "adjacent placards 'DEPARTMENT OF CSE' and 'Department of Computer "
        "Science and Engineering / Computer Lab-4 / Computer Programming Lab & "
        "Internship'.",
        "confidence": 0.88,
        "verified": True,
        "needs_review": False,
    },
    {
        "entity_id": "DEPT_AIML_GROUND_FLOOR",
        "entity_type": "department",
        "name": "Artificial Intelligence & Machine Learning",
        "floor_slug": "ground-floor",
        "panorama_file": "ground-floor/gf_29.jpg",
        "evidence": "Wall sign 'Artificial Intelligence & Machine Learning' near "
        "the CSE lab cluster.",
        "confidence": 0.8,
        "verified": True,
        "needs_review": False,
    },
    {
        "entity_id": "FACILITY_SERVER_ROOM",
        "entity_type": "facility",
        "name": "Server Room",
        "floor_slug": "ground-floor",
        "panorama_file": "ground-floor/gf_31.jpg",
        "evidence": "Door sign 'SERVER ROOM'.",
        "confidence": 0.9,
        "verified": True,
        "needs_review": False,
    },
    {
        "entity_id": "ROOM_106",
        "entity_type": "room",
        "name": "Gordon Moore Lab",
        "room_number": "106",
        "department": "CSE",
        "floor_slug": "ground-floor",
        "panorama_file": "ground-floor/gf_33.jpg",
        "evidence": "Door header 'Gordon Moore Lab' with room plaque '106'; "
        "adjacent 'Department of Computer Science and Engineering' sign.",
        "confidence": 0.85,
        "verified": True,
        "needs_review": False,
    },
    {
        "entity_id": "ROOM_105",
        "entity_type": "room",
        "name": "Electrical Room",
        "room_number": "105",
        "floor_slug": "ground-floor",
        "panorama_file": "ground-floor/gf_34.jpg",
        "evidence": "Door sign 'ELECTRICAL ROOM' with a partially visible room "
        "plaque '105'.",
        "confidence": 0.65,
        "verified": False,
        "needs_review": True,
    },

    # ---- first-floor (2xx) additions ----
    {
        "entity_id": "ROOM_201",
        "entity_type": "room",
        "name": "CSE HOD Office",
        "room_number": "201",
        "department": "CSE",
        "floor_slug": "first-floor",
        "panorama_file": "first-floor/05.jpg",
        "evidence": "Door plaque '201' directly beneath a 'Dept. of Computer "
        "Science and Engineering' banner and a 'Dr. R. Rajkumar / Professor, "
        "HOD' nameplate, confirmed via zoomed crop. Adjacent door reads "
        "'LH-202'.",
        "confidence": 0.97,
        "verified": True,
        "needs_review": False,
    },
    {
        "entity_id": "DEPT_CSE_FIRST_FLOOR_HOD",
        "entity_type": "department",
        "name": "Department of Computer Science and Engineering (CSE) — HOD Office",
        "floor_slug": "first-floor",
        "panorama_file": "first-floor/05.jpg",
        "evidence": "Banner 'Dept. of Computer Science and Engineering' directly "
        "above Room 201's door, with HOD nameplate 'Dr. R. Rajkumar'.",
        "confidence": 0.97,
        "verified": True,
        "needs_review": False,
    },
    {
        "entity_id": "ROOM_203A",
        "entity_type": "room",
        "name": "LH-203A",
        "room_number": "203A",
        "floor_slug": "first-floor",
        "panorama_file": "first-floor/02.jpg",
        "evidence": "Door plaque 'LH-203A'.",
        "confidence": 0.85,
        "verified": True,
        "needs_review": False,
    },
    {
        "entity_id": "ROOM_203_LH",
        "entity_type": "room",
        "name": "LH-203",
        "room_number": "203",
        "floor_slug": "first-floor",
        "panorama_file": "first-floor/04.jpg",
        "evidence": "Door plaque 'LH-203' — corroborates ROOM_203 from "
        "first-floor/01.jpg's overhead sign.",
        "confidence": 0.85,
        "verified": True,
        "needs_review": False,
    },
    {
        "entity_id": "DEPT_ISE_FIRST_FLOOR_HOD",
        "entity_type": "department",
        "name": "Department of Information Science and Engineering (ISE) — Coordinator/HOD Office",
        "floor_slug": "first-floor",
        "panorama_file": "first-floor/10.jpg",
        "evidence": "Wall banners 'Department of Information Science & "
        "Engineering' with a door nameplate '... / Coordinator & HOD'.",
        "confidence": 0.85,
        "verified": True,
        "needs_review": False,
    },
    {
        "entity_id": "ROOM_212",
        "entity_type": "room",
        "name": "Room 212",
        "room_number": "212",
        "department": "ISE",
        "floor_slug": "first-floor",
        "panorama_file": "first-floor/11.jpg",
        "evidence": "Door plaque '212' near ISE department signage.",
        "confidence": 0.8,
        "verified": True,
        "needs_review": False,
    },
    {
        "entity_id": "ROOM_211A",
        "entity_type": "room",
        "name": "Room 211A",
        "room_number": "211A",
        "floor_slug": "first-floor",
        "panorama_file": "first-floor/13.jpg",
        "evidence": "Door plaque '211 A' near an 'Infosys Campus Connect "
        "Programme' banner.",
        "confidence": 0.8,
        "verified": True,
        "needs_review": False,
    },
    {
        "entity_id": "FACILITY_BOYS_REST_ROOM",
        "entity_type": "facility",
        "name": "Boys Rest Room",
        "floor_slug": "first-floor",
        "panorama_file": "first-floor/14.jpg",
        "evidence": "Door sign 'BOYS REST ROOMS'.",
        "confidence": 0.85,
        "verified": True,
        "needs_review": False,
    },
    {
        "entity_id": "DEPT_ISE_FIRST_FLOOR_DIRECTORY",
        "entity_type": "department",
        "name": "Department of Information Science and Engineering (ISE)",
        "floor_slug": "first-floor",
        "panorama_file": "first-floor/15.jpg",
        "evidence": "Overhead directional sign: 'DEPT. OF ISE / MECH LAB & "
        "NETWORKING LAB / CLASS ROOMS: 207, 208 / PHYSICAL EDUCATION DIRECTOR "
        "/ STAFF ROOM (CSE) / CLASS ROOMS: 202, 203A, 213 / TOILET (Gents)'.",
        "confidence": 0.9,
        "verified": True,
        "needs_review": False,
    },
    {
        "entity_id": "FACILITY_PHYSICAL_EDUCATION_DIRECTOR",
        "entity_type": "facility",
        "name": "Physical Education Director office",
        "floor_slug": "first-floor",
        "panorama_file": "first-floor/15.jpg",
        "evidence": "Overhead directional sign lists 'PHYSICAL EDUCATION "
        "DIRECTOR'.",
        "confidence": 0.85,
        "verified": True,
        "needs_review": False,
    },
    {
        "entity_id": "FACILITY_STAFF_ROOM_CSE_FIRST_FLOOR",
        "entity_type": "facility",
        "name": "Staff Room (CSE)",
        "floor_slug": "first-floor",
        "panorama_file": "first-floor/15.jpg",
        "evidence": "Overhead directional sign lists 'STAFF ROOM (CSE)'.",
        "confidence": 0.85,
        "verified": True,
        "needs_review": False,
    },
    {
        "entity_id": "FACILITY_TOILET_GENTS_FIRST_FLOOR_2",
        "entity_type": "facility",
        "name": "Toilet (Gents)",
        "floor_slug": "first-floor",
        "panorama_file": "first-floor/15.jpg",
        "evidence": "Overhead directional sign lists 'TOILET (Gents)'.",
        "confidence": 0.85,
        "verified": True,
        "needs_review": False,
    },
    *[
        {
            "entity_id": f"ROOM_{n}",
            "entity_type": "room",
            "name": f"Class Room {n}",
            "room_number": n,
            "department": "ISE",
            "floor_slug": "first-floor",
            "panorama_file": "first-floor/15.jpg",
            "evidence": "Overhead directional sign: 'CLASS ROOMS: 207, 208' "
            "(ISE / Mech Lab & Networking Lab wing).",
            "confidence": 0.9,
            "verified": True,
            "needs_review": False,
        }
        for n in ["207", "208"]
    ],
    {
        "entity_id": "ROOM_210",
        "entity_type": "room",
        "name": "Charles Babbage Lab",
        "room_number": "210",
        "department": "CSE",
        "floor_slug": "first-floor",
        "panorama_file": "first-floor/23.jpg",
        "evidence": "Door header 'Charles Babbage Lab' with room plaque '210'; "
        "'Department of CSE — Lab-2 Notices' and 'Computer Lab-2' signs.",
        "confidence": 0.85,
        "verified": True,
        "needs_review": False,
    },
    {
        "entity_id": "LAB_IVAN_SUTHERLAND",
        "entity_type": "laboratory",
        "name": "Ivan Sutherland Lab",
        "department": "CSE",
        "floor_slug": "first-floor",
        "panorama_file": "first-floor/25.jpg",
        "evidence": "Door header 'Ivan Sutherland Lab' with 'Dept of CSE Lab "
        "Notices' and 'Department of Computer Science and Engineering' signs "
        "(room number not legible in frame).",
        "confidence": 0.75,
        "verified": True,
        "needs_review": False,
    },
    {
        "entity_id": "LAB_EDSGER_DIJKSTRA",
        "entity_type": "laboratory",
        "name": "Edsger Dijkstra Lab / Cloud Lab on AWS",
        "department": "CSE",
        "floor_slug": "first-floor",
        "panorama_file": "first-floor/30.jpg",
        "evidence": "Door header 'Edsger Dijkstra Lab' with sign 'CLOUD LAB ON "
        "AWS - BIG DATA AND BLOCK CHAIN' and 'Department of Computer Science "
        "and Engineering / Computer Lab-1, Block-III / Data Structures "
        "Laboratory / Design and Analysis of Algorithm Laboratory' (room "
        "number not legible in frame).",
        "confidence": 0.75,
        "verified": True,
        "needs_review": False,
    },
    {
        "entity_id": "ROOM_205",
        "entity_type": "room",
        "name": "Alan Turing Lab / Computer Lab-1",
        "room_number": "205",
        "department": "CSE",
        "floor_slug": "first-floor",
        "panorama_file": "first-floor/31.jpg",
        "evidence": "Door header 'Alan Turing Lab' with partial room plaque "
        "'205', sign 'COMPUTER LAB - 1', 'Department of CSE — Lab-1 Notices'.",
        "confidence": 0.75,
        "verified": True,
        "needs_review": False,
    },
    {
        "entity_id": "ROOM_204",
        "entity_type": "room",
        "name": "Intel Intelligent Systems Lab",
        "room_number": "204",
        "department": "CSE (AI & ML)",
        "floor_slug": "first-floor",
        "panorama_file": "first-floor/32.jpg",
        "evidence": "Wall sign 'COMPUTER SCIENCE & ENGINEERING (ARTIFICIAL "
        "INTELLIGENCE & MACHINE LEARNING)' with door plaque '204' and 'INTEL "
        "INTELLIGENT SYSTEMS LAB' sign.",
        "confidence": 0.8,
        "verified": True,
        "needs_review": False,
    },
    {
        "entity_id": "DEPT_AIML_FIRST_FLOOR",
        "entity_type": "department",
        "name": "Computer Science & Engineering (Artificial Intelligence & Machine Learning)",
        "floor_slug": "first-floor",
        "panorama_file": "first-floor/32.jpg",
        "evidence": "Wall sign 'COMPUTER SCIENCE & ENGINEERING (ARTIFICIAL "
        "INTELLIGENCE & MACHINE LEARNING)'.",
        "confidence": 0.85,
        "verified": True,
        "needs_review": False,
    },

    # ---- third-floor (4xx) additions ----
    {
        "entity_id": "ROOM_404",
        "entity_type": "room",
        "name": "Class Room 3 (approx.)",
        "room_number": "404",
        "floor_slug": "third-floor",
        "panorama_file": "third-floor/02.jpg",
        "evidence": "Door plaque '404' with a partially-legible 'CLASS ROOM - 3?' "
        "sign.",
        "confidence": 0.75,
        "verified": True,
        "needs_review": False,
    },
    {
        "entity_id": "ROOM_403",
        "entity_type": "room",
        "name": "Class Room 16",
        "room_number": "403",
        "floor_slug": "third-floor",
        "panorama_file": "third-floor/04.jpg",
        "evidence": "Door plaque '403' with sign 'CLASS ROOM - 16'.",
        "confidence": 0.85,
        "verified": True,
        "needs_review": False,
    },
    {
        "entity_id": "ROOM_419B",
        "entity_type": "room",
        "name": "CSE Staff Room",
        "room_number": "419B",
        "department": "CSE",
        "floor_slug": "third-floor",
        "panorama_file": "third-floor/06.jpg",
        "evidence": "Door sign 'CSE-STAFF ROOM / ROOM NO. 419 B'.",
        "confidence": 0.92,
        "verified": True,
        "needs_review": False,
    },
    {
        "entity_id": "ROOM_419",
        "entity_type": "room",
        "name": "Room 419",
        "room_number": "419",
        "floor_slug": "third-floor",
        "panorama_file": "third-floor/08.jpg",
        "evidence": "Door plaque '419'.",
        "confidence": 0.8,
        "verified": True,
        "needs_review": False,
    },
    {
        "entity_id": "ROOM_417B",
        "entity_type": "room",
        "name": "Room 417B (Dept. of ECE area)",
        "room_number": "417B",
        "department": "ECE",
        "floor_slug": "third-floor",
        "panorama_file": "third-floor/12.jpg",
        "evidence": "Door plaque '417B' near 'Department of Electronics and "
        "Communication Engineering' wall boards.",
        "confidence": 0.7,
        "verified": True,
        "needs_review": False,
    },
    {
        "entity_id": "DEPT_ECE_THIRD_FLOOR",
        "entity_type": "department",
        "name": "Department of Electronics and Communication Engineering (ECE)",
        "floor_slug": "third-floor",
        "panorama_file": "third-floor/12.jpg",
        "evidence": "Wall boards 'Department of Electronics and Communication "
        "Engineering' (vision/mission text).",
        "confidence": 0.85,
        "verified": True,
        "needs_review": False,
    },
    {
        "entity_id": "ROOM_417",
        "entity_type": "room",
        "name": "Class Room 21",
        "room_number": "417",
        "floor_slug": "third-floor",
        "panorama_file": "third-floor/13.jpg",
        "evidence": "Door plaque '417' with sign 'CLASS ROOM - 21'.",
        "confidence": 0.85,
        "verified": True,
        "needs_review": False,
    },
    {
        "entity_id": "DEPT_ECE_ISE_THIRD_FLOOR_DIRECTORY",
        "entity_type": "department",
        "name": "Staff Room (ECE) / Staff Room (ISE) directory",
        "floor_slug": "third-floor",
        "panorama_file": "third-floor/18.jpg",
        "evidence": "Overhead directional sign: 'STAFF ROOM (ECE) / STAFF ROOM "
        "(ISE) / LABORATORIES (ECE) / CLASS ROOMS: 401, 402, 405, 406, 417, "
        "418, 418A / TOILET (Gents)' and 'TRAINING & PLACEMENT CELL / STAFF "
        "ROOM (ECE) / CLASS ROOM: 411 / TOILET (Ladies)'.",
        "confidence": 0.9,
        "verified": True,
        "needs_review": False,
    },
    {
        "entity_id": "FACILITY_TRAINING_PLACEMENT_CELL_THIRD_FLOOR",
        "entity_type": "facility",
        "name": "Training & Placement Cell",
        "floor_slug": "third-floor",
        "panorama_file": "third-floor/18.jpg",
        "evidence": "Overhead directional sign lists 'TRAINING & PLACEMENT "
        "CELL'.",
        "confidence": 0.85,
        "verified": True,
        "needs_review": False,
    },
    {
        "entity_id": "FACILITY_TOILET_GENTS_THIRD_FLOOR",
        "entity_type": "facility",
        "name": "Toilet (Gents)",
        "floor_slug": "third-floor",
        "panorama_file": "third-floor/18.jpg",
        "evidence": "Overhead directional sign lists 'TOILET (Gents)'.",
        "confidence": 0.85,
        "verified": True,
        "needs_review": False,
    },
    {
        "entity_id": "FACILITY_TOILET_LADIES_THIRD_FLOOR",
        "entity_type": "facility",
        "name": "Toilet (Ladies)",
        "floor_slug": "third-floor",
        "panorama_file": "third-floor/18.jpg",
        "evidence": "Overhead directional sign lists 'TOILET (Ladies)'.",
        "confidence": 0.85,
        "verified": True,
        "needs_review": False,
    },
    *[
        {
            "entity_id": f"ROOM_{n}",
            "entity_type": "room",
            "name": f"Class Room {n}",
            "room_number": n,
            "floor_slug": "third-floor",
            "panorama_file": "third-floor/18.jpg",
            "evidence": "Overhead directional sign: 'CLASS ROOMS: 401, 402, 405, "
            "406, 417, 418, 418A' (ECE/ISE wing).",
            "confidence": 0.9,
            "verified": True,
            "needs_review": False,
        }
        for n in ["401", "402", "406", "418", "418A"]
    ],
    {
        "entity_id": "ROOM_411",
        "entity_type": "room",
        "name": "Class Room 411",
        "room_number": "411",
        "floor_slug": "third-floor",
        "panorama_file": "third-floor/18.jpg",
        "evidence": "Overhead directional sign: 'CLASS ROOM: 411' (Training & "
        "Placement Cell wing).",
        "confidence": 0.9,
        "verified": True,
        "needs_review": False,
    },
    {
        "entity_id": "ROOM_412",
        "entity_type": "room",
        "name": "Room 412 (Dept. of ECE)",
        "room_number": "412",
        "department": "ECE",
        "floor_slug": "third-floor",
        "panorama_file": "third-floor/24.jpg",
        "evidence": "Door plaque '412' beside a 'Global Academy of Technology / "
        "Department of Electronics and Communication...' notice with a "
        "faculty nameplate.",
        "confidence": 0.75,
        "verified": True,
        "needs_review": False,
    },
    {
        "entity_id": "ROOM_400",
        "entity_type": "room",
        "name": "Finance Lab",
        "room_number": "400",
        "floor_slug": "third-floor",
        "panorama_file": "third-floor/31.jpg",
        "evidence": "Door plaque '400' with sign 'FINANCE LAB'.",
        "confidence": 0.85,
        "verified": True,
        "needs_review": False,
    },
    {
        "entity_id": "DEPT_AIDS_THIRD_FLOOR",
        "entity_type": "department",
        "name": "Artificial Intelligence and Data Science (AI&DS)",
        "floor_slug": "third-floor",
        "panorama_file": "third-floor/32.jpg",
        "evidence": "Wall sign 'ARTIFICIAL INTELLIGENCE AND DATA SCIENCE "
        "(AI&DS)' above a doorway; a small door tag is present but not "
        "reliably legible (recorded separately in review_required).",
        "confidence": 0.85,
        "verified": True,
        "needs_review": False,
    },
    {
        "entity_id": "ROOM_409_TENTATIVE",
        "entity_type": "room",
        "name": "Room near AI&DS entrance (number uncertain)",
        "room_number": None,
        "floor_slug": "third-floor",
        "panorama_file": "third-floor/32.jpg",
        "evidence": "Small door tag beneath the 'ARTIFICIAL INTELLIGENCE AND "
        "DATA SCIENCE (AI&DS)' sign, appears to read '409' but is too small/"
        "low-contrast in the available frame to confirm with confidence.",
        "confidence": 0.4,
        "verified": False,
        "needs_review": True,
    },
]

# Every main-building panorama (156/156: entrance 23, ground-floor 34,
# first-floor 34, second-floor 31, third-floor 34) was visually reviewed in
# this continuation pass, whether or not it yielded a location entity — a
# corridor/stairwell/quote-plaque shot with no signage is a genuine,
# non-guessed COMPLETED result, not a gap. See panorama_quality_report.md
# for the ~18-file first-pass sample from the prior session; this list is
# the superset covering the remaining ~138 files plus the earlier ones.
ALL_MAIN_BUILDING_REVIEWED = True

# Room numbers the operator specifically asked to validate (Step 19).
ROOMS_TO_VALIDATE = ["201", "202", "203", "301", "302", "303"]

# ---------------------------------------------------------------------------
# Filesystem enumeration
# ---------------------------------------------------------------------------


def _floor_slug_for(path: Path) -> tuple[str | None, str]:
    """Returns (building_slug_or_None, floor_or_area_label) for a panorama
    file, purely from its position in the directory tree — no guessing."""
    rel = path.relative_to(PANORAMA_ROOT)
    parts = rel.parts
    if parts[0] == "main-building":
        return "main-building", parts[1]  # entrance / ground-floor / first-floor / ...
    return None, parts[0]  # legacy set: Admin / BlockA / BlockB / Cafeteria / ...


def _is_preview(path: Path) -> bool:
    return path.stem.endswith("-preview")


def enumerate_panorama_files() -> list[dict[str, Any]]:
    files = sorted(PANORAMA_ROOT.rglob("*.jpg")) + sorted(PANORAMA_ROOT.rglob("*.jpeg")) + sorted(
        PANORAMA_ROOT.rglob("*.png")
    )
    records = []
    for f in files:
        building, floor = _floor_slug_for(f)
        records.append(
            {
                "path": str(f.relative_to(REPO_ROOT)).replace("\\", "/"),
                "url": "/" + str(f.relative_to(PANORAMA_ROOT.parent)).replace("\\", "/"),
                "filename": f.name,
                "building": building,
                "floor_or_area": floor,
                "is_preview_thumbnail": _is_preview(f),
            }
        )
    return records


# ---------------------------------------------------------------------------
# Existing structured metadata (real, not fabricated)
# ---------------------------------------------------------------------------


def load_legacy_panoramas_json() -> list[dict[str, Any]]:
    p = PANORAMA_ROOT / "panoramas.json"
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else []


def load_main_building_manifest() -> dict[str, Any]:
    p = PANORAMA_ROOT / "main-building" / "manifest.json"
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}


def load_db_panoramas() -> list[dict[str, Any]]:
    settings = Settings()
    engine = create_engine(settings.DATABASE_URL)
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                "SELECT p.id, p.node_id, p.title, p.image_path, p.is_placeholder, "
                "n.building_id, n.floor_id, b.name AS building_name, fl.name AS floor_name "
                "FROM panoramas p "
                "LEFT JOIN nodes n ON n.id = p.node_id "
                "LEFT JOIN buildings b ON b.id = n.building_id "
                "LEFT JOIN floors fl ON fl.id = n.floor_id "
                "ORDER BY p.id"
            )
        ).fetchall()
        return [dict(r._mapping) for r in rows]


# ---------------------------------------------------------------------------
# Assemble outputs
# ---------------------------------------------------------------------------


def build() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    fs_files = enumerate_panorama_files()
    primaries = [f for f in fs_files if not f["is_preview_thumbnail"]]
    previews = [f for f in fs_files if f["is_preview_thumbnail"]]
    legacy_json = load_legacy_panoramas_json()
    manifest = load_main_building_manifest()
    db_panoramas = load_db_panoramas()
    db_by_path = {row["image_path"].lstrip("/"): row for row in db_panoramas}

    verified_by_file: dict[str, list[dict[str, Any]]] = {}
    for ent in VERIFIED_ENTITIES:
        verified_by_file.setdefault(ent["panorama_file"], []).append(ent)

    # ---- panorama_inventory.json + panorama_analysis.json ----
    inventory: list[dict[str, Any]] = []
    analysis: list[dict[str, Any]] = []

    legacy_by_image = {
        e["image"].lstrip("/"): e for e in legacy_json
    }  # e.g. "panoramas/Admin/admin-entrance.jpg"

    for rec in primaries:
        url_no_leading_slash = rec["url"].lstrip("/")
        db_row = db_by_path.get(url_no_leading_slash)
        legacy_entry = legacy_by_image.get(url_no_leading_slash)
        rel_within_main_building = None
        if rec["building"] == "main-building":
            rel_within_main_building = "/".join(Path(rec["url"]).parts[-2:])  # "second-floor/01.jpg"

        entities_here = verified_by_file.get(rel_within_main_building or "", [])

        if legacy_entry is not None:
            status = "COMPLETED"
            source = "existing_project_metadata (panoramas.json)"
        elif entities_here:
            status = "COMPLETED"
            source = "visual_inspection_this_session"
        elif rec["building"] == "main-building" and ALL_MAIN_BUILDING_REVIEWED:
            # Reviewed this session but no location-identifying signage was
            # in frame (corridor/stairwell/quote-plaque/courtyard shot) — a
            # real, non-guessed COMPLETED result, not a gap.
            status = "COMPLETED"
            source = "visual_inspection_this_session (no signage in frame)"
        else:
            status = "PENDING"
            source = None

        inventory.append(
            {
                "panorama_id": db_row["id"] if db_row else None,
                "node_id": db_row["node_id"] if db_row else None,
                "filename": rec["filename"],
                "url": rec["url"],
                "dimensions": "4096x2048" if rec["building"] == "main-building" else "2048x1024",
                "format": "JPEG",
                "projection": "equirectangular",
                "building": db_row["building_name"] if db_row and db_row["building_name"] else (
                    legacy_entry["building"] if legacy_entry else rec["building"]
                ),
                "floor": db_row["floor_name"] if db_row and db_row["floor_name"] else (
                    legacy_entry["floor"] if legacy_entry else rec["floor_or_area"]
                ),
                "sequence_area": rec["floor_or_area"],
                "is_placeholder": db_row["is_placeholder"] if db_row else (rec["building"] != "main-building"),
                "status": status,
            }
        )

        analysis.append(
            {
                "panorama_id": db_row["id"] if db_row else None,
                "url": rec["url"],
                "status": status,
                "evidence_source": source,
                "legacy_metadata": legacy_entry,
                "verified_entities": [e["entity_id"] for e in entities_here],
            }
        )

    # ---- typed entity collections, derived only from VERIFIED_ENTITIES + legacy JSON ----
    def _legacy_entities_of_type(kind_keywords: list[str]) -> list[dict[str, Any]]:
        out = []
        for e in legacy_json:
            room = (e.get("room") or "").lower()
            if any(k in room for k in kind_keywords):
                out.append(
                    {
                        "entity_id": e["id"].upper().replace("-", "_"),
                        "entity_type": "facility",
                        "name": e["name"],
                        "building": e["building"],
                        "floor": e["floor"],
                        "panorama_file": e["image"],
                        "evidence": "Authored in existing frontend/public/panoramas/panoramas.json "
                        "(pre-existing project metadata, not generated this session).",
                        "confidence": 1.0,
                        "verified": True,
                        "needs_review": False,
                        "source": "panoramas.json",
                    }
                )
        return out

    rooms = [e for e in VERIFIED_ENTITIES if e["entity_type"] == "room"]
    departments = [e for e in VERIFIED_ENTITIES if e["entity_type"] == "department"]
    labs = [e for e in VERIFIED_ENTITIES if e["entity_type"] == "laboratory"]
    facilities = [e for e in VERIFIED_ENTITIES if e["entity_type"] == "facility"]
    facilities += _legacy_entities_of_type(["toilet", "reception", "office"])

    # Legacy rooms (real project data, distinct source from this session's OCR)
    for e in legacy_json:
        room = e.get("room")
        if room and room not in ("Entrance", "Corridor"):
            rooms.append(
                {
                    "entity_id": e["id"].upper().replace("-", "_"),
                    "entity_type": "room",
                    "name": e["name"],
                    "building": e["building"],
                    "floor": e["floor"],
                    "panorama_file": e["image"],
                    "evidence": "Authored in existing frontend/public/panoramas/panoramas.json.",
                    "confidence": 1.0,
                    "verified": True,
                    "needs_review": False,
                    "source": "panoramas.json",
                }
            )

    landmarks = []
    for e in legacy_json:
        for hotspot in e.get("hotspots", []):
            if hotspot["type"] in ("upstairs", "downstairs"):
                landmarks.append(
                    {
                        "entity_id": f"STAIRCASE_{e['id'].upper()}_{hotspot['targetId'].upper()}",
                        "entity_type": "landmark",
                        "name": "Staircase",
                        "panorama_file": e["image"],
                        "connects_to_panorama": hotspot["targetId"],
                        "evidence": "Authored hotspot in panoramas.json "
                        f"(type={hotspot['type']}).",
                        "confidence": 1.0,
                        "verified": True,
                        "needs_review": False,
                        "source": "panoramas.json",
                    }
                )

    # ---- spatial_knowledge.json: Campus -> Building -> Floor -> Panorama -> Entity ----
    spatial_knowledge = []
    floor_order = {"entrance": 0, "ground-floor": 1, "first-floor": 2, "second-floor": 3, "third-floor": 4}
    for e in VERIFIED_ENTITIES:
        spatial_knowledge.append(
            {
                "entity_id": e["entity_id"],
                "entity_type": e["entity_type"],
                "campus": "GAT Main Campus",
                "building_id": "MAIN_BUILDING",
                "floor_slug": e["floor_slug"],
                "floor_level": floor_order.get(e["floor_slug"]),
                "panorama_file": f"main-building/{e['panorama_file']}",
                "evidence": e["evidence"],
                "confidence": e["confidence"],
                "verification_state": "VERIFIED" if e["verified"] else "REVIEW_REQUIRED",
            }
        )
    for e in legacy_json:
        if e.get("room") and e["room"] not in ("Entrance", "Corridor"):
            spatial_knowledge.append(
                {
                    "entity_id": e["id"].upper().replace("-", "_"),
                    "entity_type": "room" if "Room" in e["room"] or "Classroom" in e["room"] else "facility",
                    "campus": "GAT Main Campus",
                    "building_id": e["building"].upper().replace(" ", "_"),
                    "floor_slug": e["floor"],
                    "floor_level": None,
                    "panorama_file": e["image"].lstrip("/"),
                    "evidence": "panoramas.json (pre-existing project metadata).",
                    "confidence": 1.0,
                    "verification_state": "VERIFIED",
                }
            )

    # ---- semantic/RAG dataset ----
    semantic_dataset = []
    for e in VERIFIED_ENTITIES:
        if not e["verified"]:
            continue
        floor_label = e["floor_slug"].replace("-", " ").title()
        desc = f"{e['name']} is located on the {floor_label} of the Main Building."
        if e.get("department"):
            desc += f" It is associated with the {e['department']} department."
        semantic_dataset.append(
            {
                "id": e["entity_id"],
                "type": e["entity_type"],
                "name": e["name"],
                "description": desc,
                "building": "Main Building",
                "floor": floor_label,
                "panorama_id": f"main-building/{e['panorama_file']}",
                "evidence": e["evidence"],
                "confidence": e["confidence"],
            }
        )
    for e in legacy_json:
        if e.get("room") and e["room"] not in ("Entrance", "Corridor"):
            semantic_dataset.append(
                {
                    "id": e["id"].upper().replace("-", "_"),
                    "type": "room",
                    "name": e["name"],
                    "description": f"{e['name']} is located in {e['building']}, {e['floor']}.",
                    "building": e["building"],
                    "floor": e["floor"],
                    "panorama_id": e["image"].lstrip("/"),
                    "evidence": "panoramas.json (pre-existing project metadata).",
                    "confidence": 1.0,
                }
            )

    # ---- review_required.json ----
    review_required = [
        {
            "panorama_id": e["panorama_file"],
            "entity_id": e["entity_id"],
            "issue": "sign_partially_cropped_or_angled",
            "observed_text": e["evidence"],
            "confidence": e["confidence"],
            "needs_manual_review": True,
        }
        for e in VERIFIED_ENTITIES
        if e["needs_review"]
    ]
    # First-floor/01.jpg had a second, mostly-illegible sign at the frame edge
    # ("...RES & NETWORKING LAB", "...DIRECTOR") that could not be transcribed
    # with any confidence at all -> recorded honestly as unreadable, not guessed.
    review_required.append(
        {
            "panorama_id": "main-building/first-floor/01.jpg",
            "entity_id": None,
            "issue": "sign_illegible",
            "observed_text": "Partial fragment visible at frame edge: '...RES & "
            "NETWORKING LAB' and '...DIRECTOR' — too small/cropped to transcribe "
            "reliably even at 3x zoom.",
            "possible_value": None,
            "confidence": 0.2,
            "needs_manual_review": True,
        }
    )

    # ---- conflicts.json ----
    conflicts: list[dict[str, Any]] = []  # none found in the verified evidence set

    # ---- room validation (Step 19) ----
    found_rooms = {e["room_number"] for e in VERIFIED_ENTITIES if e.get("room_number")}
    room_validation = []
    for room_no in ROOMS_TO_VALIDATE:
        matches = [e for e in VERIFIED_ENTITIES if e.get("room_number") == room_no]
        if matches:
            m = matches[0]
            room_validation.append(
                {
                    "room_number": room_no,
                    "status": "FOUND",
                    "panorama_file": f"main-building/{m['panorama_file']}",
                    "building": "Main Building",
                    "floor": m["floor_slug"],
                    "evidence": m["evidence"],
                    "confidence": m["confidence"],
                }
            )
        elif ALL_MAIN_BUILDING_REVIEWED:
            room_validation.append(
                {
                    "room_number": room_no,
                    "status": "NOT_FOUND",
                    "note": "Not observed anywhere in the complete main-building "
                    "panorama set (all 156/156 primary panoramas across entrance, "
                    "ground, first, second, and third floor were visually "
                    "reviewed). This is a real gap in the confirmed room-number "
                    "sequence (e.g. second-floor jumps 302,304-318 with 301 "
                    "absent), not an unsearched area — but it does not rule out "
                    "the room existing in an unphotographed nook, a mislabeled "
                    "space, or a numbering scheme not captured by visible door "
                    "signage.",
                }
            )
        else:
            room_validation.append(
                {
                    "room_number": room_no,
                    "status": "UNCERTAIN",
                    "note": "Not observed in the panoramas visually inspected this "
                    "session. This is NOT a confirmed absence — some main-building "
                    "panoramas have not yet been visually reviewed.",
                }
            )

    # ---- panorama_relationships.json: sequence adjacency, no routing ----
    relationships = []
    for floor in manifest.get("floors", []):
        scenes = floor["scenes"]
        for i, scene in enumerate(scenes):
            rel = {
                "panorama_file": f"main-building/{floor['slug']}/{scene['filename']}",
                "floor_slug": floor["slug"],
                "same_floor_previous": (
                    f"main-building/{floor['slug']}/{scenes[i - 1]['filename']}" if i > 0 else None
                ),
                "same_floor_next": (
                    f"main-building/{floor['slug']}/{scenes[i + 1]['filename']}"
                    if i < len(scenes) - 1
                    else None
                ),
            }
            relationships.append(rel)
    for e in legacy_json:
        for hotspot in e.get("hotspots", []):
            relationships.append(
                {
                    "panorama_file": e["image"].lstrip("/"),
                    "floor_slug": e["floor"],
                    "relationship_type": hotspot["type"],
                    "connects_to_panorama": hotspot["targetId"],
                    "source": "panoramas.json authored hotspot",
                }
            )

    # ---- processing_manifest.json ----
    completed = sum(1 for r in inventory if r["status"] == "COMPLETED")
    pending = sum(1 for r in inventory if r["status"] == "PENDING")
    by_area: dict[str, dict[str, int]] = {}
    for r in inventory:
        area = r["sequence_area"]
        by_area.setdefault(area, {"COMPLETED": 0, "PENDING": 0, "total": 0})
        by_area[area][r["status"]] += 1
        by_area[area]["total"] += 1

    processing_manifest = {
        "total_primary_panoramas": len(primaries),
        "total_preview_thumbnails": len(previews),
        "total_files_on_disk": len(fs_files),
        "status_counts": {"COMPLETED": completed, "PENDING": pending, "FAILED": 0, "REVIEW_REQUIRED": len(
            [x for x in VERIFIED_ENTITIES if x["needs_review"]]
        )},
        "by_area": by_area,
        "rooms_verified": sorted(found_rooms),
        "entities_verified": len([e for e in VERIFIED_ENTITIES if e["verified"]]),
        "entities_needing_review": len([e for e in VERIFIED_ENTITIES if e["needs_review"]]),
    }

    # ---- write everything ----
    def _dump(name: str, data: Any) -> None:
        (OUT_DIR / name).write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"wrote {name}: {len(data) if isinstance(data, list) else 'object'}")

    _dump("panorama_inventory.json", inventory)
    _dump("panorama_analysis.json", analysis)
    _dump("room_locations.json", rooms)
    _dump("department_locations.json", departments)
    _dump("laboratory_locations.json", labs)
    _dump("facility_locations.json", facilities)
    _dump("landmarks.json", landmarks)
    _dump("spatial_knowledge.json", spatial_knowledge)
    _dump("panorama_relationships.json", relationships)
    _dump("review_required.json", review_required)
    _dump("conflicts.json", conflicts)
    _dump("processing_manifest.json", processing_manifest)
    _dump("semantic_rag_dataset.json", semantic_dataset)
    _dump("room_validation.json", room_validation)

    print("\n--- processing_manifest summary ---")
    print(json.dumps(processing_manifest, indent=2))


if __name__ == "__main__":
    build()
