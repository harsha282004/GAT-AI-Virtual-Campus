"""Phase 6 — Campus tool adapter layer.

Thin, read-only adapters over the REAL existing backend navigation/data
layer (backend/app/navigation/, backend/app/models/) — no pathfinding
algorithm, database model, or search function is reimplemented here. Every
tool opens a short-lived DB session via campus_db.get_db_session(), calls
straight into the existing backend code, converts the result to a plain
JSON-safe dict, and closes the session.

Tools implemented (see docs/RAG_ARCHITECTURE.md's Phase 6 section for the
full IMPLEMENTED / PARTIALLY IMPLEMENTED / NOT AVAILABLE breakdown):

- campus_lookup(query)      -> IMPLEMENTED (wraps search_buildings)
- room_lookup(query)        -> IMPLEMENTED (wraps search_rooms, +department fallback)
- navigation_tool(to, from) -> IMPLEMENTED (wraps build_graph/find_shortest_path/format_directions)
- panorama_lookup(query)    -> IMPLEMENTED (direct Panorama lookup + find_nearest_panorama fallback)
- hotspot_lookup(node_id)   -> IMPLEMENTED (direct CrossFloorHotspot query)
- contact_lookup(query)     -> NOT AVAILABLE (no structured contact table exists; the
                                existing Phase 1-4 RAG pipeline already answers contact
                                questions from real official GAT sources, better than any
                                DB-backed lookup this phase could add)

Every function returns a dict, never raises past its own boundary, and
never invents an entity, route, or field that the database doesn't
actually contain — an unresolved query returns a typed "not_found"/
"ambiguous" status, not a guess.
"""

from __future__ import annotations

import re
from typing import Any

# isort: off
# Bare import first, purely for its sys.path side effect (adds backend/ to
# sys.path) — must run before any `app.*` import below can resolve.
import campus_db  # noqa: F401

# isort: on

from _shared import configure_logging
from app.core.exceptions import AppError
from app.models.building import Building
from app.models.cross_floor_hotspot import CrossFloorHotspot
from app.models.node import Node
from app.models.panorama import Panorama
from app.models.room import Room
from app.navigation import (
    build_graph,
    find_nearest_panorama,
    find_shortest_path,
    format_directions,
    resolve_building_entrance_node,
    search_buildings,
    search_rooms,
)
from campus_db import get_db_session
from sqlalchemy.orm import Session

logger = configure_logging("campus_tools")


def _room_to_dict(room: Room) -> dict[str, Any]:
    return {
        "id": room.id,
        "name": room.name,
        "room_number": room.room_number,
        "room_type": room.room_type,
        "department": room.department,
        "floor_id": room.floor_id,
        "floor_name": room.floor.name if room.floor else None,
        "building_id": room.floor.building_id if room.floor else None,
        "building_name": room.floor.building.name if room.floor and room.floor.building else None,
        "node_id": room.node_id,
    }


def _building_to_dict(db: Session, building: Building) -> dict[str, Any]:
    entrance = resolve_building_entrance_node(db, building)
    return {
        "id": building.id,
        "name": building.name,
        "code": building.code,
        "campus_id": building.campus_id,
        "entrance_node_id": entrance.id if entrance else None,
    }


def _panorama_to_dict(panorama: Panorama) -> dict[str, Any]:
    return {
        "id": panorama.id,
        "node_id": panorama.node_id,
        "title": panorama.title,
        "image_path": panorama.image_path,
        "is_placeholder": panorama.is_placeholder,
    }


# ---- campus_lookup ----
def campus_lookup(query: str, *, limit: int = 10) -> dict[str, Any]:
    """Search buildings/campus landmarks by name or code."""
    try:
        with get_db_session() as db:
            buildings = search_buildings(db, query, limit=limit)
            matches = [_building_to_dict(db, b) for b in buildings]
    except Exception as exc:  # noqa: BLE001 — tool boundary, never crash the caller
        logger.error("campus_lookup failed for %r: %s", query, exc)
        return {"tool": "campus_lookup", "status": "tool_error", "error": str(exc), "matches": []}

    status = "resolved" if len(matches) == 1 else "ambiguous" if matches else "not_found"
    return {"tool": "campus_lookup", "status": status, "query": query, "matches": matches}


