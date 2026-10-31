"""
app/api/deps.py

Shared FastAPI dependencies. `get_db` re-exports the session dependency;
`get_current_user` protects routes via `Authorization: Bearer <token>`.
"""
import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import TokenError, decode_access_token
from app.db.session import get_db
from app.models.user import User

__all__ = ["get_db", "get_current_user"]

bearer_scheme = HTTPBearer(auto_error=True)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(credentials.credentials)
        user_id = payload.get("sub")
        if user_id is None:
            raise credentials_exception
        user_uuid = uuid.UUID(user_id)
    except (TokenError, ValueError):
        raise credentials_exception

    # Eager-load handles/stats here: they're accessed later (e.g. in
    # /sync) as plain attributes, and lazy-loading a relationship on an
    # object bound to an AsyncSession outside of an awaited context raises
    # `MissingGreenlet`. Loading them up front avoids that crash entirely.
    result = await db.execute(
        select(User)
        .options(selectinload(User.handles), selectinload(User.stats))
        .where(User.id == user_uuid)
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception
    return user
