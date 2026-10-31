"""app/schemas/rag.py"""
import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class RagSearchRequest(BaseModel):
    query: str = Field(min_length=2, max_length=1500)
    company: str | None = None
    top_k: int = Field(default=4, ge=1, le=10)


class RagSourceChunk(BaseModel):
    company: str
    role: str
    snippet: str
    similarity: float
    document_title: str | None = None
    category: str | None = None


class RagSearchResponse(BaseModel):
    answer: str
    sources: list[RagSourceChunk]
    source_type: str = "knowledge_base"  # "knowledge_base" | "gemini_fallback"
    grounded: bool = True


class RagDocumentItem(BaseModel):
    id: uuid.UUID
    title: str
    filename: str
    category: str
    file_size: int
    total_chunks: int
    uploaded_by: str | None = None
    created_at: datetime


class RagDocumentUploadResponse(BaseModel):
    message: str
    document: RagDocumentItem
    chunks_embedded: int
