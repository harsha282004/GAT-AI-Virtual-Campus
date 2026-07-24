import datetime

from pydantic import BaseModel, ConfigDict


class FloorBase(BaseModel):
    building_id: int
    level: int
    name: str


class FloorCreate(FloorBase):
    pass


class FloorUpdate(BaseModel):
    building_id: int | None = None
    level: int | None = None
    name: str | None = None


class FloorRead(FloorBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime.datetime
    updated_at: datetime.datetime
