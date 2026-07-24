import logging
import logging.config

from app.core.settings import settings


def configure_logging() -> None:
    """Configure structured, leveled logging for the whole app. Call once at
    startup (see app.main). Every module should log via
    logging.getLogger(__name__) — never print()."""
    logging.config.dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "default": {
                    "format": "%(asctime)s %(levelname)-8s %(name)s: %(message)s",
                    "datefmt": "%Y-%m-%d %H:%M:%S",
                },
            },
            "handlers": {
                "console": {
                    "class": "logging.StreamHandler",
                    "formatter": "default",
                    "stream": "ext://sys.stdout",
                },
            },
            "root": {
                "level": settings.LOG_LEVEL,
                "handlers": ["console"],
            },
            "loggers": {
                "uvicorn": {"level": settings.LOG_LEVEL, "propagate": True},
                "uvicorn.access": {"level": settings.LOG_LEVEL, "propagate": True},
                "sqlalchemy.engine": {"level": "WARNING", "propagate": True},
            },
        }
    )
