from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.edge import Edge
from app.navigation.pathfinding import AVERAGE_WALK_SPEED_MPS
from app.schemas.edge import EdgeCreate, EdgeUpdate


class CRUDEdge(CRUDBase[Edge, EdgeCreate, EdgeUpdate]):
    def create(self, db: Session, *, obj_in: EdgeCreate) -> Edge:
        data = obj_in.model_dump()
        if data.get("walking_time") is None:
            data["walking_time"] = data["distance"] / AVERAGE_WALK_SPEED_MPS / 60
        db_obj = self.model(**data)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj


edge = CRUDEdge(Edge)
