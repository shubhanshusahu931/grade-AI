"""app/schemas/sync.py"""
import uuid
from datetime import datetime

from pydantic import BaseModel


class HandlesUpdate(BaseModel):
    """All fields optional -> supports partial overrides in Settings tab."""
    codeforces: str | None = None
    leetcode: str | None = None
    codechef: str | None = None
    gfg: str | None = None
    hackerrank: str | None = None
    codetantra_url: str | None = None
    codetantra_id: str | None = None
    hackerearth: str | None = None
    takeuforward: str | None = None
    codingninjas: str | None = None



class PlatformResult(BaseModel):
    platform: str
    success: bool
    solved: int = 0
    rating: float | None = None
    error: str | None = None
    raw: dict | None = None


class SyncResponse(BaseModel):
    user_id: uuid.UUID
    total_solved: int
    composite_score: float
    last_synced_at: datetime
    platforms: list[PlatformResult]
