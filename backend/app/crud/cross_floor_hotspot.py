from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.cross_floor_hotspot import CrossFloorHotspot
from app.schemas.cross_floor_hotspot import CrossFloorHotspotCreate

CRUDBaseCrossFloor = CRUDBase[CrossFloorHotspot, CrossFloorHotspotCreate, CrossFloorHotspotCreate]


class CRUDCrossFloorHotspot(CRUDBaseCrossFloor):
    def get_multi(self, db: Session, *, skip: int = 0, limit: int = 100) -> list[CrossFloorHotspot]:
        """Always the full list, ignoring skip/limit entirely — an
        admin-managed dataset of at most a few hundred rows, where the base
        class's default page size silently dropped every hotspot created
        past the 100th (see incident: GET returned 100 rows while the table
        held 110, and newly created hotspots never rendered). The router
        layer (see build_crud_router's paginated=False) already drops
        skip/limit from this endpoint's signature; this override is the
        defense that holds even if it's ever called some other way."""
        return list(db.query(self.model).all())


cross_floor_hotspot = CRUDCrossFloorHotspot(CrossFloorHotspot)
