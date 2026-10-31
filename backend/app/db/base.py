"""
app/db/base.py

Declarative base shared by every ORM model. Also serves as the single
import point that pulls all model modules into Base.metadata so
`create_all` / Alembic autogenerate can see every table.
"""
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Base class for all ORM models."""
    pass


def import_all_models() -> None:
    """Import every model module so they register on Base.metadata."""
    from app.models import user, handles, stats, interview, follow  # noqa: F401
