from app.db.session import get_db as _get_db

# Re-exported so every router imports dependencies from one place
# (app.api.deps) rather than reaching into app.db.session directly.
get_db = _get_db


class Pagination:
    def __init__(self, skip: int = 0, limit: int = 100) -> None:
        self.skip = skip
        self.limit = min(limit, 500)


def pagination_params(skip: int = 0, limit: int = 100) -> Pagination:
    return Pagination(skip=skip, limit=limit)
