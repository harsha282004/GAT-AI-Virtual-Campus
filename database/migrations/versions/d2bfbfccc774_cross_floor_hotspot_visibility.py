"""cross floor hotspot visibility

Revision ID: d2bfbfccc774
Revises: 940422ca5804
Create Date: 2026-08-01 23:49:04.579503

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "d2bfbfccc774"
down_revision: Union[str, Sequence[str], None] = "940422ca5804"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "cross_floor_hotspot_visibility",
        sa.Column("hotspot_id", sa.Integer(), nullable=False),
        sa.Column("node_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["hotspot_id"], ["cross_floor_hotspots.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["node_id"], ["nodes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("hotspot_id", "node_id"),
    )
    op.create_index(
        op.f("ix_cross_floor_hotspot_visibility_node_id"),
        "cross_floor_hotspot_visibility",
        ["node_id"],
        unique=False,
    )

    # Backfill: every existing hotspot keeps behaving exactly as it does
    # today (visible only from the scene it was authored on) until an admin
    # explicitly widens its visibility via the new "Visible From Scenes"
    # editor — no existing hotspot silently goes invisible or starts
    # appearing anywhere new because of this migration.
    op.execute(
        "INSERT INTO cross_floor_hotspot_visibility (hotspot_id, node_id) "
        "SELECT id, source_node_id FROM cross_floor_hotspots"
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(
        op.f("ix_cross_floor_hotspot_visibility_node_id"),
        table_name="cross_floor_hotspot_visibility",
    )
    op.drop_table("cross_floor_hotspot_visibility")
