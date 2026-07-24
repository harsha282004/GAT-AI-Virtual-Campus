from app import crud
from app.api.v1.crud_router import build_crud_router
from app.schemas.campus import CampusCreate, CampusRead, CampusUpdate

router = build_crud_router(
    crud_obj=crud.campus,
    create_schema=CampusCreate,
    update_schema=CampusUpdate,
    read_schema=CampusRead,
    resource_name="Campus",
)
