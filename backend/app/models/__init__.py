"""Importing this package registers every model on app.db.base.Base's metadata —
required before Base.metadata is used (Alembic autogenerate, create_all, or any
relationship string-reference resolution)."""

from app.models.building import Building
from app.models.campus import Campus
from app.models.document import Document, DocumentDomain
from app.models.edge import Edge, EdgeType
from app.models.floor import Floor
from app.models.node import Node, NodeType
from app.models.panorama import Panorama
from app.models.room import Room

__all__ = [
    "Campus",
    "Building",
    "Floor",
    "Room",
    "Node",
    "NodeType",
    "Edge",
    "EdgeType",
    "Panorama",
    "Document",
    "DocumentDomain",
]
