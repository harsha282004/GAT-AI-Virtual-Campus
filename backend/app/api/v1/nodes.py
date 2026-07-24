from app import crud
from app.api.v1.crud_router import build_crud_router
from app.schemas.node import NodeCreate, NodeRead, NodeUpdate

router = build_crud_router(
    crud_obj=crud.node,
    create_schema=NodeCreate,
    update_schema=NodeUpdate,
    read_schema=NodeRead,
    resource_name="Node",
)
