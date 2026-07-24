from app import crud
from app.api.v1.crud_router import build_crud_router
from app.schemas.document import DocumentCreate, DocumentRead, DocumentUpdate

router = build_crud_router(
    crud_obj=crud.document,
    create_schema=DocumentCreate,
    update_schema=DocumentUpdate,
    read_schema=DocumentRead,
    resource_name="Document",
)
