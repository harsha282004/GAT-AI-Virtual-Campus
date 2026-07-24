from app import crud
from app.api.v1.crud_router import build_crud_router
from app.schemas.building import BuildingCreate, BuildingRead, BuildingUpdate

router = build_crud_router(
    crud_obj=crud.building,
    create_schema=BuildingCreate,
    update_schema=BuildingUpdate,
    read_schema=BuildingRead,
    resource_name="Building",
)
