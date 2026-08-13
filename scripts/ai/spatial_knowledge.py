"""Phase 10 — Spatial knowledge retrieval layer.

Reads the Phase 9 output (data/campus_spatial/*.json) — real, evidence-backed
room/department/laboratory/facility/landmark records derived from actually
reading door signage in the campus panoramas — and exposes lookup functions
over it. This is NOT a navigation graph: there is no routing, no coordinates,
no path calculation here, only "what/where is this real, photographed
entity" lookups. See data/campus_spatial/phase9_report.md for how the data
was produced.

Deliberately separate from campus_tools.py (which wraps the PostgreSQL
Room/Building tables): the Phase 9 dataset lives in flat JSON files, not the
database, and covers an entirely different set of real rooms (the actual
main-building room numbers, e.g. 201-419) that PostgreSQL's seeded Room
table does not contain at all. Loaded once into memory (small: a few
hundred records) and reused — no per-request file I/O.

Usage:
    from spatial_knowledge import search_spatial, extract_room_number
    result = search_spatial("where can I find room 202?")
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

_DATA_DIR = Path(__file__).resolve().parents[2] / "data" / "campus_spatial"

# Confidence below this is never presented as a confirmed fact — Section 6's
# "do not force confidence to 1.0" / "prefer 'I could not verify' over a
# guess" requirement, enforced at read time, not just at Phase 9 build time.
LOW_CONFIDENCE_THRESHOLD = 0.6

# ---------------------------------------------------------------------------
# Room-number extraction — works regardless of surrounding sentence
# structure, since real GAT room numbers are a simple, structured pattern
# (2-4 digits, optional single letter suffix like "203A"). Handles: "room
# 202", "room no 202", "room number 202", "room #202", "202 room" (rare but
# harmless to support), and "no. 202".
# ---------------------------------------------------------------------------
_ROOM_NUMBER_PATTERN = re.compile(
    r"\broom\s*(?:no\.?|number|#)?\s*(\d{2,4}[a-z]?)\b"
    r"|\b(\d{2,4}[a-z]?)\s*room\b"
    r"|\bno\.?\s*(\d{2,4}[a-z]?)\b",
    re.IGNORECASE,
)

# Generic words that carry no distinguishing meaning for name-matching —
# excluded so "where is the CSE department" reduces to the single
# meaningful token {"cse"} rather than also requiring "department" itself
# to appear in the matched record's name.
_STOPWORDS = {
    "the",
    "a",
    "an",
    "is",
    "are",
    "where",
    "find",
    "tell",
    "me",
    "about",
    "show",
    "which",
    "floor",
    "located",
    "location",
    "of",
    "department",
    "dept",
    "for",
    "and",
    "in",
    "on",
    "at",
    "to",
    "i",
    "can",
    "could",
    "please",
    "what",
    "lab",
    "laboratory",
    "room",
    "number",
    "no",
}


def _significant_tokens(text: str) -> set[str]:
    tokens = re.findall(r"[a-z0-9]+", text.lower())
    return {t for t in tokens if t not in _STOPWORDS and len(t) >= 3}


# A narrower, standalone-number fallback — only meant to be tried by a
# caller that has ALREADY established (via its own sentence-level pattern,
# e.g. "where can I find X" / "which floor is X on") that the query is a
# location lookup, so a bare 2-4 digit token is a safe room-number guess in
# that context. Never used as the first attempt, to avoid misreading a bare
# number in an unrelated sentence ("in 2024", "50 seats") as a room number.
_BARE_NUMBER_PATTERN = re.compile(r"\b(\d{3}[a-z]?)\b", re.IGNORECASE)


def extract_room_number(text: str, *, allow_bare_number: bool = False) -> str | None:
    """query text -> normalized room number ('202', '203A', ...) or None.
    Deliberately regex-based (not ML): room numbers are a small, rigid
    surface pattern, and a hand-checkable rule here is more trustworthy
    than a learned extractor would be for something this structured."""
    m = _ROOM_NUMBER_PATTERN.search(text)
    if m:
        group = next(g for g in m.groups() if g)
        return group.upper()
    if allow_bare_number:
        m = _BARE_NUMBER_PATTERN.search(text)
        if m:
            return m.group(1).upper()
    return None


# ---------------------------------------------------------------------------
# Data loading (singleton)
# ---------------------------------------------------------------------------


class SpatialKnowledgeBase:
    def __init__(self) -> None:
        self.rooms: list[dict[str, Any]] = self._load("room_locations.json")
        self.departments: list[dict[str, Any]] = self._load("department_locations.json")
        self.laboratories: list[dict[str, Any]] = self._load("laboratory_locations.json")
        self.facilities: list[dict[str, Any]] = self._load("facility_locations.json")
        self.landmarks: list[dict[str, Any]] = self._load("landmarks.json")
        self.room_validation: list[dict[str, Any]] = self._load("room_validation.json")

        self._rooms_by_number: dict[str, dict[str, Any]] = {}
        for r in self.rooms:
            number = r.get("room_number")
            if number:
                self._rooms_by_number.setdefault(str(number).upper(), r)

        self._validation_by_number = {
            str(v["room_number"]).upper(): v for v in self.room_validation
        }

    @staticmethod
    def _load(filename: str) -> list[dict[str, Any]]:
        path = _DATA_DIR / filename
        if not path.exists():
            return []
        return json.loads(path.read_text(encoding="utf-8"))

    def room_by_number(self, room_number: str) -> dict[str, Any] | None:
        return self._rooms_by_number.get(room_number.upper())

    def validation_for(self, room_number: str) -> dict[str, Any] | None:
        return self._validation_by_number.get(room_number.upper())

    def search_by_name(self, query: str) -> dict[str, list[dict[str, Any]]]:
        """Token-overlap search over department/lab/facility/landmark names
        — for queries like 'where is the CSE department' or 'where is the
        Power System Simulation Lab' that name an entity rather than a room
        number. Only meaningful (non-generic, 3+ char) tokens are compared,
        so "where is the CSE department" matches a name containing "CSE"
        without requiring the whole phrase "cse department" to appear
        verbatim in either string. Room entries are matched by NAME only
        (not by their `department` metadata field) — otherwise every room
        that happens to belong to, say, CSE would falsely show up as a
        match for "where is the CSE department"."""
        q_tokens = _significant_tokens(query)

        def _matches(entry: dict[str, Any]) -> bool:
            # Name-only matching, deliberately NOT falling back to the
            # `department` metadata field: matching by department would
            # pull in every room/lab that merely *belongs to* CSE (e.g.
            # "Ivan Sutherland Lab") for a query asking specifically where
            # the CSE department itself is — too broad to be useful.
            name_tokens = _significant_tokens(entry.get("name") or "")
            return bool(name_tokens & q_tokens)

        return {
            "departments": [e for e in self.departments if _matches(e)],
            "laboratories": [e for e in self.laboratories if _matches(e)],
            "facilities": [e for e in self.facilities if _matches(e)],
            "landmarks": [e for e in self.landmarks if _matches(e)],
            "rooms": [e for e in self.rooms if _matches(e)],
        }


_singleton: SpatialKnowledgeBase | None = None


def get_spatial_kb() -> SpatialKnowledgeBase:
    global _singleton
    if _singleton is None:
        _singleton = SpatialKnowledgeBase()
    return _singleton


# ---------------------------------------------------------------------------
# Public search entry point + answer formatting
# ---------------------------------------------------------------------------

_FLOOR_LABELS = {
    "entrance": "the entrance area",
    "ground-floor": "the Ground Floor",
    "first-floor": "the First Floor",
    "second-floor": "the Second Floor",
    "third-floor": "the Third Floor",
}


def _floor_label(floor_slug: str | None) -> str:
    if not floor_slug:
        return "an unspecified floor"
    return _FLOOR_LABELS.get(floor_slug, floor_slug.replace("-", " ").title())


def search_spatial(query: str) -> dict[str, Any]:
    """query -> a typed result dict. Never guesses: every branch either
    returns a real, evidence-backed record or an explicit not_found/
    low_confidence/ambiguous status.

    Returns:
        {"status": "resolved", "entity_type": ..., "record": {...}}
        {"status": "low_confidence", "entity_type": ..., "record": {...}}
        {"status": "not_found_confirmed", "room_number": "301", "note": ...}
        {"status": "ambiguous", "matches": [...]}
        {"status": "not_found"}
    """
    kb = get_spatial_kb()

    room_number = extract_room_number(query) or extract_room_number(query, allow_bare_number=True)
    if room_number:
        record = kb.room_by_number(room_number)
        if record is not None:
            if record["confidence"] < LOW_CONFIDENCE_THRESHOLD or record.get("needs_review"):
                return {"status": "low_confidence", "entity_type": "room", "record": record}
            return {"status": "resolved", "entity_type": "room", "record": record}

        validation = kb.validation_for(room_number)
        if validation is not None and validation["status"] == "NOT_FOUND":
            return {
                "status": "not_found_confirmed",
                "room_number": room_number,
                "note": validation.get("note", ""),
            }
        return {"status": "not_found", "room_number": room_number}

    matches = kb.search_by_name(query)
    all_matches = [(etype, e) for etype, entries in matches.items() for e in entries]

    # Collapse records that describe the SAME real-world evidence — either
    # the exact same source panorama (Phase 9 sometimes files one photo's
    # evidence under both a "room" and a "department" record, e.g. the CSE
    # HOD's office is both ROOM_201 and DEPT_CSE_FIRST_FLOOR_HOD, same
    # first-floor/05.jpg) or an identical `name` string. Prefer the more
    # specific record (has a room_number) and, failing that, the
    # higher-confidence one. Genuinely distinct locations (same department,
    # different panorama/room — e.g. CSE's HOD office AND its separate
    # staff room) are real, useful multi-location info and are preserved.
    by_name: dict[str, tuple[str, dict[str, Any]]] = {}
    for etype, e in all_matches:
        key = (e.get("panorama_file") or "").strip().lower() or (
            e.get("name") or ""
        ).strip().lower()
        existing = by_name.get(key)
        if existing is None:
            by_name[key] = (etype, e)
            continue
        _, existing_record = existing
        if e.get("room_number") and not existing_record.get("room_number"):
            by_name[key] = (etype, e)
        elif (
            bool(e.get("room_number")) == bool(existing_record.get("room_number"))
            and e["confidence"] > existing_record["confidence"]
        ):
            by_name[key] = (etype, e)
    all_matches = list(by_name.values())

    if not all_matches:
        return {"status": "not_found"}
    if len(all_matches) == 1:
        etype, record = all_matches[0]
        singular = etype[:-1] if etype.endswith("s") else etype
        if record["confidence"] < LOW_CONFIDENCE_THRESHOLD or record.get("needs_review"):
            return {"status": "low_confidence", "entity_type": singular, "record": record}
        return {"status": "resolved", "entity_type": singular, "record": record}
    # Multiple name matches naming the SAME underlying place (e.g. a
    # department appearing on two floors) are not a real ambiguity — surface
    # the highest-confidence one but note the others exist.
    all_matches.sort(key=lambda pair: pair[1]["confidence"], reverse=True)
    return {"status": "ambiguous", "matches": all_matches}


def format_spatial_answer(result: dict[str, Any]) -> tuple[str, float, str]:
    """result (from search_spatial) -> (answer_text, confidence, status_label).
    Confidence mirrors the underlying record's real confidence — never
    inflated to 1.0 for a low-confidence or unresolved record."""
    status = result["status"]

    if status == "resolved" or status == "low_confidence":
        r = result["record"]
        etype = result["entity_type"]
        name = r.get("name", "This location")
        floor = _floor_label(r.get("floor_slug"))
        sentence = f"{name} is located on {floor} of the Main Building."
        if etype == "room" and r.get("room_number"):
            sentence = (
                f"Room {r['room_number']} ({name}) is located on {floor} of the Main Building."
            )
        if r.get("department"):
            sentence += f" It is associated with the {r['department']} department."
        sentence += f" Evidence: {r['evidence']}"
        if status == "low_confidence":
            sentence = (
                "I found a possible match, but the supporting panorama evidence is not "
                f"fully certain (confidence {r['confidence']:.2f}). " + sentence
            )
        return sentence, r["confidence"], status

    if status == "not_found_confirmed":
        return (
            f"I couldn't verify the location of Room {result['room_number']} from the "
            "available campus panorama data. This room number does not appear in any of "
            "the reviewed panoramas, though that doesn't rule out it existing somewhere "
            "not yet photographed.",
            0.0,
            status,
        )

    if status == "not_found":
        room_number = result.get("room_number")
        if room_number:
            return (
                f"I couldn't verify the location of Room {room_number} from the available "
                "campus panorama data.",
                0.0,
                status,
            )
        return (
            "I couldn't find that location in the available campus spatial data.",
            0.0,
            status,
        )

    if status == "ambiguous":
        matches = result["matches"]
        # If every match shares the same dominant identifying token (e.g.
        # all are "cse"), this isn't a real disambiguation need — it's one
        # entity documented in multiple real locations. Report all of them
        # rather than asking the user to pick.
        token_sets = [_significant_tokens(r.get("name") or "") for _, r in matches]
        common = set.intersection(*token_sets) if token_sets else set()
        if common:
            lines = []
            for _, r in matches[:5]:
                floor = _floor_label(r.get("floor_slug"))
                where = f"Room {r['room_number']}, {floor}" if r.get("room_number") else floor
                lines.append(f"{r.get('name')} ({where})")
            return (
                "This has more than one documented location on campus: " + "; ".join(lines) + ".",
                min(r["confidence"] for _, r in matches),
                status,
            )
        names = ", ".join(f"{r.get('name')} ({etype})" for etype, r in matches[:4])
        return (
            f"That could refer to more than one place on campus: {names}. Could you clarify "
            "which one you mean?",
            0.0,
            status,
        )

    return "I couldn't find that location in the available campus spatial data.", 0.0, status


if __name__ == "__main__":
    for demo_query in [
        "where is room 202?",
        "where can I find room no 303",
        "which floor is room 301 on?",
        "where is the CSE department?",
        "where is the power system simulation lab?",
    ]:
        result = search_spatial(demo_query)
        answer, confidence, status = format_spatial_answer(result)
        print(f"\n[{demo_query}] -> status={status} confidence={confidence}")
        print(f"  {answer}")
