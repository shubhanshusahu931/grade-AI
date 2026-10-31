"""app/schemas/rag.py"""
from pydantic import BaseModel, Field


class RagSearchRequest(BaseModel):
    query: str = Field(min_length=3, max_length=1000)
    company: str | None = None
    top_k: int = Field(default=3, ge=1, le=10)


class RagSourceChunk(BaseModel):
    company: str
    role: str
    snippet: str
    similarity: float


class RagSearchResponse(BaseModel):
    answer: str
    sources: list[RagSourceChunk]
