from fastapi import APIRouter

from app.api.v1 import (
    buildings,
    campuses,
    documents,
    edges,
    floors,
    navigation,
    nodes,
    panoramas,
    rooms,
)

api_router = APIRouter()

api_router.include_router(campuses.router, prefix="/campuses", tags=["Campuses"])
api_router.include_router(buildings.router, prefix="/buildings", tags=["Buildings"])
api_router.include_router(floors.router, prefix="/floors", tags=["Floors"])
api_router.include_router(rooms.router, prefix="/rooms", tags=["Rooms"])
api_router.include_router(nodes.router, prefix="/nodes", tags=["Nodes"])
api_router.include_router(edges.router, prefix="/edges", tags=["Edges"])
api_router.include_router(panoramas.router, prefix="/panoramas", tags=["Panoramas"])
api_router.include_router(documents.router, prefix="/documents", tags=["Documents"])
api_router.include_router(navigation.router, prefix="/navigation", tags=["Navigation"])

__all__ = ["api_router"]
