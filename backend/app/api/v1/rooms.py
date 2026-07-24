from app import crud
from app.api.v1.crud_router import build_crud_router
from app.schemas.room import RoomCreate, RoomRead, RoomUpdate

router = build_crud_router(
    crud_obj=crud.room,
    create_schema=RoomCreate,
    update_schema=RoomUpdate,
    read_schema=RoomRead,
    resource_name="Room",
)
