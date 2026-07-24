from app import crud
from app.api.v1.crud_router import build_crud_router
from app.schemas.floor import FloorCreate, FloorRead, FloorUpdate

router = build_crud_router(
    crud_obj=crud.floor,
    create_schema=FloorCreate,
    update_schema=FloorUpdate,
    read_schema=FloorRead,
    resource_name="Floor",
)