# ---- room_lookup ----
def room_lookup(query: str, *, limit: int = 10) -> dict[str, Any]:
    """Search rooms by name/room number (search_rooms, unmodified); if that
    finds nothing, additionally tries an ILIKE match on Room.department —
    search_rooms itself does not search that column (confirmed by reading
    backend/app/navigation/room_search.py), so this is a small, clearly
    documented addition living entirely in this new file, not a change to
    any existing backend module."""
    try:
        with get_db_session() as db:
            rooms = search_rooms(db, query, limit=limit)
            used_department_fallback = False
            if not rooms:
                rooms = (
                    db.query(Room).filter(Room.department.ilike(f"%{query}%")).limit(limit).all()
                )
                used_department_fallback = bool(rooms)
            matches = [_room_to_dict(r) for r in rooms]
    except Exception as exc:  # noqa: BLE001
        logger.error("room_lookup failed for %r: %s", query, exc)
        return {"tool": "room_lookup", "status": "tool_error", "error": str(exc), "matches": []}

    status = "resolved" if len(matches) == 1 else "ambiguous" if matches else "not_found"
    return {
        "tool": "room_lookup",
        "status": status,
        "query": query,
        "matches": matches,
        "used_department_fallback": used_department_fallback,
    }


# Tier 1 — true filler words: NEVER part of a real campus entity's name,
# always safe to strip from the whole phrase at once (so "the main
# building" -> "main building", still searched as one phrase, still
# matches Building.name == "Main Building" correctly).
_FILLER_WORDS = {"the", "a", "an", "of", "is", "where", "please", "tell", "me", "about", "show"}

# Tier 2 — generic campus-noun words that CAN legitimately be part of a
# real name ("Main Building", "CSE Seminar Hall", "Server Room") and so
# must never be stripped while still forming a multi-word phrase (that
# would turn "main building" into the far-too-generic "main" and risk
# matching something unrelated, e.g. "Main Auditorium Hall"). Only used to
# filter individual words in the last-resort single-word fallback below.
_GENERIC_ENTITY_WORDS = {
    "department",
    "block",
    "building",
    "room",
    "floor",
    "office",
    "hall",
    "campus",
}


def _search_candidates(db: Session, query: str) -> list[dict[str, Any]]:
    rooms = search_rooms(db, query, limit=5)
    buildings = search_buildings(db, query, limit=5)
    candidates: list[dict[str, Any]] = []
    for r in rooms:
        candidates.append({"entity_type": "room", "node_id": r.node_id, "name": r.name, "id": r.id})
    for b in buildings:
        entrance = resolve_building_entrance_node(db, b)
        candidates.append(
            {
                "entity_type": "building",
                "node_id": entrance.id if entrance else None,
                "name": b.name,
                "id": b.id,
            }
        )
    return candidates


def _resolve_single_location(db: Session, query: str) -> dict[str, Any]:
    """Shared resolver used by navigation_tool/panorama_lookup: try rooms
    first, then buildings (both ILIKE substring matches, unmodified from
    the existing search_rooms/search_buildings), and only succeed when
    exactly one navigable match exists across both. If the full phrase
    matches nothing, retries with each individual non-generic word (e.g.
    "CSE department" -> retry with "CSE") — still plain ILIKE substring
    matching against real columns, not fuzzy/semantic matching, and never
    a guess: 'resolved' only ever means an exact database match. Returns a
    dict with status resolved/ambiguous/not_found/no_node.

    Three-stage fallback, each only tried if the previous stage found
    nothing, in order of decreasing specificity:
    1. The full original phrase.
    2. The phrase with only true filler words removed, still searched as
       ONE phrase — e.g. "the main building" -> "main building" (matches
       Building.name == "Main Building" correctly; critically, "building"
       itself is NOT stripped here, or this would collapse to the far too
       generic "main" and could match an unrelated entity).
    3. Individual significant words (excluding both filler AND generic
       entity words like "department"/"room") tried one at a time — e.g.
       "CSE department" -> "CSE" (matches "CSE Block").
    """
    candidates = _search_candidates(db, query)

    if not candidates:
        stripped = re.sub(
            r"\b(" + "|".join(_FILLER_WORDS) + r")\b", " ", query, flags=re.IGNORECASE
        )
        stripped = re.sub(r"\s+", " ", stripped).strip()
        if stripped and stripped.lower() != query.strip().lower():
            candidates = _search_candidates(db, stripped)

    if not candidates:
        excluded = _FILLER_WORDS | _GENERIC_ENTITY_WORDS
        words = [
            w
            for w in re.findall(r"[A-Za-z0-9]+", query)
            if len(w) > 1 and w.lower() not in excluded
        ]
        for word in words:
            candidates = _search_candidates(db, word)
            if candidates:
                break

    navigable = [c for c in candidates if c["node_id"] is not None]
    if not candidates:
        return {"status": "not_found", "candidates": []}
    if not navigable:
        return {"status": "no_node", "candidates": candidates}
    if len(navigable) > 1:
        return {"status": "ambiguous", "candidates": navigable}
    return {"status": "resolved", **navigable[0]}


