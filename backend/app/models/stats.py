"""app/models/stats.py"""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class UserStats(Base):
    __tablename__ = "user_stats"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True
    )

    total_solved: Mapped[int] = mapped_column(Integer, default=0)
    composite_score: Mapped[float] = mapped_column(Float, default=0.0, index=True)
    # Raw per-platform payload: {"codeforces": {...}, "leetcode": {...}, ...}
    platform_data: Mapped[dict] = mapped_column(JSONB, default=dict)
    last_synced_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    user: Mapped["User"] = relationship(back_populates="stats")
