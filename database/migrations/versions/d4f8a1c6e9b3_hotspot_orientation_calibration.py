"""hotspot orientation calibration

Adds edges.entry_yaw/entry_pitch — the camera angle a scene should open with
when arrived at via that specific edge (Street View style: continue facing
the direction of travel, rather than always resetting to the panorama's own
static resting orientation). Nullable/additive.

Also backfills a value onto every already-seeded FORWARD/BACK edge, mirroring
the same "backfill data seeded before this migration existed" precedent as
6583b0cae50a — a fresh install seeds calibrated edges directly via
scripts/db/seed.py, so this UPDATE is a no-op there.

Revision ID: d4f8a1c6e9b3
Revises: c1a9f3e7b2d4
Create Date: 2026-07-27 09:40:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d4f8a1c6e9b3"
down_revision: Union[str, Sequence[str], None] = "c1a9f3e7b2d4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("edges", sa.Column("entry_yaw", sa.Float(), nullable=True))
    op.add_column("edges", sa.Column("entry_pitch", sa.Float(), nullable=True))

    # Default calibration: forward travel opens facing forward (0), backward
    # travel opens facing back the way you came (180). Both level (pitch 0).
    op.execute("UPDATE edges SET entry_yaw = 0, entry_pitch = 0 WHERE direction = 'FORWARD'")
    op.execute("UPDATE edges SET entry_yaw = 180, entry_pitch = 0 WHERE direction = 'BACK'")


def downgrade() -> None:
    op.drop_column("edges", "entry_pitch")
    op.drop_column("edges", "entry_yaw")