def resolve_location(query: str) -> dict[str, Any]:
    """Public location-only lookup (no route) — for "where is X" style
    queries. Returns full entity detail (building/floor for a room, entrance
    node for a building) on a single match, or the same ambiguous/not_found
    statuses as every other tool here."""
    try:
        with get_db_session() as db:
            result = _resolve_single_location(db, query)
            if result["status"] != "resolved":
                return {
                    "tool": "campus_lookup",
                    "status": result["status"],
                    "query": query,
                    "candidates": result.get("candidates", []),
                }
            if result["entity_type"] == "room":
                room = db.get(Room, result["id"])
                detail = _room_to_dict(room) if room else {}
            else:
                building = db.get(Building, result["id"])
                detail = _building_to_dict(db, building) if building else {}
            return {
                "tool": "campus_lookup",
                "status": "resolved",
                "query": query,
                "entity_type": result["entity_type"],
                "detail": detail,
            }
    except Exception as exc:  # noqa: BLE001
        logger.error("resolve_location failed for %r: %s", query, exc)
        return {"tool": "campus_lookup", "status": "tool_error", "error": str(exc)}


# ---- navigation_tool ----
def navigation_tool(
    to_query: str,
    from_query: str | None = None,
    *,
    from_node_id: int | None = None,
    accessible: bool = False,
) -> dict[str, Any]:
    """Resolves `to_query` (and `from_query`/`from_node_id`, defaulting to
    the campus Main Gate node when neither is given — a real node in the
    seeded navigation graph, not an invented default) to node IDs, then
    calls the existing build_graph/find_shortest_path/format_directions
    exactly as backend/app/api/v1/navigation.py does. Also resolves which
    scenes along the path already have a panorama, tying navigation and
    panorama lookup together per Phase 6's requirement — using only
    existing Panorama rows, never inventing one."""
    try:
        with get_db_session() as db:
            to_resolution = _resolve_single_location(db, to_query)
            if to_resolution["status"] != "resolved":
                return {
                    "tool": "navigation_tool",
                    "status": f"destination_{to_resolution['status']}",
                    "to_query": to_query,
                    "candidates": to_resolution.get("candidates", []),
                }

            if from_node_id is not None:
                from_id = from_node_id
                from_label = f"node #{from_node_id}"
            elif from_query:
                from_resolution = _resolve_single_location(db, from_query)
                if from_resolution["status"] != "resolved":
                    return {
                        "tool": "navigation_tool",
                        "status": f"origin_{from_resolution['status']}",
                        "from_query": from_query,
                        "candidates": from_resolution.get("candidates", []),
                    }
                from_id = from_resolution["node_id"]
                from_label = from_resolution["name"]
            else:
                main_gate = db.query(Node).filter(Node.name.ilike("%main gate%")).first()
                if main_gate is None:
                    return {
                        "tool": "navigation_tool",
                        "status": "missing_start_location",
                        "note": "No start location was given and no default campus "
                        "entrance node ('Main Gate') exists to fall back to.",
                    }
                from_id = main_gate.id
                from_label = f"{main_gate.name} (default starting point)"

            graph = build_graph(db, accessible_only=accessible)
            path = find_shortest_path(graph, from_id, to_resolution["node_id"])
            steps = format_directions(path, graph.nodes_by_id)

            panoramas = (
                db.query(Panorama).filter(Panorama.node_id.in_(path.node_ids)).all()
                if path.node_ids
                else []
            )
            panorama_by_node = {p.node_id: _panorama_to_dict(p) for p in panoramas}
            panorama_sequence = [
                panorama_by_node[node_id]
                for node_id in path.node_ids
                if node_id in panorama_by_node
            ]

            return {
                "tool": "navigation_tool",
                "status": "route_found",
                "from_node_id": from_id,
                "from_label": from_label,
                "to_node_id": to_resolution["node_id"],
                "to_label": to_resolution["name"],
                "total_distance": path.total_distance,
                "estimated_walk_time_minutes": path.estimated_walk_time_minutes,
                "is_accessible": path.is_accessible,
                "turn_by_turn": [step.instruction for step in steps],
                "panorama_sequence": panorama_sequence,
            }
    except AppError as exc:
        return {"tool": "navigation_tool", "status": "no_path_found", "error": exc.message}
    except Exception as exc:  # noqa: BLE001
        logger.error("navigation_tool failed for %r -> %r: %s", from_query, to_query, exc)
        return {"tool": "navigation_tool", "status": "tool_error", "error": str(exc)}


