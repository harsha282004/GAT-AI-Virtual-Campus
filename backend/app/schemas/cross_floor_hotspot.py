import datetime

from pydantic import BaseModel, ConfigDict


class CrossFloorHotspotCreate(BaseModel):
    source_node_id: int
    target_node_id: int
    yaw: float
    pitch: float
    label: str | None = None


class CrossFloorHotspotRead(CrossFloorHotspotCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime.datetime
    updated_at: datetime.datetime
