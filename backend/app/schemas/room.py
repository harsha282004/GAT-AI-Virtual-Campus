import datetime

from pydantic import BaseModel, ConfigDict


class RoomBase(BaseModel):
    floor_id: int
    node_id: int | None = None
    name: str
    room_number: str | None = None
    room_type: str = "classroom"
    department: str | None = None
    capacity: int | None = None
    description: str | None = None


class RoomCreate(RoomBase):
    pass


class RoomUpdate(BaseModel):
    floor_id: int | None = None
    node_id: int | None = None
    name: str | None = None
    room_number: str | None = None
    room_type: str | None = None
    department: str | None = None
    capacity: int | None = None
    description: str | None = None


class RoomRead(RoomBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime.datetime
    updated_at: datetime.datetime
