"""uncalibrate default entry orientation

The previous migration (d4f8a1c6e9b3) backfilled every FORWARD/BACK edge's
entry_yaw/entry_pitch with the forward=0/back=180 default — which made
"seeded default" and "deliberately calibrated via calibration mode"
indistinguishable in the database. Calibration mode (see
frontend/src/features/tour/CalibrationPanel.tsx) needs entry_yaw IS NULL to
mean "not yet calibrated" so it can show accurate status and fall back
correctly. This resets those columns to NULL; the same forward/back default
is now computed at read time (app/api/v1/tour.py::_effective_entry_orientation)
whenever a value is absent, so navigation orientation is unaffected — only
the "has a human confirmed this one" signal changes. Safe to run even though
no one has used calibration mode yet (nothing genuine is lost).

Revision ID: e7b2c4f8a1d5
Revises: d4f8a1c6e9b3
Create Date: 2026-07-28 10:15:00.000000

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e7b2c4f8a1d5"
down_revision: Union[str, Sequence[str], None] = "d4f8a1c6e9b3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("UPDATE edges SET entry_yaw = NULL, entry_pitch = NULL")


def downgrade() -> None:
    """Not meaningfully reversible — the pre-image (auto-seeded default vs a
    real calibration) is exactly the distinction this migration exists to
    stop conflating, so there is nothing to correctly restore."""
