"""app/api/v1/endpoints/admin.py - Superuser Admin Management & Governance."""
from datetime import datetime, timezone
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_admin_user, get_db
from app.models.follow import UserFollow
from app.models.handles import UserHandles
from app.models.interview import InterviewPost
from app.models.stats import UserStats
from app.models.user import User
from app.schemas.admin import (
    AdminStatsResponse,
    AdminUserItem,
    AdminUserListResponse,
    AdminUserUpdateRequest,
)
from app.schemas.sync import PlatformResult, SyncResponse
from app.services.fetcher import fetch_all_platforms
from app.services.scoring import calculate_composite_score

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/stats", response_model=AdminStatsResponse)
async def get_system_stats(
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_admin_user),
):
    total_users = (await db.scalar(select(func.count(User.id)))) or 0
    total_solved = (await db.scalar(select(func.sum(UserStats.total_solved)))) or 0
    avg_score = (await db.scalar(select(func.avg(UserStats.composite_score)))) or 0.0
    total_follows = (await db.scalar(select(func.count(UserFollow.id)))) or 0
    total_colleges = (
        await db.scalar(select(func.count(func.distinct(User.college))).where(User.college.isnot(None)))
    ) or 0
    total_posts = (await db.scalar(select(func.count(InterviewPost.id)))) or 0

    # Platform breakdown (count users having handles for each platform)
    platforms = [
        "codeforces", "leetcode", "codechef", "gfg", "hackerrank",
        "codetantra_url", "hackerearth", "takeuforward", "codingninjas"
    ]
    breakdown = {}
    for p in platforms:
        col = getattr(UserHandles, p)
        cnt = (await db.scalar(select(func.count(UserHandles.id)).where(col.isnot(None)))) or 0
        breakdown[p] = cnt

    return AdminStatsResponse(
        total_users=total_users,
        total_solved_aggregate=int(total_solved),
        avg_composite_score=round(float(avg_score), 1),
        total_follows=total_follows,
        total_colleges=total_colleges,
        total_interview_posts=total_posts,
        platform_breakdown=breakdown,
    )


@router.get("/users", response_model=AdminUserListResponse)
async def list_users(
    search: str | None = Query(default=None),
    role: str | None = Query(default=None),  # "admin" | "candidate"
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_admin_user),
):
    query = (
        select(User)
        .options(selectinload(User.handles), selectinload(User.stats))
        .order_by(User.created_at.desc())
    )

    if search:
        s = f"%{search.strip().lower()}%"
        query = query.where(
            or_(
                func.lower(User.username).like(s),
                func.lower(User.email).like(s),
                func.lower(User.college).like(s),
            )
        )

    if role == "admin":
        query = query.where(User.is_admin.is_(True))
    elif role == "candidate":
        query = query.where(User.is_admin.is_(False))

    total = (await db.scalar(select(func.count()).select_from(query.subquery()))) or 0
    results = (await db.execute(query.offset(offset).limit(limit))).scalars().all()

    items = []
    for u in results:
        handles_dict = {}
        if u.handles:
            handles_dict = {
                "codeforces": u.handles.codeforces,
                "leetcode": u.handles.leetcode,
                "codechef": u.handles.codechef,
                "gfg": u.handles.gfg,
                "hackerrank": u.handles.hackerrank,
                "codetantra_url": u.handles.codetantra_url,
                "codetantra_id": u.handles.codetantra_id,
                "hackerearth": u.handles.hackerearth,
                "takeuforward": u.handles.takeuforward,
                "codingninjas": u.handles.codingninjas,
            }

        followers_cnt = (
            await db.scalar(
                select(func.count(UserFollow.id)).where(UserFollow.following_id == u.id)
            )
        ) or 0
        following_cnt = (
            await db.scalar(
                select(func.count(UserFollow.id)).where(UserFollow.follower_id == u.id)
            )
        ) or 0

        items.append(
            AdminUserItem(
                id=u.id,
                username=u.username,
                email=u.email,
                college=u.college,
                bio=u.bio,
                phone=u.phone,
                is_admin=u.is_admin,
                total_solved=u.stats.total_solved if u.stats else 0,
                composite_score=u.stats.composite_score if u.stats else 0.0,
                created_at=u.created_at,
                last_synced_at=u.stats.last_synced_at if u.stats else None,
                followers_count=followers_cnt,
                following_count=following_cnt,
                handles=handles_dict,
            )
        )

    return AdminUserListResponse(total=total, users=items)


@router.put("/users/{user_id}", response_model=AdminUserItem)
async def update_user(
    user_id: uuid.UUID,
    payload: AdminUserUpdateRequest,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_admin_user),
):
    stmt = (
        select(User)
        .options(selectinload(User.handles), selectinload(User.stats))
        .where(User.id == user_id)
    )
    user = (await db.execute(stmt)).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if payload.username is not None:
        user.username = payload.username.strip()
    if payload.email is not None:
        user.email = payload.email.strip().lower()
    if payload.college is not None:
        user.college = payload.college.strip() or None
    if payload.bio is not None:
        user.bio = payload.bio.strip() or None
    if payload.phone is not None:
        user.phone = payload.phone.strip() or None
    if payload.is_admin is not None:
        # Prevent removing admin from oneself if last admin
        if user.id == admin_user.id and not payload.is_admin:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove admin status from your own account",
            )
        user.is_admin = payload.is_admin

    db.add(user)
    await db.commit()
    await db.refresh(user)

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

    return AdminUserItem(
        id=user.id,
        username=user.username,
        email=user.email,
        college=user.college,
        bio=user.bio,
        phone=user.phone,
        is_admin=user.is_admin,
        total_solved=user.stats.total_solved if user.stats else 0,
        composite_score=user.stats.composite_score if user.stats else 0.0,
        created_at=user.created_at,
        last_synced_at=user.stats.last_synced_at if user.stats else None,
        handles=handles_dict,
    )


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_admin_user),
):
    if user_id == admin_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own admin account",
        )

    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    await db.delete(user)
    await db.commit()
    return {"message": f"User {user.username} deleted successfully"}


@router.post("/users/{user_id}/sync", response_model=SyncResponse)
async def force_sync_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_admin_user),
):
    stmt = (
        select(User)
        .options(selectinload(User.handles), selectinload(User.stats))
        .where(User.id == user_id)
    )
    user = (await db.execute(stmt)).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    handles = user.handles
    if handles is None:
        handles = UserHandles(user_id=user.id)
        db.add(handles)

    fallback_prefix = user.email.split("@")[0]
    handle_dict = {
        "codeforces": handles.codeforces,
        "leetcode": handles.leetcode,
        "codechef": handles.codechef,
        "gfg": handles.gfg,
        "hackerrank": handles.hackerrank,
        "codetantra_url": handles.codetantra_url,
        "codetantra_id": handles.codetantra_id,
        "hackerearth": handles.hackerearth,
        "takeuforward": handles.takeuforward,
        "codingninjas": handles.codingninjas,
    }

    results: list[PlatformResult] = await fetch_all_platforms(handle_dict, fallback_prefix)
    composite_score, total_solved = calculate_composite_score(results)

    stats = user.stats
    if stats is None:
        stats = UserStats(user_id=user.id)
        db.add(stats)

    stats.total_solved = total_solved
    stats.composite_score = composite_score
    stats.platform_data = {r.platform: r.model_dump() for r in results}
    stats.last_synced_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(stats)

    return SyncResponse(
        user_id=user.id,
        total_solved=total_solved,
        composite_score=composite_score,
        last_synced_at=stats.last_synced_at,
        platforms=results,
    )

