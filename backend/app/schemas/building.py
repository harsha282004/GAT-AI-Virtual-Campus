import datetime

from pydantic import BaseModel, ConfigDict


class BuildingBase(BaseModel):
    campus_id: int
    name: str
    code: str | None = None
    description: str | None = None
    latitude: float | None = None
    longitude: float | None = None


class BuildingCreate(BuildingBase):
    pass


class BuildingUpdate(BaseModel):
    campus_id: int | None = None
    name: str | None = None
    code: str | None = None
    description: str | None = None
    latitude: float | None = None
    longitude: float | None = None


class BuildingRead(BuildingBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime.datetime
    updated_at: datetime.datetime
