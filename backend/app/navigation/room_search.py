from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.room import Room


def search_rooms(db: Session, query: str, *, limit: int = 10) -> list[Room]:
    """Case-insensitive substring search over room name and room number."""
    pattern = f"%{query.strip()}%"
    return list(
        db.query(Room)
        .filter(or_(Room.name.ilike(pattern), Room.room_number.ilike(pattern)))
        .order_by(Room.name)
        .limit(limit)
        .all()
    )
