from pydantic import BaseModel, ConfigDict

from app.models.edge import EdgeDirection, EdgeType


class SceneHotspot(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    edge_id: int
    target_node_id: int
    direction: EdgeDirection
    edge_type: EdgeType
    yaw: float
    pitch: float
    label: str
    # Effective orientation to open the target scene with — already resolved
    # (edge.entry_yaw if explicitly set, else the forward/back default, else
    # None meaning "use the target scene's own resting yaw").
    entry_yaw: float | None
    entry_pitch: float | None


class SceneRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    node_id: int
    # The underlying Panorama row's own id — distinct from node_id, needed to
    # target PUT /api/v1/panoramas/{panorama_id}/orientation for calibration.
    panorama_id: int
    name: str
    building_id: int
    building_name: str
    floor_id: int
    floor_name: str
    sequence_index: int | None
    image_path: str
    preview_path: str | None
    initial_yaw: float
    initial_pitch: float
    hfov: float
    description: str | None
    hotspots: list[SceneHotspot]
