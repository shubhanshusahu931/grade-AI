"""app/api/v1/endpoints/auth.py - Login & Register."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.config import settings
from app.core.security import create_access_token, hash_password, verify_password
from app.models.handles import UserHandles
from app.models.stats import UserStats
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserProfileResponse

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


@router.get("/me", response_model=UserProfileResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    handles_dict = {}
    if current_user.handles:
        handles_dict = {
            "codeforces": current_user.handles.codeforces,
            "leetcode": current_user.handles.leetcode,
            "codechef": current_user.handles.codechef,
            "gfg": current_user.handles.gfg,
            "hackerrank": current_user.handles.hackerrank,
            "codetantra_url": current_user.handles.codetantra_url,
            "codetantra_id": current_user.handles.codetantra_id,
        }

    total_solved = current_user.stats.total_solved if current_user.stats else 0
    composite_score = current_user.stats.composite_score if current_user.stats else 0.0
    last_synced_at = current_user.stats.last_synced_at if current_user.stats else None

    return UserProfileResponse(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        college=current_user.college,
        created_at=current_user.created_at,
        total_solved=total_solved,
        composite_score=composite_score,
        last_synced_at=last_synced_at,
        handles=handles_dict,
    )
