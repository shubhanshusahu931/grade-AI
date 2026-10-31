"""
app/api/v1/router.py

Aggregates every v1 endpoint router into a single APIRouter mounted at
/api/v1 by main.py -- keeps main.py free of per-feature import clutter.
"""
from fastapi import APIRouter

from app.api.v1.endpoints import admin, auth, leaderboard, rag, sync, users

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(admin.router)
api_router.include_router(sync.router)
api_router.include_router(leaderboard.router)
api_router.include_router(rag.router)
