from app import crud
from app.api.v1.crud_router import build_crud_router
from app.schemas.edge import EdgeCreate, EdgeRead, EdgeUpdate

router = build_crud_router(
    crud_obj=crud.edge,
    create_schema=EdgeCreate,
    update_schema=EdgeUpdate,
    read_schema=EdgeRead,
    resource_name="Edge",
)
