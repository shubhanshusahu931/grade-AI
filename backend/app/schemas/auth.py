"""app/schemas/auth.py"""
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RegisterRequest(BaseModel):
    username: str = Field(min_length=2, max_length=64)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    college: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in_minutes: int


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    username: str
    email: EmailStr
    college: str | None
    created_at: datetime


class UserProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    username: str
    email: EmailStr
    college: str | None = None
    bio: str | None = None
    phone: str | None = None
    github: str | None = None
    linkedin: str | None = None
    instagram: str | None = None
    avatar_url: str | None = None
    created_at: datetime
    total_solved: int = 0
    composite_score: float = 0.0
    followers_count: int = 0
    following_count: int = 0
    last_synced_at: datetime | None = None
    handles: dict[str, str | None] = Field(default_factory=dict)


class ProfileUpdateRequest(BaseModel):
    username: str | None = Field(default=None, min_length=2, max_length=64)
    college: str | None = Field(default=None, max_length=255)
    bio: str | None = Field(default=None, max_length=500)
    phone: str | None = Field(default=None, max_length=32)
    github: str | None = Field(default=None, max_length=255)
    linkedin: str | None = Field(default=None, max_length=255)
    instagram: str | None = Field(default=None, max_length=255)
    avatar_url: str | None = Field(default=None, max_length=512)

