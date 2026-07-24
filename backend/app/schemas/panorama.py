import datetime

from pydantic import BaseModel, ConfigDict


class PanoramaBase(BaseModel):
    node_id: int
    image_path: str
    title: str | None = None
    is_placeholder: bool = True


class PanoramaCreate(PanoramaBase):
    pass


class PanoramaUpdate(BaseModel):
    node_id: int | None = None
    image_path: str | None = None
    title: str | None = None
    is_placeholder: bool | None = None


class PanoramaRead(PanoramaBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime.datetime
    updated_at: datetime.datetime
