"""app/api/v1/endpoints/rag.py - AI interview search (semantic search)."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.rag import RagSearchRequest, RagSearchResponse
from app.services.rag_engine import RagError, run_rag_pipeline

router = APIRouter(prefix="/rag", tags=["RAG"])


@router.post("/search", response_model=RagSearchResponse)
async def rag_search(
    payload: RagSearchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        answer, sources = await run_rag_pipeline(
            db, payload.query, top_k=payload.top_k, company=payload.company
        )
    except RagError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return RagSearchResponse(answer=answer, sources=sources)
