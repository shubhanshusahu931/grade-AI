"""
app/services/rag_engine.py

RAG Pipeline powered by Google Gemini and PostgreSQL pgvector:
  1. Embeds user query with Gemini (models/gemini-embedding-001, 768-dim).
  2. Runs cosine distance search on uploaded PDF documents (RagDocumentChunk)
     and community interview posts (InterviewPost).
  3. Search Strategy:
     - If relevant document chunks exist above similarity threshold, synthesize
       grounded answer citing the uploaded knowledge documents.
     - If NO relevant document chunks exist (or similarity is below threshold),
       fallback directly to Google Gemini's broad programming & interview intelligence.
"""
from dataclasses import dataclass
import logging

import google.generativeai as genai
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.interview import InterviewPost
from app.models.rag_document import RagDocument, RagDocumentChunk
from app.schemas.rag import RagSourceChunk

logger = logging.getLogger("industry_grade_ai.rag")

SIMILARITY_THRESHOLD = 0.62


@dataclass
class RetrievedSnippet:
    source_title: str
    category: str
    content: str
    similarity: float
    is_pdf_document: bool


class RagError(Exception):
    pass


def _configure_gemini() -> None:
    if settings.GEMINI_API_KEY:
        genai.configure(api_key=settings.GEMINI_API_KEY, transport="rest")


async def embed_text(text: str, task_type: str = "retrieval_query") -> list[float]:
    """Embed a piece of text into a 768-dim vector using Gemini."""
    if not settings.GEMINI_API_KEY:
        raise RagError("GEMINI_API_KEY is not configured on the server")

    _configure_gemini()
    try:
        try:
            result = genai.embed_content(
                model=settings.GEMINI_EMBEDDING_MODEL,
                content=text,
                task_type=task_type,
                output_dimensionality=settings.EMBEDDING_DIM,
            )
        except Exception:
            result = genai.embed_content(
                model=settings.GEMINI_EMBEDDING_MODEL,
                content=text,
                task_type=task_type,
            )
        embedding = result["embedding"]
        if len(embedding) > settings.EMBEDDING_DIM:
            embedding = embedding[: settings.EMBEDDING_DIM]
        return embedding
    except Exception as exc:  # noqa: BLE001
        logger.exception("Gemini single embedding failed: %s", exc)
        raise RagError(f"Embedding failed: {exc}") from exc


async def embed_chunks_batch(
    chunks: list[str],
    batch_size: int = 10,
    task_type: str = "retrieval_document",
) -> list[list[float]]:
    """
    Embed multiple chunks in batches for fast PDF indexing.
    """
    if not settings.GEMINI_API_KEY:
        raise RagError("GEMINI_API_KEY is not configured on the server")

    _configure_gemini()
    all_embeddings: list[list[float]] = []

    for i in range(0, len(chunks), batch_size):
        batch = chunks[i : i + batch_size]
        try:
            try:
                res = genai.embed_content(
                    model=settings.GEMINI_EMBEDDING_MODEL,
                    content=batch,
                    task_type=task_type,
                    output_dimensionality=settings.EMBEDDING_DIM,
                )
            except Exception:
                res = genai.embed_content(
                    model=settings.GEMINI_EMBEDDING_MODEL,
                    content=batch,
                    task_type=task_type,
                )

            raw_embs = res["embedding"]
            # raw_embs can be list of vectors or single vector if 1 item
            if batch and isinstance(raw_embs[0], float):
                raw_embs = [raw_embs]

            for emb in raw_embs:
                if len(emb) > settings.EMBEDDING_DIM:
                    emb = emb[: settings.EMBEDDING_DIM]
                all_embeddings.append(emb)

        except Exception as exc:
            logger.warning("Batch embedding chunk %d..%d failed (%s), falling back one by one", i, i + len(batch), exc)
            # Fallback one by one
            for single_chunk in batch:
                single_emb = await embed_text(single_chunk, task_type=task_type)
                all_embeddings.append(single_emb)

    return all_embeddings


