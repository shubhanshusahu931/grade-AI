"""
app/db/session.py

Async SQLAlchemy 2.0 engine & session factory using the asyncpg driver
against PostgreSQL (with pgvector extension enabled).
"""
from collections.abc import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import settings
from app.db.base import Base, import_all_models

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

SessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields a DB session and guarantees cleanup."""
    async with SessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db() -> None:
    """
    Create the pgvector extension (if missing) and all tables.
    Intended for dev/demo bootstrap; use Alembic migrations in real production.
    """
    import_all_models()
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all)
        # Auto-migrate new profile & social columns if they do not exist
        await conn.execute(text("""
            ALTER TABLE users 
                ADD COLUMN IF NOT EXISTS bio TEXT,
                ADD COLUMN IF NOT EXISTS phone VARCHAR(32),
                ADD COLUMN IF NOT EXISTS github VARCHAR(255),
                ADD COLUMN IF NOT EXISTS linkedin VARCHAR(255),
                ADD COLUMN IF NOT EXISTS instagram VARCHAR(255),
                ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(512);
        """))
