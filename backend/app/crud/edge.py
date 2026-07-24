from app.crud.base import CRUDBase
from app.models.edge import Edge
from app.schemas.edge import EdgeCreate, EdgeUpdate


class CRUDEdge(CRUDBase[Edge, EdgeCreate, EdgeUpdate]):
    pass


edge = CRUDEdge(Edge)
