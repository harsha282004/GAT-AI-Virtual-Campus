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


class CampusStats(BaseModel):
    """Aggregate counts for the Campus page's "at a glance" section — all
    derived from existing tables, no new storage. `tour_scenes` is the count
    of real (non-placeholder) panoramas, i.e. navigable 360° scenes."""

    campus_id: int
    buildings: int
    floors: int
    rooms: int
    nodes: int
    edges: int
    panoramas: int
    tour_scenes: int
