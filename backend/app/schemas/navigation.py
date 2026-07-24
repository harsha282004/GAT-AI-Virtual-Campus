from pydantic import BaseModel

from app.models.edge import EdgeType


class RouteStep(BaseModel):
    instruction: str
    node_id: int
    node_name: str
    distance: float
    edge_type: EdgeType | None = None


class RouteResponse(BaseModel):
    path_node_ids: list[int]
    path_node_names: list[str]
    total_distance: float
    estimated_walk_time_minutes: float
    turn_by_turn: list[RouteStep]


class RoomMatch(BaseModel):
    id: int
    name: str
    room_number: str | None = None
    floor_id: int
    floor_name: str
    building_id: int
    building_name: str
    node_id: int | None = None


class RoomNavigationResponse(BaseModel):
    matches: list[RoomMatch]
    route: RouteResponse | None = None


class BuildingMatch(BaseModel):
    id: int
    name: str
    code: str | None = None
    campus_id: int
    entrance_node_id: int | None = None


class BuildingNavigationResponse(BaseModel):
    matches: list[BuildingMatch]
    route: RouteResponse | None = None
