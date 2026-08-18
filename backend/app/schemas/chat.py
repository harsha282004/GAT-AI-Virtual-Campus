from pydantic import BaseModel


class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None
    # Selected UI language ("en"/"kn"/"hi") — threaded through to
    # llm_generator.RESPONSE_LANGUAGE so the generated answer is produced
    # in that language. Optional/default "en" so existing callers that
    # don't send it are unaffected.
    language: str | None = None


class ChatSourceOut(BaseModel):
    title: str | None = None
    source_url: str | None = None
    page: int | None = None


class NavigationInfoOut(BaseModel):
    """Populated only when the navigation tool resolved a real route —
    fields mirror app.schemas.navigation.RouteResponse's shape, not a new
    contract, since the underlying data comes from the same
    build_graph/find_shortest_path/format_directions call."""

    from_label: str
    to_label: str
    total_distance: float
    estimated_walk_time_minutes: float
    is_accessible: bool
    turn_by_turn: list[str]


class PanoramaInfoOut(BaseModel):
    """Populated only when the panorama tool resolved a real Panorama row."""

    node_id: int
    title: str | None = None
    image_path: str
    distance: float | None = None


class ChatResponse(BaseModel):
    answer: str
    status: str
    confidence: float
    confidence_level: str
    selected_agent: str
    tool_used: str | None = None
    sources: list[ChatSourceOut] = []
    navigation: NavigationInfoOut | None = None
    panorama: PanoramaInfoOut | None = None
    session_id: str | None = None
