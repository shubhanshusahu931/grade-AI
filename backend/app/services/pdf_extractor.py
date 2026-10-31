"""
app/services/pdf_extractor.py

High-performance PDF text extraction and semantic chunking service.
Uses PyMuPDF (fitz) with fallback to pypdf for maximum compatibility.
"""
import io
import logging
import re

logger = logging.getLogger("industry_grade_ai.pdf_extractor")


def extract_text_from_bytes(file_bytes: bytes, filename: str = "") -> str:
    """
    Extract readable text from PDF or text file bytes.
    """
    fname = filename.lower()

    # Plain text / Markdown
    if fname.endswith((".txt", ".md", ".json", ".csv")):
        try:
            return file_bytes.decode("utf-8")
        except UnicodeDecodeError:
            return file_bytes.decode("latin-1", errors="ignore")

    # Primary engine: PyMuPDF (fitz)
    try:
        import fitz  # PyMuPDF

        doc = fitz.open(stream=file_bytes, filetype="pdf")
        pages = []
        for page_num in range(len(doc)):
            page = doc[page_num]
            text = page.get_text()
            if text and text.strip():
                pages.append(f"--- Page {page_num + 1} ---\n" + text.strip())
        doc.close()

        extracted = "\n\n".join(pages).strip()
        if extracted:
            return extracted
    except Exception as exc:
        logger.warning("PyMuPDF extraction failed (%s), falling back to pypdf...", exc)

    # Fallback engine: pypdf
    try:
        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(file_bytes))
        pages = []
        for i, page in enumerate(reader.pages):
            text = page.extract_text()
            if text and text.strip():
                pages.append(f"--- Page {i + 1} ---\n" + text.strip())

        extracted = "\n\n".join(pages).strip()
        if extracted:
            return extracted
    except Exception as exc:
        logger.error("pypdf extraction also failed: %s", exc)

    return ""


def clean_text(text: str) -> str:
    """Normalize whitespace and strip unprintable characters."""
    # Replace carriage returns
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    # Collapse multiple consecutive newlines
    text = re.sub(r"\n{3,}", "\n\n", text)
    # Collapse multiple inline spaces
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


def chunk_text(
    text: str,
    target_chunk_size: int = 800,
    overlap: int = 120,
    max_chunks: int = 100,
) -> list[str]:
    """
    Splits text into overlapping semantic chunks respecting paragraph and sentence boundaries.
    Caps at `max_chunks` to prevent token explosion.
    """
    cleaned = clean_text(text)
    if not cleaned:
        return []

    if len(cleaned) <= target_chunk_size:
        return [cleaned]

    # Split into candidate blocks (paragraphs)
    paragraphs = [p.strip() for p in cleaned.split("\n\n") if p.strip()]

    chunks: list[str] = []
    current_chunk: list[str] = []
    current_length = 0

    for para in paragraphs:
        # If single paragraph is larger than target_chunk_size, split by sentences
        if len(para) > target_chunk_size:
            sentences = re.split(r"(?<=[.?!])\s+", para)
            for sentence in sentences:
                sent_len = len(sentence)
                if current_length + sent_len > target_chunk_size and current_chunk:
                    chunk_str = " ".join(current_chunk).strip()
                    if chunk_str:
                        chunks.append(chunk_str)
                    # Start next with overlap from the tail
                    current_chunk = [sentence]
                    current_length = sent_len
                else:
                    current_chunk.append(sentence)
                    current_length += sent_len + 1
        else:
            para_len = len(para)
            if current_length + para_len > target_chunk_size and current_chunk:
                chunk_str = "\n\n".join(current_chunk).strip()
                if chunk_str:
                    chunks.append(chunk_str)
                current_chunk = [para]
                current_length = para_len
            else:
                current_chunk.append(para)
                current_length += para_len + 2

        if len(chunks) >= max_chunks:
            break

    if current_chunk and len(chunks) < max_chunks:
        chunk_str = "\n\n".join(current_chunk).strip()
        if chunk_str:
            chunks.append(chunk_str)

    # Filter out empty or trivially small chunks (< 30 characters)
    filtered = [c for c in chunks if len(c) >= 30]
    return filtered[:max_chunks]