# ---- panorama_lookup ----
def panorama_lookup(query: str | None = None, *, node_id: int | None = None) -> dict[str, Any]:
    """Given a location query or a known node_id, returns the panorama
    directly on that node if one exists, otherwise the nearest reachable
    panorama campus-wide (find_nearest_panorama, unmodified)."""
    try:
        with get_db_session() as db:
            resolved_node_id = node_id
            resolved_label = None
            if resolved_node_id is None:
                if not query:
                    return {"tool": "panorama_lookup", "status": "missing_query"}
                resolution = _resolve_single_location(db, query)
                if resolution["status"] != "resolved":
                    return {
                        "tool": "panorama_lookup",
                        "status": resolution["status"],
                        "query": query,
                        "candidates": resolution.get("candidates", []),
                    }
                resolved_node_id = resolution["node_id"]
                resolved_label = resolution["name"]

            direct = db.query(Panorama).filter(Panorama.node_id == resolved_node_id).first()
            if direct is not None:
                return {
                    "tool": "panorama_lookup",
                    "status": "panorama_found",
                    "node_id": resolved_node_id,
                    "label": resolved_label,
                    "panorama": _panorama_to_dict(direct),
                }

            graph = build_graph(db, accessible_only=False)
            nearest = find_nearest_panorama(db, graph, resolved_node_id)
            if nearest is None:
                return {
                    "tool": "panorama_lookup",
                    "status": "no_panorama_available",
                    "node_id": resolved_node_id,
                    "label": resolved_label,
                }
            panorama, distance = nearest
            return {
                "tool": "panorama_lookup",
                "status": "nearest_panorama_found",
                "node_id": resolved_node_id,
                "label": resolved_label,
                "panorama": _panorama_to_dict(panorama),
                "distance": distance,
            }
    except AppError as exc:
        return {"tool": "panorama_lookup", "status": "tool_error", "error": exc.message}
    except Exception as exc:  # noqa: BLE001
        logger.error("panorama_lookup failed for %r: %s", query, exc)
        return {"tool": "panorama_lookup", "status": "tool_error", "error": str(exc)}


# ---- hotspot_lookup ----
def hotspot_lookup(node_id: int) -> dict[str, Any]:
    """Cross-floor hotspots authored on this exact node's panorama (per
    CrossFloorHotspot's own design: rendering is source-node-exact, no
    propagation) — purely informational, not part of the pathfinding
    graph."""
    try:
        with get_db_session() as db:
            hotspots = (
                db.query(CrossFloorHotspot)
                .filter(CrossFloorHotspot.source_node_id == node_id)
                .all()
            )
            matches = [
                {
                    "id": h.id,
                    "target_node_id": h.target_node_id,
                    "target_node_name": h.target_node.name if h.target_node else None,
                    "yaw": h.yaw,
                    "pitch": h.pitch,
                    "label": h.label,
                }
                for h in hotspots
            ]
    except Exception as exc:  # noqa: BLE001
        logger.error("hotspot_lookup failed for node_id=%r: %s", node_id, exc)
        return {"tool": "hotspot_lookup", "status": "tool_error", "error": str(exc), "matches": []}

    return {
        "tool": "hotspot_lookup",
        "status": "resolved" if matches else "no_hotspots",
        "node_id": node_id,
        "matches": matches,
    }


# ---- contact_lookup ----
def contact_lookup(query: str | None = None) -> dict[str, Any]:
    """NOT AVAILABLE. No structured contact/office table exists in the
    backend schema (no phone/email/office-hours model anywhere in
    backend/app/models/). Real official contact information (phone,
    email, address) already comes from the Phase 1-4 RAG pipeline, sourced
    from the actual gat.ac.in website/PDFs — adding a duplicate,
    lower-quality DB-backed contact tool here would contradict the
    'reuse existing services, do not duplicate' instruction rather than
    honor it."""
    return {
        "tool": "contact_lookup",
        "status": "not_available",
        "query": query,
        "note": (
            "No structured contact/office table exists in the backend schema. "
            "Contact questions are answered by the existing Phase 1-4 RAG pipeline "
            "(general_agent), which retrieves real official contact details from the "
            "gat.ac.in knowledge base instead."
        ),
    }
