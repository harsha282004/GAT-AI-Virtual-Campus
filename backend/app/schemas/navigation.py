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
    is_accessible: bool
    turn_by_turn: list[RouteStep]


class RoomMatch(BaseModel):
    id: int
    name: str
    room_number: str | None = None
    room_type: str
    department: str | None = None
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


class NearbyRoomMatch(BaseModel):
    id: int
    name: str
    room_number: str | None = None
    building_name: str
    floor_name: str
    distance: float
    walking_time_minutes: float


class NearbyRoomsResponse(BaseModel):
    origin_node_id: int
    rooms: list[NearbyRoomMatch]


class NearestPanoramaResponse(BaseModel):
    origin_node_id: int
    panorama_id: int | None
    panorama_node_id: int | None
    panorama_title: str | None
    image_path: str | None
    distance: float | None
