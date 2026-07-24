from app import crud
from app.api.v1.crud_router import build_crud_router
from app.schemas.panorama import PanoramaCreate, PanoramaRead, PanoramaUpdate

router = build_crud_router(
    crud_obj=crud.panorama,
    create_schema=PanoramaCreate,
    update_schema=PanoramaUpdate,
    read_schema=PanoramaRead,
    resource_name="Panorama",
)
