from functools import lru_cache

from app.core.config import Settings


@lru_cache
def get_settings() -> Settings:
    """Cached settings factory — use via FastAPI Depends(get_settings) where the
    setting value needs to be overridable in tests; use the `settings` singleton
    below everywhere else."""
    return Settings()


settings = get_settings()
