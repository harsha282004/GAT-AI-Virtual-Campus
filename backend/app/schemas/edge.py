import datetime

from pydantic import BaseModel, ConfigDict

from app.models.edge import EdgeDirection, EdgeType


class EdgeBase(BaseModel):
    source_node_id: int
    target_node_id: int
    distance: float
    is_bidirectional: bool = True
    edge_type: EdgeType = EdgeType.CORRIDOR
    yaw: float | None = None
    walking_time: float | None = None
    direction: EdgeDirection = EdgeDirection.FORWARD
    floor_transition: bool = False
    accessible: bool = True


class EdgeCreate(EdgeBase):
    pass


class EdgeUpdate(BaseModel):
    source_node_id: int | None = None
    target_node_id: int | None = None
    distance: float | None = None
    is_bidirectional: bool | None = None
    edge_type: EdgeType | None = None
    yaw: float | None = None
    walking_time: float | None = None
    direction: EdgeDirection | None = None
    floor_transition: bool | None = None
    accessible: bool | None = None


class EdgeRead(EdgeBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    walking_time: float
    created_at: datetime.datetime
    updated_at: datetime.datetime
