from app.crud.base import CRUDBase
from app.models.node import Node
from app.schemas.node import NodeCreate, NodeUpdate


class CRUDNode(CRUDBase[Node, NodeCreate, NodeUpdate]):
    pass


node = CRUDNode(Node)
