"""app/api/v1/endpoints/auth.py - Login, Register & Profile."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.config import settings
from app.core.security import create_access_token, hash_password, verify_password
from app.models.follow import UserFollow
from app.models.handles import UserHandles
from app.models.stats import UserStats
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    ProfileUpdateRequest,
    RegisterRequest,
    TokenResponse,
    UserProfileResponse,
)

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        username=payload.username,
        email=payload.email,
        password_hash=hash_password(payload.password),
        college=payload.college,
    )
    db.add(user)
    await db.flush()  # populate user.id before creating dependent rows

    db.add(UserHandles(user_id=user.id))
    db.add(UserStats(user_id=user.id, total_solved=0, composite_score=0.0, platform_data={}))

    await db.commit()

    token = create_access_token(user.id, user.email)
    return TokenResponse(access_token=token, expires_in_minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(user.id, user.email)
    return TokenResponse(access_token=token, expires_in_minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)


async def _get_profile_response(user: User, db: AsyncSession) -> UserProfileResponse:
    handles_dict = {}
    if user.handles:
        handles_dict = {
            "codeforces": user.handles.codeforces,
            "leetcode": user.handles.leetcode,
            "codechef": user.handles.codechef,
            "gfg": user.handles.gfg,
            "hackerrank": user.handles.hackerrank,
            "codetantra_url": user.handles.codetantra_url,
            "codetantra_id": user.handles.codetantra_id,
            "hackerearth": user.handles.hackerearth,
            "takeuforward": user.handles.takeuforward,
            "codingninjas": user.handles.codingninjas,
        }

    total_solved = user.stats.total_solved if user.stats else 0
    composite_score = user.stats.composite_score if user.stats else 0.0
    last_synced_at = user.stats.last_synced_at if user.stats else None

    # Count followers & following
    followers_count = (
        await db.scalar(
            select(func.count(UserFollow.id)).where(UserFollow.following_id == user.id)
        )
        or 0
    )
    following_count = (
        await db.scalar(
            select(func.count(UserFollow.id)).where(UserFollow.follower_id == user.id)
        )
        or 0
    )

    return UserProfileResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        college=user.college,
        bio=user.bio,
        phone=user.phone,
        github=user.github,
        linkedin=user.linkedin,
        instagram=user.instagram,
        avatar_url=user.avatar_url,
        is_admin=user.is_admin,
        created_at=user.created_at,
        total_solved=total_solved,
        composite_score=composite_score,
        followers_count=followers_count,
        following_count=following_count,
        last_synced_at=last_synced_at,
        handles=handles_dict,
    )


@router.get("/me", response_model=UserProfileResponse)
async def get_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _get_profile_response(current_user, db)


@router.put("/profile", response_model=UserProfileResponse)
async def update_profile(
    payload: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if payload.username is not None:
        cleaned_username = payload.username.strip()
        if cleaned_username:
            current_user.username = cleaned_username

    if payload.college is not None:
        current_user.college = payload.college.strip() or None

    if payload.bio is not None:
        current_user.bio = payload.bio.strip() or None

    if payload.phone is not None:
        current_user.phone = payload.phone.strip() or None

    if payload.github is not None:
        current_user.github = payload.github.strip() or None

    if payload.linkedin is not None:
        current_user.linkedin = payload.linkedin.strip() or None

    if payload.instagram is not None:
        current_user.instagram = payload.instagram.strip() or None

    if payload.avatar_url is not None:
        current_user.avatar_url = payload.avatar_url.strip() or None

    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)

    return await _get_profile_response(current_user, db)

