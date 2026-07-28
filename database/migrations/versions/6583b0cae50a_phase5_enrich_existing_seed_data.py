"""phase5 enrich existing seed data

Backfills direction/department/richer node_type values onto the rows created
by the original Phase 2 seed script, matched by name (those rows predate this
phase's richer schema and all defaulted to FORWARD/NULL/generic types). A
fresh install seeds equally good data directly via scripts/db/seed.py, so
this migration is a no-op there — it only matters for a database that was
already seeded before this phase existed.

Revision ID: 6583b0cae50a
Revises: 94093853d903
Create Date: 2026-07-24 22:25:39.243632

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "6583b0cae50a"
down_revision: Union[str, Sequence[str], None] = "94093853d903"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# (source node name, target node name, direction)
EDGE_DIRECTIONS = [
    ("Central Pathway Junction", "CSE Block Entrance", "RIGHT"),
    ("Central Pathway Junction", "Library Entrance", "LEFT"),
    ("Central Pathway Junction", "Auditorium Entrance", "LEFT"),
    ("Admin Ground Junction", "Principal Office", "RIGHT"),
    ("Admin Ground Junction", "Accounts Office", "LEFT"),
    ("CSE Ground Junction", "Reception", "LEFT"),
    ("CSE Ground Junction", "Staff Room", "RIGHT"),
    ("CSE Ground Staircase", "CSE First Floor Staircase", "UP"),
    ("CSE First Floor Junction", "CSE Seminar Hall", "LEFT"),
    ("CSE First Floor Junction", "Server Room", "RIGHT"),
    ("CSE First Floor Junction", "Room 101", "LEFT"),
    ("CSE First Floor Junction", "Room 102", "RIGHT"),
    ("Library Ground Junction", "Reference Section", "RIGHT"),
]

# (room name, department)
ROOM_DEPARTMENTS = [
    ("Principal Office", "Administration"),
    ("Accounts Office", "Administration"),
    ("Reception", "Computer Science & Engineering"),
    ("Staff Room", "Computer Science & Engineering"),
    ("CSE Seminar Hall", "Computer Science & Engineering"),
    ("Server Room", "Computer Science & Engineering"),
    ("Room 101", "Computer Science & Engineering"),
    ("Room 102", "Computer Science & Engineering"),
    ("Reading Hall", "Library"),
    ("Reference Section", "Library"),
]

# (node name, node_type)
NODE_TYPES = [
    ("Principal Office", "OFFICE"),
    ("Accounts Office", "OFFICE"),
    ("Reception", "OFFICE"),
    ("Staff Room", "OFFICE"),
    ("Server Room", "LAB"),
    ("Room 101", "CLASSROOM"),
    ("Room 102", "CLASSROOM"),
    ("Reading Hall", "LIBRARY"),
    ("Reference Section", "LIBRARY"),
]


def upgrade() -> None:
    bind = op.get_bind()

    edge_stmt = sa.text("""
        UPDATE edges SET direction = CAST(:direction AS edge_direction)
        FROM nodes sn, nodes tn
        WHERE edges.source_node_id = sn.id
          AND edges.target_node_id = tn.id
          AND sn.name = :source_name
          AND tn.name = :target_name
        """)
    for source_name, target_name, direction in EDGE_DIRECTIONS:
        bind.execute(
            edge_stmt,
            {"direction": direction, "source_name": source_name, "target_name": target_name},
        )

    department_stmt = sa.text("UPDATE rooms SET department = :department WHERE name = :name")
    for room_name, department in ROOM_DEPARTMENTS:
        bind.execute(department_stmt, {"department": department, "name": room_name})

    node_type_stmt = sa.text(
        "UPDATE nodes SET node_type = CAST(:node_type AS node_type) WHERE name = :name"
    )
    for node_name, node_type in NODE_TYPES:
        bind.execute(node_type_stmt, {"node_type": node_type, "name": node_name})


def downgrade() -> None:
    """Data-only backfill — not meaningfully reversible without reintroducing
    the original placeholder values, which carry no information worth
    restoring."""
