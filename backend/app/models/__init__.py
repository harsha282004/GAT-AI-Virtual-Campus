"""Importing this package registers every model on app.db.base.Base's metadata —
required before Base.metadata is used (Alembic autogenerate, create_all, or any
relationship string-reference resolution)."""

from app.models.building import Building
from app.models.campus import Campus
from app.models.chat_session import ChatMessageRecord, ChatSession
from app.models.cross_floor_hotspot import CrossFloorHotspot
from app.models.document import Document, DocumentDomain
from app.models.edge import NON_ACCESSIBLE_EDGE_TYPES, Edge, EdgeDirection, EdgeType
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
    "EdgeDirection",
    "NON_ACCESSIBLE_EDGE_TYPES",
    "Panorama",
    "Document",
    "DocumentDomain",
    "CrossFloorHotspot",
    "ChatSession",
    "ChatMessageRecord",
]
