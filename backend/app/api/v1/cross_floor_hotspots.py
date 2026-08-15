from app import crud
from app.api.v1.crud_router import build_crud_router
from app.schemas.cross_floor_hotspot import CrossFloorHotspotCreate, CrossFloorHotspotRead

# Standard list/get/create/update/delete, reusing the same generic CRUD
# factory every other simple resource uses. paginated=False: this is a
# small, fully admin-managed dataset (hand-placed hotspots, at most a few
# hundred rows) — GET must always return every row, never silently
# truncated to a default page size (see app/crud/cross_floor_hotspot.py's
# get_multi override for the incident this fixes).
router = build_crud_router(
    crud_obj=crud.cross_floor_hotspot,
    create_schema=CrossFloorHotspotCreate,
    update_schema=CrossFloorHotspotCreate,
    read_schema=CrossFloorHotspotRead,
    resource_name="CrossFloorHotspot",
    paginated=False,
)
