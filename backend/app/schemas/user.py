"""app/schemas/user.py - User Profile and Follow schemas."""
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class PublicUserProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    username: str
    email: str | None = None
    college: str | None = None
    bio: str | None = None
    phone: str | None = None
    github: str | None = None
    linkedin: str | None = None
    instagram: str | None = None
    avatar_url: str | None = None
    is_admin: bool = False
    created_at: datetime | None = None
    total_solved: int = 0
    composite_score: float = 0.0
    followers_count: int = 0
    following_count: int = 0
    is_following: bool = False
    handles: dict[str, str | None] = Field(default_factory=dict)
    platform_data: dict = Field(default_factory=dict)


class FollowToggleResponse(BaseModel):
    user_id: uuid.UUID
    is_following: bool
    followers_count: int
    following_count: int
    message: str


class FollowUserItem(BaseModel):
    user_id: uuid.UUID
    username: str
    avatar_url: str | None = None
    college: str | None = None
    total_solved: int = 0
    composite_score: float = 0.0
    is_following: bool = False


