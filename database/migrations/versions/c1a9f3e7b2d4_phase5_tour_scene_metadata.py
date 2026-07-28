"""phase5 tour scene metadata

Adds nullable columns needed to drive the backend-backed tour viewer:
per-panorama sequence position/initial view, per-edge hotspot vertical angle
and an optional label override. All additive/nullable — no existing data is
affected, and rows outside a walkable sequence (e.g. the four already-seeded
placeholder buildings) simply leave these columns null.

Revision ID: c1a9f3e7b2d4
Revises: 6583b0cae50a
Create Date: 2026-07-26 14:10:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c1a9f3e7b2d4"
down_revision: Union[str, Sequence[str], None] = "6583b0cae50a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("panoramas", sa.Column("sequence_index", sa.Integer(), nullable=True))
    op.add_column("panoramas", sa.Column("initial_yaw", sa.Float(), nullable=True))
    op.add_column("panoramas", sa.Column("initial_pitch", sa.Float(), nullable=True))
    op.add_column("panoramas", sa.Column("hfov", sa.Float(), nullable=True, server_default="110"))
    op.add_column("panoramas", sa.Column("description", sa.Text(), nullable=True))
    op.alter_column("panoramas", "hfov", server_default=None)

    op.add_column(
        "edges", sa.Column("hotspot_pitch", sa.Float(), nullable=True, server_default="0")
    )
    op.alter_column("edges", "hotspot_pitch", server_default=None)
    op.add_column("edges", sa.Column("label_override", sa.String(length=150), nullable=True))


def downgrade() -> None:
    op.drop_column("edges", "label_override")
    op.drop_column("edges", "hotspot_pitch")
    op.drop_column("panoramas", "description")
    op.drop_column("panoramas", "hfov")
    op.drop_column("panoramas", "initial_pitch")
    op.drop_column("panoramas", "initial_yaw")
    op.drop_column("panoramas", "sequence_index")
