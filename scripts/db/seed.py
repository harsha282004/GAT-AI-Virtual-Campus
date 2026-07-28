"""Seed the database with sample GAT campus data for backend/navigation testing.

Usage (from repo root, after `alembic upgrade head`):
    python scripts/db/seed.py

Safe to re-run: exits early if a campus with the same name already exists,
rather than duplicating or deleting data.
"""

import json
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))

from app.db.session import SessionLocal  # noqa: E402
from app.models.building import Building  # noqa: E402
from app.models.campus import Campus  # noqa: E402
from app.models.document import Document, DocumentDomain  # noqa: E402
from app.models.edge import Edge, EdgeDirection, EdgeType  # noqa: E402
from app.models.floor import Floor  # noqa: E402
from app.models.node import Node, NodeType  # noqa: E402
from app.models.panorama import Panorama  # noqa: E402
from app.models.room import Room  # noqa: E402
from app.navigation.pathfinding import AVERAGE_WALK_SPEED_MPS  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(levelname)-8s %(message)s")
logger = logging.getLogger("seed")

CAMPUS_NAME = "Global Academy of Technology"

# Written by scripts/media/build_panoramas.py from the real source photos —
# run that script first (see docs/adding_real_photos.md) or this section is
# skipped with a warning rather than failing the whole seed.
MAIN_BUILDING_MANIFEST = (
    Path(__file__).resolve().parents[2]
    / "frontend"
    / "public"
    / "panoramas"
    / "main-building"
    / "manifest.json"
)

# No surveyed real-world distance exists between consecutive tour photos —
# this is a deliberate approximation (documented in docs/adding_real_photos.md)
# used only for walking-time estimates and A* tie-breaking, not shown to users
# as a precise figure.
SEQUENTIAL_STEP_DISTANCE_M = 4.0


def seed_main_building(db: Session, campus: Campus) -> None:
    """Seed the Main Building tour (real Insta360 photos) from the manifest
    produced by scripts/media/build_panoramas.py. Each floor's numbered
    photos become a sequential chain of Node+Panorama+Edge rows — no
    cross-floor connections are generated (see docs/adding_real_photos.md for
    how to add staircase/lift edges once you know which photo numbers they
    are)."""
    existing = (
        db.query(Building)
        .filter(Building.campus_id == campus.id, Building.name == "Main Building")
        .first()
    )
    if existing is not None:
        logger.info("'Main Building' already seeded (id=%s) — skipping.", existing.id)
        return

    if not MAIN_BUILDING_MANIFEST.is_file():
        logger.warning(
            "No manifest at %s — run `python scripts/media/build_panoramas.py` first "
            "to seed the Main Building tour. Skipping.",
            MAIN_BUILDING_MANIFEST,
        )
        return

    manifest = json.loads(MAIN_BUILDING_MANIFEST.read_text(encoding="utf-8"))

    building = Building(
        campus_id=campus.id,
        name="Main Building",
        code="MAIN",
        description="The main academic block — entrance plus four floors, real 360° photos.",
    )
    db.add(building)
    db.flush()

    for floor_data in manifest["floors"]:
        floor = Floor(building_id=building.id, level=floor_data["level"], name=floor_data["name"])
        db.add(floor)
        db.flush()

        scenes = sorted(floor_data["scenes"], key=lambda s: s["index"])
        nodes: list[Node] = []
        for position, scene in enumerate(scenes):
            is_first_entrance = floor_data["slug"] == "entrance" and position == 0
            node = Node(
                campus_id=campus.id,
                building_id=building.id,
                floor_id=floor.id,
                name=f"{floor_data['name']} — Scene {scene['index']:02d}",
                node_type=NodeType.ENTRANCE if is_first_entrance else NodeType.CORRIDOR,
                pos_x=float(position) * SEQUENTIAL_STEP_DISTANCE_M,
                pos_y=0.0,
            )
            db.add(node)
            nodes.append(node)
        db.flush()

        for node, scene in zip(nodes, scenes, strict=True):
            db.add(
                Panorama(
                    node_id=node.id,
                    image_path=scene["primary"],
                    title=node.name,
                    is_placeholder=False,
                    sequence_index=scene["index"],
                    initial_yaw=0.0,
                    initial_pitch=0.0,
                    hfov=110.0,
                )
            )

        for a, b in zip(nodes, nodes[1:], strict=False):
            walking_time = SEQUENTIAL_STEP_DISTANCE_M / AVERAGE_WALK_SPEED_MPS / 60
            db.add_all(
                [
                    Edge(
                        source_node_id=a.id,
                        target_node_id=b.id,
                        distance=SEQUENTIAL_STEP_DISTANCE_M,
                        is_bidirectional=False,
                        edge_type=EdgeType.CORRIDOR,
                        yaw=0.0,
                        walking_time=walking_time,
                        direction=EdgeDirection.FORWARD,
                        # entry_yaw/entry_pitch intentionally left unset here:
                        # app.api.v1.tour applies the forward/back default at
                        # read time until a real per-scene value is generated
                        # (see docs/adding_real_photos.md).
                    ),
                    Edge(
                        source_node_id=b.id,
                        target_node_id=a.id,
                        distance=SEQUENTIAL_STEP_DISTANCE_M,
                        is_bidirectional=False,
                        edge_type=EdgeType.CORRIDOR,
                        yaw=180.0,
                        walking_time=walking_time,
                        direction=EdgeDirection.BACK,
                    ),
                ]
            )

        logger.info("Seeded floor '%s' with %d scenes.", floor_data["name"], len(nodes))

    logger.info("Main Building seed complete: building_id=%s", building.id)


