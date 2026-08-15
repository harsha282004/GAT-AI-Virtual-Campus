"""visibility zones

Revision ID: 23a9cc4bd6dc
Revises: d2bfbfccc774
Create Date: 2026-08-02 10:15:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "23a9cc4bd6dc"
down_revision: Union[str, Sequence[str], None] = "d2bfbfccc774"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "visibility_zones",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )

    op.create_table(
        "node_visibility_zones",
        sa.Column("zone_id", sa.Integer(), nullable=False),
        sa.Column("node_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["zone_id"], ["visibility_zones.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["node_id"], ["nodes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("zone_id", "node_id"),
    )
    op.create_index(
        op.f("ix_node_visibility_zones_node_id"),
        "node_visibility_zones",
        ["node_id"],
        unique=False,
    )

    op.add_column(
        "cross_floor_hotspots",
        sa.Column("visibility_zone_id", sa.Integer(), nullable=True),
    )

    # Backfill: one zone per distinct source_node_id already used by an
    # existing hotspot (every current hotspot keeps exactly the visibility
    # it already had — visible only from the scene it was authored on — and
    # hotspots that share a source scene now share one zone instead of each
    # maintaining an identical private copy of the same single-node list).
    op.execute(
        "INSERT INTO visibility_zones (name, created_at, updated_at) "
        "SELECT 'Auto Zone (Node ' || source_node_id || ')', now(), now() "
        "FROM (SELECT DISTINCT source_node_id FROM cross_floor_hotspots) s"
    )
    op.execute(
        "INSERT INTO node_visibility_zones (zone_id, node_id) "
        "SELECT z.id, s.source_node_id "
        "FROM visibility_zones z "
        "JOIN (SELECT DISTINCT source_node_id FROM cross_floor_hotspots) s "
        "ON z.name = 'Auto Zone (Node ' || s.source_node_id || ')'"
    )
    op.execute(
        "UPDATE cross_floor_hotspots h "
        "SET visibility_zone_id = z.id "
        "FROM visibility_zones z "
        "WHERE z.name = 'Auto Zone (Node ' || h.source_node_id || ')'"
    )

    op.alter_column("cross_floor_hotspots", "visibility_zone_id", nullable=False)
    op.create_foreign_key(
        "cross_floor_hotspots_visibility_zone_id_fkey",
        "cross_floor_hotspots",
        "visibility_zones",
        ["visibility_zone_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index(
        op.f("ix_cross_floor_hotspots_visibility_zone_id"),
        "cross_floor_hotspots",
        ["visibility_zone_id"],
        unique=False,
    )

    # Superseded by visibility_zone_id + node_visibility_zones.
    op.drop_index(
        op.f("ix_cross_floor_hotspot_visibility_node_id"),
        table_name="cross_floor_hotspot_visibility",
    )
    op.drop_table("cross_floor_hotspot_visibility")


def downgrade() -> None:
    """Downgrade schema."""
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
    op.execute(
        "INSERT INTO cross_floor_hotspot_visibility (hotspot_id, node_id) "
        "SELECT h.id, nvz.node_id "
        "FROM cross_floor_hotspots h "
        "JOIN node_visibility_zones nvz ON nvz.zone_id = h.visibility_zone_id"
    )

    op.drop_index(
        op.f("ix_cross_floor_hotspots_visibility_zone_id"), table_name="cross_floor_hotspots"
    )
    op.drop_constraint(
        "cross_floor_hotspots_visibility_zone_id_fkey",
        "cross_floor_hotspots",
        type_="foreignkey",
    )
    op.drop_column("cross_floor_hotspots", "visibility_zone_id")

    op.drop_index(op.f("ix_node_visibility_zones_node_id"), table_name="node_visibility_zones")
    op.drop_table("node_visibility_zones")
    op.drop_table("visibility_zones")
