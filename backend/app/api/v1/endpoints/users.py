"""app/api/v1/endpoints/users.py - Public Profiles & Follow/Following."""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, get_db
from app.models.follow import UserFollow
from app.models.stats import UserStats
from app.models.user import User
from app.schemas.user import FollowToggleResponse, FollowUserItem, PublicUserProfileResponse

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/{user_id}/profile", response_model=PublicUserProfileResponse)
async def get_user_profile(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(User)
        .options(selectinload(User.handles), selectinload(User.stats))
        .where(User.id == user_id)
    )
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

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
        }

    total_solved = user.stats.total_solved if user.stats else 0
    composite_score = user.stats.composite_score if user.stats else 0.0
    platform_data = user.stats.platform_data if user.stats and user.stats.platform_data else {}

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

    is_following = False
    if current_user.id != user.id:
        existing_follow = await db.scalar(
            select(UserFollow.id).where(
                UserFollow.follower_id == current_user.id,
                UserFollow.following_id == user.id,
            )
        )
        is_following = existing_follow is not None

    return PublicUserProfileResponse(
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
        created_at=user.created_at,
        total_solved=total_solved,
        composite_score=composite_score,
        followers_count=followers_count,
        following_count=following_count,
        is_following=is_following,
        handles=handles_dict,
        platform_data=platform_data,
    )


@router.post("/{user_id}/follow", response_model=FollowToggleResponse)
async def toggle_follow(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot follow yourself",
        )

    target_user = await db.get(User, user_id)
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    existing_follow = await db.scalar(
        select(UserFollow).where(
            UserFollow.follower_id == current_user.id,
            UserFollow.following_id == user_id,
        )
    )

    if existing_follow:
        await db.delete(existing_follow)
        await db.commit()
        is_following = False
        message = f"Unfollowed {target_user.username}"
    else:
        new_follow = UserFollow(
            follower_id=current_user.id,
            following_id=user_id,
        )
        db.add(new_follow)
        await db.commit()
        is_following = True
        message = f"Now following {target_user.username}"

    followers_count = (
        await db.scalar(
            select(func.count(UserFollow.id)).where(UserFollow.following_id == user_id)
        )
        or 0
    )
    following_count = (
        await db.scalar(
            select(func.count(UserFollow.id)).where(UserFollow.follower_id == current_user.id)
        )
        or 0
    )

    return FollowToggleResponse(
        user_id=user_id,
        is_following=is_following,
        followers_count=followers_count,
        following_count=following_count,
        message=message,
    )


@router.get("/{user_id}/followers", response_model=list[FollowUserItem])
async def get_user_followers(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(User, UserStats)
        .join(UserFollow, UserFollow.follower_id == User.id)
        .outerjoin(UserStats, UserStats.user_id == User.id)
        .where(UserFollow.following_id == user_id)
    )
    results = (await db.execute(stmt)).all()

    # get list of ids the current_user follows to check is_following
    my_follows = set(
        await db.scalars(
            select(UserFollow.following_id).where(UserFollow.follower_id == current_user.id)
        )
    )

    items = []
    for user, stats in results:
        items.append(
            FollowUserItem(
                user_id=user.id,
                username=user.username,
                avatar_url=user.avatar_url,
                college=user.college,
                composite_score=stats.composite_score if stats else 0.0,
                is_following=user.id in my_follows,
            )
        )
    return items


@router.get("/{user_id}/following", response_model=list[FollowUserItem])
async def get_user_following(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(User, UserStats)
        .join(UserFollow, UserFollow.following_id == User.id)
        .outerjoin(UserStats, UserStats.user_id == User.id)
        .where(UserFollow.follower_id == user_id)
    )
    results = (await db.execute(stmt)).all()

    my_follows = set(
        await db.scalars(
            select(UserFollow.following_id).where(UserFollow.follower_id == current_user.id)
        )
    )

    items = []
    for user, stats in results:
        items.append(
            FollowUserItem(
                user_id=user.id,
                username=user.username,
                avatar_url=user.avatar_url,
                college=user.college,
                composite_score=stats.composite_score if stats else 0.0,
                is_following=user.id in my_follows,
            )
        )
    return items

