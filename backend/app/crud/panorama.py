from app.crud.base import CRUDBase
from app.models.panorama import Panorama
from app.schemas.panorama import PanoramaCreate, PanoramaUpdate


class CRUDPanorama(CRUDBase[Panorama, PanoramaCreate, PanoramaUpdate]):
    pass


panorama = CRUDPanorama(Panorama)
