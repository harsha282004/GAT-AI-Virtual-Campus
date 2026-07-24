from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Shared declarative base for all SQLAlchemy models."""


# Imported for its side effect: registers every model on Base.metadata so
# Alembic autogenerate, Base.metadata.create_all(), and relationship string
# references all see the full schema. Must stay after the Base definition above.
from app.models import *  # noqa: E402,F401,F403