def seed(db: Session) -> None:
    existing = db.query(Campus).filter(Campus.name == CAMPUS_NAME).first()
    if existing is not None:
        logger.info(
            "Campus '%s' already exists (id=%s) — skipping base seed, "
            "still checking Main Building.",
            CAMPUS_NAME,
            existing.id,
        )
        seed_main_building(db, existing)
        db.commit()
        return

    campus = Campus(
        name=CAMPUS_NAME,
        description="Engineering college, VTU-affiliated, established 2001.",
        address="Rajarajeshwari Nagar, Bangalore",
    )
    db.add(campus)
    db.flush()

    # --- Buildings ---
    admin_block = Building(campus_id=campus.id, name="Admin Block", code="ADMIN")
    cse_block = Building(campus_id=campus.id, name="CSE Block", code="CSE")
    library = Building(campus_id=campus.id, name="Library", code="LIB")
    auditorium = Building(campus_id=campus.id, name="Auditorium", code="AUD")
    db.add_all([admin_block, cse_block, library, auditorium])
    db.flush()

    # --- Floors ---
    admin_ground = Floor(building_id=admin_block.id, level=0, name="Ground Floor")
    cse_ground = Floor(building_id=cse_block.id, level=0, name="Ground Floor")
    cse_first = Floor(building_id=cse_block.id, level=1, name="First Floor")
    library_ground = Floor(building_id=library.id, level=0, name="Ground Floor")
    auditorium_ground = Floor(building_id=auditorium.id, level=0, name="Ground Floor")
    db.add_all([admin_ground, cse_ground, cse_first, library_ground, auditorium_ground])
    db.flush()

    # --- Outdoor / campus-level nodes ---
    main_gate = Node(
        campus_id=campus.id, name="Main Gate", node_type=NodeType.OUTDOOR, pos_x=0, pos_y=0
    )
    central_junction = Node(
        campus_id=campus.id,
        name="Central Pathway Junction",
        node_type=NodeType.JUNCTION,
        pos_x=30,
        pos_y=0,
    )
    db.add_all([main_gate, central_junction])
    db.flush()

    # --- Building entrance nodes ---
    admin_entrance = Node(
        campus_id=campus.id,
        building_id=admin_block.id,
        name="Admin Block Entrance",
        node_type=NodeType.ENTRANCE,
        pos_x=30,
        pos_y=20,
    )
    cse_entrance = Node(
        campus_id=campus.id,
        building_id=cse_block.id,
        name="CSE Block Entrance",
        node_type=NodeType.ENTRANCE,
        pos_x=60,
        pos_y=0,
    )
    library_entrance = Node(
        campus_id=campus.id,
        building_id=library.id,
        name="Library Entrance",
        node_type=NodeType.ENTRANCE,
        pos_x=30,
        pos_y=-20,
    )
    auditorium_entrance = Node(
        campus_id=campus.id,
        building_id=auditorium.id,
        name="Auditorium Entrance",
        node_type=NodeType.ENTRANCE,
        pos_x=0,
        pos_y=-30,
    )
    db.add_all([admin_entrance, cse_entrance, library_entrance, auditorium_entrance])
    db.flush()

    # --- Admin Block indoor nodes + rooms ---
    admin_junction = Node(
        campus_id=campus.id,
        building_id=admin_block.id,
        floor_id=admin_ground.id,
        name="Admin Ground Junction",
        node_type=NodeType.JUNCTION,
    )
    principal_office_node = Node(
        campus_id=campus.id,
        building_id=admin_block.id,
        floor_id=admin_ground.id,
        name="Principal Office",
        node_type=NodeType.OFFICE,
    )
    accounts_office_node = Node(
        campus_id=campus.id,
        building_id=admin_block.id,
        floor_id=admin_ground.id,
        name="Accounts Office",
        node_type=NodeType.OFFICE,
    )
    db.add_all([admin_junction, principal_office_node, accounts_office_node])
    db.flush()

    db.add_all(
        [
            Room(
                floor_id=admin_ground.id,
                node_id=principal_office_node.id,
                name="Principal Office",
                room_number="A101",
                room_type="office",
                department="Administration",
            ),
            Room(
                floor_id=admin_ground.id,
                node_id=accounts_office_node.id,
                name="Accounts Office",
                room_number="A102",
                room_type="office",
                department="Administration",
            ),
        ]
    )

    # --- CSE Block indoor nodes + rooms (two floors, connected by stairs) ---
    cse_ground_junction = Node(
        campus_id=campus.id,
        building_id=cse_block.id,
        floor_id=cse_ground.id,
        name="CSE Ground Junction",
        node_type=NodeType.JUNCTION,
    )
    cse_ground_stair = Node(
        campus_id=campus.id,
        building_id=cse_block.id,
        floor_id=cse_ground.id,
        name="CSE Ground Staircase",
        node_type=NodeType.STAIRCASE,
    )
    reception_node = Node(
        campus_id=campus.id,
        building_id=cse_block.id,
        floor_id=cse_ground.id,
        name="Reception",
        node_type=NodeType.OFFICE,
    )
    staff_room_node = Node(
        campus_id=campus.id,
        building_id=cse_block.id,
        floor_id=cse_ground.id,
        name="Staff Room",
        node_type=NodeType.OFFICE,
    )
    cse_first_junction = Node(
        campus_id=campus.id,
        building_id=cse_block.id,
        floor_id=cse_first.id,
        name="CSE First Floor Junction",
        node_type=NodeType.JUNCTION,
    )
    cse_first_stair = Node(
        campus_id=campus.id,
        building_id=cse_block.id,
        floor_id=cse_first.id,
        name="CSE First Floor Staircase",
        node_type=NodeType.STAIRCASE,
    )
    seminar_hall_node = Node(
        campus_id=campus.id,
        building_id=cse_block.id,
        floor_id=cse_first.id,
        name="CSE Seminar Hall",
        node_type=NodeType.ROOM,
    )
    server_room_node = Node(
        campus_id=campus.id,
        building_id=cse_block.id,
        floor_id=cse_first.id,
        name="Server Room",
        node_type=NodeType.LAB,
    )
    room_101_node = Node(
        campus_id=campus.id,
        building_id=cse_block.id,
        floor_id=cse_first.id,
        name="Room 101",
        node_type=NodeType.CLASSROOM,
    )
    room_102_node = Node(
        campus_id=campus.id,
        building_id=cse_block.id,
        floor_id=cse_first.id,
        name="Room 102",
        node_type=NodeType.CLASSROOM,
    )
    db.add_all(
        [
            cse_ground_junction,
            cse_ground_stair,
            reception_node,
            staff_room_node,
            cse_first_junction,
            cse_first_stair,
            seminar_hall_node,
            server_room_node,
            room_101_node,
            room_102_node,
        ]
    )
    db.flush()

    db.add_all(
        [
            Room(
                floor_id=cse_ground.id,
                node_id=reception_node.id,
                name="Reception",
                room_number="C001",
                room_type="office",
                department="Computer Science & Engineering",
            ),
            Room(
                floor_id=cse_ground.id,
                node_id=staff_room_node.id,
                name="Staff Room",
                room_number="C002",
                room_type="office",
                department="Computer Science & Engineering",
            ),
            Room(
                floor_id=cse_first.id,
                node_id=seminar_hall_node.id,
                name="CSE Seminar Hall",
                room_number="C101",
                room_type="seminar_hall",
                department="Computer Science & Engineering",
                capacity=90,
            ),
            Room(
                floor_id=cse_first.id,
                node_id=server_room_node.id,
                name="Server Room",
                room_number="C102",
                room_type="lab",
                department="Computer Science & Engineering",
            ),
            Room(
                floor_id=cse_first.id,
                node_id=room_101_node.id,
                name="Room 101",
                room_number="C103",
                room_type="classroom",
                department="Computer Science & Engineering",
                capacity=60,
            ),
            Room(
                floor_id=cse_first.id,
                node_id=room_102_node.id,
                name="Room 102",
                room_number="C104",
                room_type="classroom",
                department="Computer Science & Engineering",
                capacity=60,
            ),
        ]
    )

    # --- Library indoor nodes + rooms ---
    library_junction = Node(
        campus_id=campus.id,
        building_id=library.id,
        floor_id=library_ground.id,
        name="Library Ground Junction",
        node_type=NodeType.JUNCTION,
    )
    reading_hall_node = Node(
        campus_id=campus.id,
        building_id=library.id,
        floor_id=library_ground.id,
        name="Reading Hall",
        node_type=NodeType.LIBRARY,
    )
    reference_section_node = Node(
        campus_id=campus.id,
        building_id=library.id,
        floor_id=library_ground.id,
        name="Reference Section",
        node_type=NodeType.LIBRARY,
    )
    db.add_all([library_junction, reading_hall_node, reference_section_node])
    db.flush()

    db.add_all(
        [
            Room(
                floor_id=library_ground.id,
                node_id=reading_hall_node.id,
                name="Reading Hall",
                room_number="L001",
                room_type="reading_hall",
                department="Library",
                capacity=150,
            ),
            Room(
                floor_id=library_ground.id,
                node_id=reference_section_node.id,
                name="Reference Section",
                room_number="L002",
                room_type="reading_hall",
                department="Library",
                capacity=40,
            ),
        ]
    )

    # --- Auditorium indoor node + room ---
    auditorium_junction = Node(
        campus_id=campus.id,
        building_id=auditorium.id,
        floor_id=auditorium_ground.id,
        name="Auditorium Ground Junction",
        node_type=NodeType.JUNCTION,
    )
    main_hall_node = Node(
        campus_id=campus.id,
        building_id=auditorium.id,
        floor_id=auditorium_ground.id,
        name="Main Auditorium Hall",
        node_type=NodeType.ROOM,
    )
    db.add_all([auditorium_junction, main_hall_node])
    db.flush()

    db.add(
        Room(
            floor_id=auditorium_ground.id,
            node_id=main_hall_node.id,
            name="Main Auditorium Hall",
            room_number="AUD001",
            room_type="auditorium",
            capacity=450,
        )
    )

    # --- Edges (the navigable campus graph) ---
    campus_edges = [
        Edge(
            source_node_id=main_gate.id,
            target_node_id=central_junction.id,
            distance=30,
            edge_type=EdgeType.OUTDOOR_PATH,
        ),
        Edge(
            source_node_id=central_junction.id,
            target_node_id=admin_entrance.id,
            distance=22,
            edge_type=EdgeType.OUTDOOR_PATH,
        ),
        Edge(
            source_node_id=central_junction.id,
            target_node_id=cse_entrance.id,
            distance=30,
            edge_type=EdgeType.OUTDOOR_PATH,
            direction=EdgeDirection.RIGHT,
        ),
        Edge(
            source_node_id=central_junction.id,
            target_node_id=library_entrance.id,
            distance=22,
            edge_type=EdgeType.OUTDOOR_PATH,
            direction=EdgeDirection.LEFT,
        ),
        Edge(
            source_node_id=central_junction.id,
            target_node_id=auditorium_entrance.id,
            distance=32,
            edge_type=EdgeType.OUTDOOR_PATH,
            direction=EdgeDirection.LEFT,
        ),
        # Admin block interior
        Edge(
            source_node_id=admin_entrance.id,
            target_node_id=admin_junction.id,
            distance=6,
            edge_type=EdgeType.CORRIDOR,
        ),
        Edge(
            source_node_id=admin_junction.id,
            target_node_id=principal_office_node.id,
            distance=8,
            edge_type=EdgeType.CORRIDOR,
            direction=EdgeDirection.RIGHT,
        ),
        Edge(
            source_node_id=admin_junction.id,
            target_node_id=accounts_office_node.id,
            distance=10,
            edge_type=EdgeType.CORRIDOR,
            direction=EdgeDirection.LEFT,
        ),
        # CSE block interior — ground floor
        Edge(
            source_node_id=cse_entrance.id,
            target_node_id=cse_ground_junction.id,
            distance=6,
            edge_type=EdgeType.CORRIDOR,
        ),
        Edge(
            source_node_id=cse_ground_junction.id,
            target_node_id=reception_node.id,
            distance=5,
            edge_type=EdgeType.CORRIDOR,
            direction=EdgeDirection.LEFT,
        ),
        Edge(
            source_node_id=cse_ground_junction.id,
            target_node_id=staff_room_node.id,
            distance=9,
            edge_type=EdgeType.CORRIDOR,
            direction=EdgeDirection.RIGHT,
        ),
        Edge(
            source_node_id=cse_ground_junction.id,
            target_node_id=cse_ground_stair.id,
            distance=7,
            edge_type=EdgeType.CORRIDOR,
        ),
        # CSE block interior — stairs between floors
        Edge(
            source_node_id=cse_ground_stair.id,
            target_node_id=cse_first_stair.id,
            distance=6,
            edge_type=EdgeType.STAIRS,
            direction=EdgeDirection.UP,
            floor_transition=True,
            accessible=False,
        ),
        # CSE block interior — first floor
        Edge(
            source_node_id=cse_first_stair.id,
            target_node_id=cse_first_junction.id,
            distance=5,
            edge_type=EdgeType.CORRIDOR,
        ),
        Edge(
            source_node_id=cse_first_junction.id,
            target_node_id=seminar_hall_node.id,
            distance=10,
            edge_type=EdgeType.CORRIDOR,
            direction=EdgeDirection.LEFT,
        ),
        Edge(
            source_node_id=cse_first_junction.id,
            target_node_id=server_room_node.id,
            distance=12,
            edge_type=EdgeType.CORRIDOR,
            direction=EdgeDirection.RIGHT,
        ),
        Edge(
            source_node_id=cse_first_junction.id,
            target_node_id=room_101_node.id,
            distance=8,
            edge_type=EdgeType.CORRIDOR,
            direction=EdgeDirection.LEFT,
        ),
        Edge(
            source_node_id=cse_first_junction.id,
            target_node_id=room_102_node.id,
            distance=9,
            edge_type=EdgeType.CORRIDOR,
            direction=EdgeDirection.RIGHT,
        ),
        # Library interior
        Edge(
            source_node_id=library_entrance.id,
            target_node_id=library_junction.id,
            distance=6,
            edge_type=EdgeType.CORRIDOR,
        ),
        Edge(
            source_node_id=library_junction.id,
            target_node_id=reading_hall_node.id,
            distance=10,
            edge_type=EdgeType.CORRIDOR,
        ),
        Edge(
            source_node_id=library_junction.id,
            target_node_id=reference_section_node.id,
            distance=12,
            edge_type=EdgeType.CORRIDOR,
            direction=EdgeDirection.RIGHT,
        ),
        # Auditorium interior
        Edge(
            source_node_id=auditorium_entrance.id,
            target_node_id=auditorium_junction.id,
            distance=5,
            edge_type=EdgeType.CORRIDOR,
        ),
        Edge(
            source_node_id=auditorium_junction.id,
            target_node_id=main_hall_node.id,
            distance=15,
            edge_type=EdgeType.CORRIDOR,
        ),
    ]
    for campus_edge in campus_edges:
        if campus_edge.walking_time in (None, 0):
            campus_edge.walking_time = campus_edge.distance / AVERAGE_WALK_SPEED_MPS / 60
    db.add_all(campus_edges)

    # --- Panoramas (placeholder — real Insta360 exports land in Phase 5) ---
    db.add_all(
        [
            Panorama(
                node_id=main_gate.id,
                image_path="panoramas/main_gate.jpg",
                title="Main Gate",
            ),
            Panorama(
                node_id=admin_entrance.id,
                image_path="panoramas/admin_block_entrance.jpg",
                title="Admin Block Entrance",
            ),
            Panorama(
                node_id=cse_entrance.id,
                image_path="panoramas/cse_block_entrance.jpg",
                title="CSE Block Entrance",
            ),
            Panorama(
                node_id=library_entrance.id,
                image_path="panoramas/library_entrance.jpg",
                title="Library Entrance",
            ),
            Panorama(
                node_id=auditorium_entrance.id,
                image_path="panoramas/auditorium_entrance.jpg",
                title="Auditorium Entrance",
            ),
        ]
    )

    # --- Documents (plain content store — no embeddings/RAG here) ---
    db.add_all(
        [
            Document(
                campus_id=campus.id,
                title="About GAT",
                domain=DocumentDomain.GENERAL,
                source="hand_authored",
                content=(
                    "Global Academy of Technology (GAT), established 2001, is a ~10-acre "
                    "VTU-affiliated engineering college in Rajarajeshwari Nagar, Bangalore. "
                    "NAAC A grade, AICTE approved."
                ),
            ),
            Document(
                campus_id=campus.id,
                title="Admission Process",
                domain=DocumentDomain.ADMISSIONS,
                source="hand_authored",
                content=(
                    "Admission to GAT is through KCET, COMEDK, PGCET, GATE, and KMAT "
                    "depending on the program (BE/MTech/MSc/MBA)."
                ),
            ),
            Document(
                campus_id=campus.id,
                title="Departments",
                domain=DocumentDomain.ACADEMICS,
                source="hand_authored",
                content="GAT offers programs in CSE, ISE, ECE, EEE, ME, and CE.",
            ),
            Document(
                campus_id=campus.id,
                title="Campus Facilities",
                domain=DocumentDomain.FACILITIES,
                source="hand_authored",
                content=(
                    "Facilities include a hostel with separate boys/girls blocks, a "
                    "450-seat auditorium, and 2 seminar halls with 90+ seats each."
                ),
            ),
            Document(
                campus_id=campus.id,
                title="Getting Around Campus",
                domain=DocumentDomain.NAVIGATION,
                source="hand_authored",
                content=(
                    "The campus is organized around a central pathway connecting the "
                    "Admin Block, CSE Block, Library, and Auditorium, all reachable "
                    "from the Main Gate."
                ),
            ),
        ]
    )

    seed_main_building(db, campus)

    db.commit()
    logger.info("Seed complete: campus_id=%s", campus.id)


def main() -> None:
    db = SessionLocal()
    try:
        seed(db)
    finally:
        db.close()


if __name__ == "__main__":
    main()
