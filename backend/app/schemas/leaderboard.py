"""app/schemas/leaderboard.py"""
import uuid

from pydantic import BaseModel


class LeaderboardEntry(BaseModel):
    rank: int
    user_id: uuid.UUID
    username: str
    college: str | None
    total_solved: int
    composite_score: float


class LeaderboardResponse(BaseModel):
    global_rank: list[LeaderboardEntry]
    college_rank: list[LeaderboardEntry] | None = None
