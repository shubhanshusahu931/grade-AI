"""app/api/v1/endpoints/leaderboard.py - Global & College rankings."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.stats import UserStats
from app.models.user import User
from app.schemas.leaderboard import LeaderboardEntry, LeaderboardResponse

router = APIRouter(prefix="/leaderboard", tags=["Leaderboard"])


async def _build_ranking(db: AsyncSession, limit: int, college: str | None = None):
    stmt = (
        select(User, UserStats)
        .join(UserStats, UserStats.user_id == User.id)
        .order_by(UserStats.composite_score.desc())
        .limit(limit)
    )
    if college:
        stmt = stmt.where(User.college == college)

    rows = (await db.execute(stmt)).all()
    return [
        LeaderboardEntry(
            rank=i + 1,
            user_id=user.id,
            username=user.username,
            college=user.college,
            total_solved=stats.total_solved,
            composite_score=stats.composite_score,
        )
        for i, (user, stats) in enumerate(rows)
    ]


@router.get("", response_model=LeaderboardResponse)
async def get_leaderboard(
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    global_rank = await _build_ranking(db, limit)

    college_rank = None
    if current_user.college:
        college_rank = await _build_ranking(db, limit, college=current_user.college)

    return LeaderboardResponse(global_rank=global_rank, college_rank=college_rank)
