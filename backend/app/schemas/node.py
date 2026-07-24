import datetime

from pydantic import BaseModel, ConfigDict

from app.models.node import NodeType


class NodeBase(BaseModel):
    campus_id: int
    building_id: int | None = None
    floor_id: int | None = None
    name: str
    node_type: NodeType = NodeType.JUNCTION
    pos_x: float | None = None
    pos_y: float | None = None
    latitude: float | None = None
    longitude: float | None = None


class NodeCreate(NodeBase):
    pass


class NodeUpdate(BaseModel):
    campus_id: int | None = None
    building_id: int | None = None
    floor_id: int | None = None
    name: str | None = None
    node_type: NodeType | None = None
    pos_x: float | None = None
    pos_y: float | None = None
    latitude: float | None = None
    longitude: float | None = None


class NodeRead(NodeBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime.datetime
    updated_at: datetime.datetime
