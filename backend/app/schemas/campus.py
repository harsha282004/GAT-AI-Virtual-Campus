import datetime

from pydantic import BaseModel, ConfigDict


class CampusBase(BaseModel):
    name: str
    description: str | None = None
    address: str | None = None


class CampusCreate(CampusBase):
    pass


class CampusUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    address: str | None = None


class CampusRead(CampusBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime.datetime
    updated_at: datetime.datetime
