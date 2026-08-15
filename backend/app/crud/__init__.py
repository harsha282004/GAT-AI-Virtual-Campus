from app.crud.building import building
from app.crud.campus import campus
from app.crud.cross_floor_hotspot import cross_floor_hotspot
from app.crud.document import document
from app.crud.edge import edge
from app.crud.floor import floor
from app.crud.node import node
from app.crud.panorama import panorama
from app.crud.room import room

__all__ = [
    "campus",
    "building",
    "floor",
    "room",
    "node",
    "edge",
    "panorama",
    "document",
    "cross_floor_hotspot",
]
