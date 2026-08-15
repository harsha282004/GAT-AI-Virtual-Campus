import datetime

from pydantic import BaseModel, ConfigDict


class PanoramaBase(BaseModel):
    node_id: int
    image_path: str
    title: str | None = None
    is_placeholder: bool = True
    sequence_index: int | None = None
    initial_yaw: float | None = None
    initial_pitch: float | None = None
    hfov: float | None = 110.0
    description: str | None = None


class PanoramaCreate(PanoramaBase):
    pass


class PanoramaUpdate(BaseModel):
    node_id: int | None = None
    image_path: str | None = None
    title: str | None = None
    is_placeholder: bool | None = None
    sequence_index: int | None = None
    initial_yaw: float | None = None
    initial_pitch: float | None = None
    hfov: float | None = None
    description: str | None = None


class PanoramaRead(PanoramaBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime.datetime
    updated_at: datetime.datetime


class PanoramaOrientationUpdate(BaseModel):
    """Body for PUT /panoramas/{id}/orientation — the calibration panel's
    only write path; deliberately narrower than PanoramaUpdate so a
    calibration save can never touch image_path/title/etc."""

    initial_yaw: float
    initial_pitch: float
