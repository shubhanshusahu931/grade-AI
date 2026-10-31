"""
app/api/v1/endpoints/sync.py - Handle auto-discovery & data sync.

POST /api/v1/sync (protected):
  - Applies any handle overrides sent in the request body.
  - Derives an email-prefix fallback (e.g. "shubhanshu" from
    "shubhanshu@domain.com") for any platform left blank.
  - Runs the 6-platform async fetch with fault isolation.
  - Recomputes the composite score and persists UserStats.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.handles import UserHandles
from app.models.stats import UserStats
from app.models.user import User
from app.schemas.sync import HandlesUpdate, PlatformResult, SyncResponse
from app.services.fetcher import fetch_all_platforms
from app.services.scoring import calculate_composite_score

router = APIRouter(prefix="/sync", tags=["Sync"])


def _email_prefix(email: str) -> str:
    return email.split("@")[0]


@router.post("", response_model=SyncResponse)
async def sync_profile(
    overrides: HandlesUpdate | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    handles = current_user.handles
    if handles is None:
        handles = UserHandles(user_id=current_user.id)
        db.add(handles)

    if overrides:
        for field, value in overrides.model_dump(exclude_unset=True).items():
            if value:
                setattr(handles, field, value)

    fallback_prefix = _email_prefix(current_user.email)

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

    stats = current_user.stats
    if stats is None:
        stats = UserStats(user_id=current_user.id)
        db.add(stats)

    stats.total_solved = total_solved
    stats.composite_score = composite_score
    stats.platform_data = {r.platform: r.model_dump() for r in results}
    stats.last_synced_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(stats)

    return SyncResponse(
        user_id=current_user.id,
        total_solved=total_solved,
        composite_score=composite_score,
        last_synced_at=stats.last_synced_at,
        platforms=results,
    )


@router.get("/status", response_model=SyncResponse)
async def get_sync_status(current_user: User = Depends(get_current_user)):
    stats = current_user.stats
    if stats is None or not stats.last_synced_at:
        return SyncResponse(
            user_id=current_user.id,
            total_solved=0,
            composite_score=0.0,
            last_synced_at=datetime.now(timezone.utc),
            platforms=[],
        )

    platforms_list = []
    if stats.platform_data and isinstance(stats.platform_data, dict):
        for p_name, p_val in stats.platform_data.items():
            try:
                platforms_list.append(PlatformResult(**p_val))
            except Exception:
                pass

    return SyncResponse(
        user_id=current_user.id,
        total_solved=stats.total_solved,
        composite_score=stats.composite_score,
        last_synced_at=stats.last_synced_at,
        platforms=platforms_list,
    )


@router.get("/handles", response_model=HandlesUpdate)
async def get_user_handles(current_user: User = Depends(get_current_user)):
    h = current_user.handles
    if not h:
        return HandlesUpdate()
    return HandlesUpdate(
        codeforces=h.codeforces,
        leetcode=h.leetcode,
        codechef=h.codechef,
        gfg=h.gfg,
        hackerrank=h.hackerrank,
        codetantra_url=h.codetantra_url,
        codetantra_id=h.codetantra_id,
        hackerearth=h.hackerearth,
        takeuforward=h.takeuforward,
        codingninjas=h.codingninjas,
    )
