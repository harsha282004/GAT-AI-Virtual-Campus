import datetime

from pydantic import BaseModel, ConfigDict

from app.models.document import DocumentDomain


class DocumentBase(BaseModel):
    campus_id: int | None = None
    title: str
    content: str
    domain: DocumentDomain = DocumentDomain.GENERAL
    source: str | None = None


class DocumentCreate(DocumentBase):
    pass


class DocumentUpdate(BaseModel):
    campus_id: int | None = None
    title: str | None = None
    content: str | None = None
    domain: DocumentDomain | None = None
    source: str | None = None


class DocumentRead(DocumentBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime.datetime
    updated_at: datetime.datetime
