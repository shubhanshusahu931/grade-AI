"""app/models/handles.py"""
import uuid

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class UserHandles(Base):
    __tablename__ = "user_handles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True
    )

    codeforces: Mapped[str | None] = mapped_column(String(128), nullable=True)
    leetcode: Mapped[str | None] = mapped_column(String(128), nullable=True)
    codechef: Mapped[str | None] = mapped_column(String(128), nullable=True)
    gfg: Mapped[str | None] = mapped_column(String(128), nullable=True)
    hackerrank: Mapped[str | None] = mapped_column(String(128), nullable=True)
    codetantra_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    codetantra_id: Mapped[str | None] = mapped_column(String(128), nullable=True)

    user: Mapped["User"] = relationship(back_populates="handles")
