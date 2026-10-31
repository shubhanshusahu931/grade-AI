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
                ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(512),
                ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
        """))
        # Auto-migrate new platform handle columns on user_handles
        await conn.execute(text("""
            ALTER TABLE user_handles
                ADD COLUMN IF NOT EXISTS hackerearth VARCHAR(128),
                ADD COLUMN IF NOT EXISTS takeuforward VARCHAR(128),
                ADD COLUMN IF NOT EXISTS codingninjas VARCHAR(128);
        """))
        # Ensure RAG documents & chunks tables exist
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS rag_documents (
                id UUID PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                filename VARCHAR(255) NOT NULL,
                category VARCHAR(100) NOT NULL DEFAULT 'General',
                file_size INTEGER NOT NULL DEFAULT 0,
                total_chunks INTEGER NOT NULL DEFAULT 0,
                uploaded_by VARCHAR(150),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        """))
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS rag_document_chunks (
                id UUID PRIMARY KEY,
                document_id UUID NOT NULL REFERENCES rag_documents(id) ON DELETE CASCADE,
                chunk_index INTEGER NOT NULL,
                content TEXT NOT NULL,
                embedding vector(768),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        """))
        # High-performance indexes for fast ranking, lookups, and vector search
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_user_stats_score ON user_stats (composite_score DESC)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_users_college ON users (college)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON user_follows (follower_id)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_user_follows_following ON user_follows (following_id)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_rag_chunks_hnsw ON rag_document_chunks USING hnsw (embedding vector_cosine_ops)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_interview_hnsw ON interview_posts USING hnsw (embedding vector_cosine_ops)"))
        # Ensure initial superuser admin access exists
        await conn.execute(text("""
            UPDATE users SET is_admin = TRUE 
            WHERE email = 'shubhsahu931@gmail.com' 
               OR id = (SELECT id FROM users ORDER BY created_at ASC LIMIT 1);
        """))