async def vector_search_all(
    db: AsyncSession,
    query_embedding: list[float],
    top_k: int = 4,
    company: str | None = None,
) -> list[RetrievedSnippet]:
    """
    Searches both uploaded PDF documents (RagDocumentChunk) and community posts (InterviewPost).
    Returns unified snippets sorted by similarity descending.
    """
    results: list[RetrievedSnippet] = []

    # 1. Search uploaded PDF document chunks
    try:
        dist_expr_pdf = RagDocumentChunk.embedding.cosine_distance(query_embedding)
        stmt_pdf = (
            select(RagDocumentChunk, RagDocument, dist_expr_pdf.label("distance"))
            .join(RagDocument, RagDocumentChunk.document_id == RagDocument.id)
            .order_by(dist_expr_pdf)
        )
        if company:
            stmt_pdf = stmt_pdf.where(
                or_(
                    RagDocument.category.ilike(f"%{company}%"),
                    RagDocument.title.ilike(f"%{company}%"),
                )
            )
        stmt_pdf = stmt_pdf.limit(top_k)
        pdf_rows = (await db.execute(stmt_pdf)).all()

        for chunk, doc, dist in pdf_rows:
            sim = round(max(0.0, 1.0 - float(dist)), 4)
            results.append(
                RetrievedSnippet(
                    source_title=doc.title,
                    category=doc.category,
                    content=chunk.content,
                    similarity=sim,
                    is_pdf_document=True,
                )
            )
    except Exception as exc:
        logger.warning("Search in RagDocumentChunk failed: %s", exc)

    # 2. Search community interview posts
    try:
        dist_expr_post = InterviewPost.embedding.cosine_distance(query_embedding)
        stmt_post = select(InterviewPost, dist_expr_post.label("distance")).order_by(dist_expr_post)
        if company:
            stmt_post = stmt_post.where(InterviewPost.company.ilike(f"%{company}%"))
        stmt_post = stmt_post.limit(top_k)
        post_rows = (await db.execute(stmt_post)).all()

        for post, dist in post_rows:
            sim = round(max(0.0, 1.0 - float(dist)), 4)
            results.append(
                RetrievedSnippet(
                    source_title=f"{post.company} ({post.role})",
                    category=post.company,
                    content=post.content,
                    similarity=sim,
                    is_pdf_document=False,
                )
            )
    except Exception as exc:
        logger.warning("Search in InterviewPost failed: %s", exc)

    # Sort all candidates by similarity desc and return top_k
    results.sort(key=lambda s: s.similarity, reverse=True)
    return results[:top_k]


def _build_context_summary(query: str, snippets: list[RetrievedSnippet]) -> str:
    """Fallback text summary when LLM calls are temporarily unavailable."""
    lines = [f"**Knowledge Base Intelligence for '{query}':**\n"]
    for i, s in enumerate(snippets, 1):
        lines.append(f"### {i}. {s.source_title} [{s.category}] — {int(s.similarity * 100)}% match")
        lines.append(s.content)
        lines.append("")
    return "\n".join(lines)


async def generate_gemini_response(prompt: str) -> str:
    """Executes Gemini generation with prioritized fallback models."""
    _configure_gemini()
    models_to_try = [
        settings.GEMINI_GENERATION_MODEL,
        "models/gemini-3.8-flash",
        "models/gemini-3.1-flash-lite",
        "models/gemini-flash-latest",
    ]

    # Deduplicate while preserving order
    candidates: list[str] = []
    for m in models_to_try:
        if m and m not in candidates:
            candidates.append(m)

    last_exc = None
    for model_name in candidates:
        try:
            model = genai.GenerativeModel(model_name)
            response = model.generate_content(prompt)
            if response and response.text:
                return response.text.strip()
        except Exception as exc:  # noqa: BLE001
            logger.warning("Generation with %s failed (%s), attempting next candidate...", model_name, exc)
            last_exc = exc
            continue

    raise RagError(f"Gemini generation temporarily unavailable: {last_exc}")


