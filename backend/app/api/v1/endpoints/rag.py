"""app/api/v1/endpoints/rag.py - AI Career Intel & Knowledge Base RAG."""
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_admin_user, get_current_user, get_db
from app.models.rag_document import RagDocument, RagDocumentChunk
from app.models.user import User
from app.schemas.rag import (
    RagDocumentItem,
    RagDocumentUploadResponse,
    RagSearchRequest,
    RagSearchResponse,
)
from app.services.pdf_extractor import chunk_text, extract_text_from_bytes
from app.services.rag_engine import RagError, embed_chunks_batch, run_rag_pipeline

router = APIRouter(prefix="/rag", tags=["RAG"])


@router.post("/search", response_model=RagSearchResponse)
@router.post("/query", response_model=RagSearchResponse)
async def rag_search(
    payload: RagSearchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Query the AI Career Intel Engine:
      1. Performs vector search against internal knowledge base and PDF documents.
      2. If matches found: synthesizes answer grounded in the uploaded context.
      3. If no matches found: seamlessly falls back to Google Gemini general intelligence.
    """
    try:
        answer, sources, source_type, grounded = await run_rag_pipeline(
            db, payload.query, top_k=payload.top_k, company=payload.company
        )
    except RagError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"AI Search error: {exc}") from exc

    return RagSearchResponse(
        answer=answer,
        sources=sources,
        source_type=source_type,
        grounded=grounded,
    )


@router.get("/documents", response_model=list[RagDocumentItem])
async def list_rag_documents(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all uploaded RAG knowledge base documents."""
    stmt = select(RagDocument).order_by(RagDocument.created_at.desc())
    docs = (await db.scalars(stmt)).all()
    return [
        RagDocumentItem(
            id=d.id,
            title=d.title,
            filename=d.filename,
            category=d.category,
            file_size=d.file_size,
            total_chunks=d.total_chunks,
            uploaded_by=d.uploaded_by,
            created_at=d.created_at,
        )
        for d in docs
    ]


@router.post("/documents/upload", response_model=RagDocumentUploadResponse)
async def upload_rag_document(
    file: UploadFile = File(...),
    title: str = Form(None),
    category: str = Form("General"),
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_admin_user),
):
    """
    Upload and index any PDF (or text) document for RAG.
    Admin only:
      1. Extracts full text via PyMuPDF / pypdf.
      2. Chunks text into semantic segments.
      3. Generates 768-dim embeddings using Google Gemini.
      4. Saves document metadata and vectors in PostgreSQL pgvector.
    """
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No filename provided in upload",
        )

    filename = file.filename
    allowed_exts = (".pdf", ".txt", ".md", ".json", ".csv")
    if not filename.lower().endswith(allowed_exts):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type. Please upload a PDF document ({', '.join(allowed_exts)}).",
        )

    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty",
        )

    # Max 25 MB limit
    if len(file_bytes) > 25 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size exceeds maximum limit of 25 MB",
        )

    # 1. Extract text
    extracted_text = extract_text_from_bytes(file_bytes, filename)
    if not extracted_text or len(extracted_text.strip()) < 30:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No readable text found in document. Please verify it is a valid text/PDF document (not scanned image-only).",
        )

    # 2. Chunk text
    chunks = chunk_text(extracted_text, target_chunk_size=800, overlap=120, max_chunks=80)
    if not chunks:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to generate semantic chunks from document.",
        )

    # 3. Generate Gemini Embeddings
    try:
        embeddings = await embed_chunks_batch(chunks, batch_size=8, task_type="retrieval_document")
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to generate Gemini embeddings for document: {exc}",
        ) from exc

    # 4. Save to Database
    doc_title = (title or "").strip() or filename
    doc_category = (category or "General").strip() or "General"

    doc = RagDocument(
        title=doc_title,
        filename=filename,
        category=doc_category,
        file_size=len(file_bytes),
        total_chunks=len(chunks),
        uploaded_by=admin_user.username,
    )
    db.add(doc)
    await db.flush()

    for idx, (chunk_text_content, emb) in enumerate(zip(chunks, embeddings)):
        chunk_obj = RagDocumentChunk(
            document_id=doc.id,
            chunk_index=idx,
            content=chunk_text_content,
            embedding=emb,
        )
        db.add(chunk_obj)

    await db.commit()
    await db.refresh(doc)

    doc_item = RagDocumentItem(
        id=doc.id,
        title=doc.title,
        filename=doc.filename,
        category=doc.category,
        file_size=doc.file_size,
        total_chunks=doc.total_chunks,
        uploaded_by=doc.uploaded_by,
        created_at=doc.created_at,
    )

    return RagDocumentUploadResponse(
        message=f"Document '{doc.title}' uploaded and indexed with {len(chunks)} chunks embedded via Gemini.",
        document=doc_item,
        chunks_embedded=len(chunks),
    )


@router.delete("/documents/{document_id}")
async def delete_rag_document(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_admin_user),
):
    """Delete a document and all its embedded chunks from the RAG knowledge base. (Admin only)"""
    doc = await db.get(RagDocument, document_id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    title = doc.title
    await db.delete(doc)
    await db.commit()

    return {"message": f"Document '{title}' deleted successfully", "id": str(document_id)}
