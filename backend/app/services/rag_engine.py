"""
app/services/rag_engine.py

RAG pipeline:
  1. Embed the user query with Gemini `text-embedding-004` (768-dim).
  2. Run a cosine-distance (`<=>`) nearest-neighbour search against the
     `interview_posts.embedding` pgvector column.
  3. Feed the top-K retrieved snippets as context to `gemini-2.5-flash`
     to produce a concise, structured answer grounded in that context.
"""
import logging

import google.generativeai as genai
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.interview import InterviewPost
from app.schemas.rag import RagSourceChunk

logger = logging.getLogger("industry_grade_ai.rag")

if settings.GEMINI_API_KEY:
    genai.configure(api_key=settings.GEMINI_API_KEY, transport="rest")


class RagError(Exception):
    pass


async def embed_text(text: str, task_type: str = "retrieval_query") -> list[float]:
    """Embed a piece of text into a 768-dim vector using Gemini."""
    if not settings.GEMINI_API_KEY:
        raise RagError("GEMINI_API_KEY is not configured on the server")

    try:
        genai.configure(api_key=settings.GEMINI_API_KEY, transport="rest")
        try:
            result = genai.embed_content(
                model=settings.GEMINI_EMBEDDING_MODEL,
                content=text,
                task_type=task_type,
                output_dimensionality=settings.EMBEDDING_DIM,
            )
        except Exception:
            # Fallback if model doesn't accept output_dimensionality parameter
            result = genai.embed_content(
                model=settings.GEMINI_EMBEDDING_MODEL,
                content=text,
                task_type=task_type,
            )
        embedding = result["embedding"]
        # Ensure exact embedding dimension if necessary
        if len(embedding) > settings.EMBEDDING_DIM:
            embedding = embedding[: settings.EMBEDDING_DIM]
        return embedding
    except Exception as exc:  # noqa: BLE001
        logger.exception("Gemini embedding failed")
        raise RagError(f"Embedding failed: {exc}") from exc


async def vector_search(
    db: AsyncSession, query_embedding: list[float], top_k: int = 3, company: str | None = None
) -> list[tuple[InterviewPost, float]]:
    """
    Cosine-distance nearest-neighbour search using pgvector's `<=>` operator.
    Returns [(InterviewPost, similarity_score), ...] sorted by similarity desc.
    """
    distance_expr = InterviewPost.embedding.cosine_distance(query_embedding)
    stmt = select(InterviewPost, distance_expr.label("distance")).order_by(distance_expr)

    if company:
        stmt = stmt.where(InterviewPost.company.ilike(f"%{company}%"))

    stmt = stmt.limit(top_k)
    rows = (await db.execute(stmt)).all()

    return [(post, round(1 - distance, 4)) for post, distance in rows]


def _build_prompt(query: str, chunks: list[tuple[InterviewPost, float]]) -> str:
    context_blocks = "\n\n".join(
        f"[Source {i+1} | {post.company} - {post.role} | similarity={sim}]\n{post.content}"
        for i, (post, sim) in enumerate(chunks)
    )
    return (
        "You are Industry Grade AI's career-intelligence assistant. Answer the "
        "user's question using ONLY the interview-experience context below. "
        "Be concise and structured (use short bullet points where helpful). "
        "If the context does not contain enough information, say so plainly "
        "instead of guessing.\n\n"
        f"CONTEXT:\n{context_blocks}\n\n"
        f"QUESTION: {query}\n\n"
        "ANSWER:"
    )


def _build_context_summary(query: str, chunks: list[tuple[InterviewPost, float]]) -> str:
    """Format an informative answer directly from retrieved chunks when LLM quota is limited."""
    summary_lines = [
        f"**Relevant Interview Intelligence for '{query}':**\n",
    ]
    for i, (post, sim) in enumerate(chunks, 1):
        similarity_pct = int(sim * 100)
        summary_lines.append(f"### {i}. {post.company} — {post.role} ({similarity_pct}% relevance)")
        summary_lines.append(post.content)
        summary_lines.append("")
    return "\n".join(summary_lines)


async def generate_answer(query: str, chunks: list[tuple[InterviewPost, float]]) -> str:
    if not settings.GEMINI_API_KEY:
        if chunks:
            return _build_context_summary(query, chunks)
        raise RagError("GEMINI_API_KEY is not configured on the server")
    
    genai.configure(api_key=settings.GEMINI_API_KEY, transport="rest")

    if not chunks:
        prompt = (
            "You are Industry Grade AI's career-intelligence assistant. "
            "The user asked an interview/career question, but no specific community interview post "
            "matched their query directly in the database. Provide a direct, highly structured, "
            "and expert answer to help them prepare (covering typical rounds, DSA topics, system design, "
            "and behavioral tips as relevant).\n\n"
            f"QUESTION: {query}\n\n"
            "ANSWER:"
        )
    else:
        prompt = _build_prompt(query, chunks)

    # Candidate models in order of priority (lite models have higher free quotas)
    candidate_models = [
        settings.GEMINI_GENERATION_MODEL,
        "models/gemini-3.1-flash-lite",
        "models/gemini-3.8-flash",
        "models/gemini-3.5-flash-lite",
    ]
    # Deduplicate while preserving order
    models_to_try = []
    for m in candidate_models:
        if m and m not in models_to_try:
            models_to_try.append(m)

    last_exc = None
    for model_name in models_to_try:
        try:
            model = genai.GenerativeModel(model_name)
            response = model.generate_content(prompt)
            if response and response.text:
                return response.text.strip()
        except Exception as exc:  # noqa: BLE001
            logger.warning("Generation with %s failed (%s), attempting fallback...", model_name, exc)
            last_exc = exc
            continue

    # Graceful fallback: synthesize directly from chunks if LLM calls hit rate limits
    if chunks:
        logger.info("Using context summary fallback due to LLM rate limits/errors")
        return _build_context_summary(query, chunks)

    logger.exception("All Gemini generation candidates failed")
    raise RagError(f"Answer generation temporarily busy or rate limited: {last_exc}")


async def run_rag_pipeline(
    db: AsyncSession, query: str, top_k: int = 3, company: str | None = None
) -> tuple[str, list[RagSourceChunk]]:
    query_vector = await embed_text(query)
    chunks = await vector_search(db, query_vector, top_k=top_k, company=company)
    answer = await generate_answer(query, chunks)

    sources = [
        RagSourceChunk(
            company=post.company,
            role=post.role,
            snippet=(post.content[:280] + "...") if len(post.content) > 280 else post.content,
            similarity=sim,
        )
        for post, sim in chunks
    ]
    return answer, sources
