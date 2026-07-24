from app.crud.base import CRUDBase
from app.models.building import Building
from app.schemas.building import BuildingCreate, BuildingUpdate


class CRUDBuilding(CRUDBase[Building, BuildingCreate, BuildingUpdate]):
    pass


building = CRUDBuilding(Building)