async def run_rag_pipeline(
    db: AsyncSession,
    query: str,
    top_k: int = 4,
    company: str | None = None,
) -> tuple[str, list[RagSourceChunk], str, bool]:
    """
    Main RAG orchestrator:
      1. Query vector search across uploaded documents and interview posts.
      2. If matching documents are found above SIMILARITY_THRESHOLD:
         - Uses uploaded documents as ground truth context with Gemini synthesis.
         - Returns (answer, sources, "knowledge_base", True).
      3. If NO matching documents or low similarity:
         - Falls back directly to Gemini API general intelligence.
         - Returns (answer, [fallback_source], "gemini_fallback", False).
    """
    # 1. Embed user query
    query_vector = await embed_text(query, task_type="retrieval_query")

    # 2. Vector search in database
    retrieved = await vector_search_all(db, query_vector, top_k=top_k, company=company)

    # 3. Filter by similarity threshold
    valid_snippets = [s for s in retrieved if s.similarity >= SIMILARITY_THRESHOLD]

    if valid_snippets:
        # Grounded in uploaded knowledge base documents!
        context_blocks = "\n\n".join(
            f"[Source {i+1} | {s.source_title} ({s.category}) | match={int(s.similarity * 100)}%]\n{s.content}"
            for i, s in enumerate(valid_snippets)
        )
        prompt = (
            "You are Industry Grade AI's Career Intelligence & Interview Advisor.\n"
            "The user asked a technical or career interview question. Answer it using the "
            "uploaded knowledge base documents and interview experiences provided below.\n"
            "Guidelines:\n"
            "- Structure your answer clearly with bullet points, headings, or code where relevant.\n"
            "- Accurately incorporate details and insights from the context documents.\n"
            "- If relevant, mention the document/company context.\n\n"
            f"KNOWLEDGE BASE CONTEXT:\n{context_blocks}\n\n"
            f"QUESTION: {query}\n\n"
            "ANSWER:"
        )

        try:
            answer = await generate_gemini_response(prompt)
        except Exception:
            # Fallback to direct context summary if LLM call hits unexpected limit
            answer = _build_context_summary(query, valid_snippets)

        sources = [
            RagSourceChunk(
                company=s.category or "Document",
                role="Uploaded Knowledge Base" if s.is_pdf_document else "Interview Post",
                snippet=(s.content[:300] + "...") if len(s.content) > 300 else s.content,
                similarity=s.similarity,
                document_title=s.source_title,
                category=s.category,
            )
            for s in valid_snippets
        ]
        return answer, sources, "knowledge_base", True

    # 4. Fallback directly to Gemini API General Intelligence!
    prompt_fallback = (
        "You are Industry Grade AI's Advanced Career & Technical Interview Advisor, powered by Google Gemini.\n"
        "(Note: The internal uploaded document repository does not contain specific material for this question. "
        "Answer directly from your expert computer science, competitive programming, and FAANG interview knowledge base.)\n\n"
        "Guidelines:\n"
        "- Provide a structured, highly actionable, and detailed answer.\n"
        "- Cover algorithms, DSA patterns, system architecture, or interview tips as appropriate.\n"
        "- Use clean Markdown formatting with bullet points and code snippets.\n\n"
        f"QUESTION: {query}\n\n"
        "ANSWER:"
    )

    try:
        answer = await generate_gemini_response(prompt_fallback)
    except Exception as exc:
        raise RagError(f"AI response generation failed: {exc}") from exc

    fallback_source = [
        RagSourceChunk(
            company="Google Gemini AI",
            role="General Technical Intelligence",
            snippet="Synthesized directly via Google Gemini AI (no specific uploaded document matched this query).",
            similarity=1.0,
            document_title="Gemini AI General Knowledge Base",
            category="Global Intelligence",
        )
    ]
    return answer, fallback_source, "gemini_fallback", False
