"""app/schemas/admin.py - Admin Governance & System Metrics Schemas."""
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class AdminStatsResponse(BaseModel):
    total_users: int
    total_solved_aggregate: int
    avg_composite_score: float
    total_follows: int
    total_colleges: int
    total_interview_posts: int
    platform_breakdown: dict[str, int] = Field(default_factory=dict)


class AdminUserItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    username: str
    email: str
    college: str | None = None
    bio: str | None = None
    phone: str | None = None
    is_admin: bool = False
    total_solved: int = 0
    composite_score: float = 0.0
    created_at: datetime
    last_synced_at: datetime | None = None
    followers_count: int = 0
    following_count: int = 0
    handles: dict[str, str | None] = Field(default_factory=dict)


class AdminUserUpdateRequest(BaseModel):
    username: str | None = Field(default=None, min_length=2, max_length=64)
    email: str | None = None
    college: str | None = None
    bio: str | None = None
    phone: str | None = None
    is_admin: bool | None = None


class AdminUserListResponse(BaseModel):
    total: int
    users: list[AdminUserItem]

