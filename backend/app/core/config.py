from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolved relative to this file (backend/app/core/config.py -> repo root),
# not the process's CWD, so `.env` loads the same way whether the app is
# started from the repo root (uvicorn) or from backend/ (alembic, scripts).
_REPO_ROOT_ENV_FILE = Path(__file__).resolve().parents[3] / ".env"


class Settings(BaseSettings):
    """Schema for all environment-driven configuration. See .env.example for the
    full, documented list of variables and their sections."""

    model_config = SettingsConfigDict(env_file=str(_REPO_ROOT_ENV_FILE), extra="ignore")

    PROJECT_NAME: str = "AI Agent-Based Indoor Virtual Campus Tour and Query Assistant"
    API_V1_PREFIX: str = "/api/v1"
    ENVIRONMENT: str = "development"

    BACKEND_HOST: str = "0.0.0.0"
    BACKEND_PORT: int = 8000

    DATABASE_URL: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/postgres"
    DB_ECHO: bool = False

    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3"

    CHROMA_PERSIST_DIR: str = "./data/chroma_db"
    CHROMA_COLLECTION_NAME: str = "gat_kb"

    CORS_ALLOWED_ORIGINS: str = "http://localhost:3000"

    LOG_LEVEL: str = "INFO"

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ALLOWED_ORIGINS.split(",") if origin.strip()]
