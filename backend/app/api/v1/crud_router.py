import logging
from typing import Any

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import Pagination, get_db, pagination_params
from app.core.exceptions import NotFoundError

logger = logging.getLogger(__name__)


def build_crud_router(
    *,
    crud_obj: Any,
    create_schema: type,
    update_schema: type,
    read_schema: type,
    resource_name: str,
    paginated: bool = True,
) -> APIRouter:
    """Standard list/get/create/update/delete endpoints for one resource.
    Resource-specific behavior (search, navigation) is added on top of the
    returned router in that resource's own module — this factory only covers
    the identical CRUD shape shared by every model.

    `paginated=False` (opt-out, default stays True for every existing
    caller) drops the skip/limit query params from the list route entirely
    — for a small, fully admin-managed dataset where silently truncating
    the list is a bug, not a safety valve (see CrossFloorHotspot, whose
    default-limit=100 GET was dropping every hotspot created past the
    100th). Every other resource keeps today's paginated behavior
    unchanged."""
    router = APIRouter()

    if paginated:

        @router.get("", response_model=list[read_schema])  # type: ignore[valid-type]
        def list_items(
            db: Session = Depends(get_db),
            pagination: Pagination = Depends(pagination_params),
        ) -> Any:
            return crud_obj.get_multi(db, skip=pagination.skip, limit=pagination.limit)

    else:

        @router.get("", response_model=list[read_schema])  # type: ignore[valid-type]
        def list_items(db: Session = Depends(get_db)) -> Any:  # type: ignore[misc]
            return crud_obj.get_multi(db)

    @router.get("/{item_id}", response_model=read_schema)
    def get_item(item_id: int, db: Session = Depends(get_db)) -> Any:
        obj = crud_obj.get(db, item_id)
        if obj is None:
            raise NotFoundError(f"{resource_name} {item_id} not found.")
        return obj

    @router.post("", response_model=read_schema, status_code=status.HTTP_201_CREATED)
    def create_item(item_in: create_schema, db: Session = Depends(get_db)) -> Any:  # type: ignore[valid-type]
        obj = crud_obj.create(db, obj_in=item_in)
        logger.info("Created %s id=%s", resource_name, obj.id)
        return obj

    @router.put("/{item_id}", response_model=read_schema)
    def update_item(
        item_id: int,
        item_in: update_schema,  # type: ignore[valid-type]
        db: Session = Depends(get_db),
    ) -> Any:
        obj = crud_obj.get(db, item_id)
        if obj is None:
            raise NotFoundError(f"{resource_name} {item_id} not found.")
        updated = crud_obj.update(db, db_obj=obj, obj_in=item_in)
        logger.info("Updated %s id=%s", resource_name, item_id)
        return updated

    @router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
    def delete_item(item_id: int, db: Session = Depends(get_db)) -> None:
        obj = crud_obj.remove(db, id=item_id)
        if obj is None:
            raise NotFoundError(f"{resource_name} {item_id} not found.")
        logger.info("Deleted %s id=%s", resource_name, item_id)

    return router
