from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.building import Building


def search_buildings(db: Session, query: str, *, limit: int = 10) -> list[Building]:
    """Case-insensitive substring search over building name and code."""
    pattern = f"%{query.strip()}%"
    return list(
        db.query(Building)
        .filter(or_(Building.name.ilike(pattern), Building.code.ilike(pattern)))
        .order_by(Building.name)
        .limit(limit)
        .all()
    )
