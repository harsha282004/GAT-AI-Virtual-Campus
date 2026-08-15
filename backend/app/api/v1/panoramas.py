import logging
from typing import Any

from fastapi import Depends
from sqlalchemy.orm import Session

from app import crud
from app.api.deps import get_db
from app.api.v1.crud_router import build_crud_router
from app.core.exceptions import NotFoundError
from app.schemas.panorama import (
    PanoramaCreate,
    PanoramaOrientationUpdate,
    PanoramaRead,
    PanoramaUpdate,
)

logger = logging.getLogger(__name__)

router = build_crud_router(
    crud_obj=crud.panorama,
    create_schema=PanoramaCreate,
    update_schema=PanoramaUpdate,
    read_schema=PanoramaRead,
    resource_name="Panorama",
)


@router.put(
    "/{item_id}/orientation",
    response_model=PanoramaRead,
    summary="Permanently recalibrate a panorama's resting orientation",
)
def update_orientation(
    item_id: int,
    payload: PanoramaOrientationUpdate,
    db: Session = Depends(get_db),
) -> Any:
    obj = crud.panorama.get(db, item_id)
    if obj is None:
        raise NotFoundError(f"Panorama {item_id} not found.")
    obj.initial_yaw = payload.initial_yaw
    obj.initial_pitch = payload.initial_pitch
    db.add(obj)
    db.commit()
    db.refresh(obj)
    logger.info(
        "Recalibrated Panorama id=%s -> initial_yaw=%.2f initial_pitch=%.2f",
        item_id,
        payload.initial_yaw,
        payload.initial_pitch,
    )
    return obj
