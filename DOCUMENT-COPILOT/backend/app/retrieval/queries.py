from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.database.models.document_chunk import DocumentChunk
from app.database.models.source_document import SourceDocument
from app.retrieval.keywords import build_fts_query_string, extract_search_keywords


def apply_filters(stmt, ticker: str | None = None, year: int | None = None):
    """Apply common filters to a query statement."""
    if ticker or year:
        stmt = stmt.join(SourceDocument, DocumentChunk.document_id == SourceDocument.id)
        if ticker:
            stmt = stmt.where(SourceDocument.ticker == ticker.upper())
        if year:
            stmt = stmt.where(SourceDocument.year == year)
    return stmt


def semantic_search(
    session: Session,
    query_embedding: list[float],
    limit: int = 50,
    ticker: str | None = None,
    year: int | None = None,
) -> Sequence[DocumentChunk]:
    """Search chunks using cosine distance (<->) on the pgvector embedding column."""
    stmt = select(DocumentChunk).order_by(
        DocumentChunk.embedding.cosine_distance(query_embedding)
    )
    stmt = apply_filters(stmt, ticker, year)
    stmt = stmt.limit(limit)
    return session.scalars(stmt).all()


def keyword_search(
    session: Session,
    query_text: str | list[str],
    limit: int = 50,
    ticker: str | None = None,
    year: int | None = None,
    keywords: list[str] | None = None,
) -> Sequence[DocumentChunk]:
    """Search chunks using Postgres full-text search with keyword extraction and fallback.

    Args:
        session: Active SQLAlchemy database session.
        query_text: Raw query text or pre-extracted list of terms.
        limit: Max candidates to retrieve.
        ticker: Optional company ticker filter.
        year: Optional fiscal year filter.
        keywords: Optional explicit list of extracted search keywords/collocations.
    """
    if keywords is not None:
        active_keywords = keywords
    elif isinstance(query_text, list):
        active_keywords = query_text
    else:
        active_keywords = extract_search_keywords(query_text, max_terms=5, ticker=ticker)

    if not active_keywords:
        raw_str = query_text if isinstance(query_text, str) else " ".join(query_text)
        and_query = raw_str
        or_query = raw_str
    else:
        and_query = build_fts_query_string(active_keywords, mode="AND")
        or_query = build_fts_query_string(active_keywords, mode="OR")

    # 1. Try strict AND query first
    tsquery = func.websearch_to_tsquery("english", and_query)
    stmt = select(DocumentChunk).where(
        DocumentChunk.search_vector.op("@@")(tsquery)
    ).order_by(
        func.ts_rank_cd(DocumentChunk.search_vector, tsquery).desc()
    )
    stmt = apply_filters(stmt, ticker, year)
    stmt = stmt.limit(limit)
    results = session.scalars(stmt).all()

    # 2. If strict AND returns 0 hits, fall back to OR query ranked by term proximity
    if not results and or_query != and_query:
        tsquery_or = func.websearch_to_tsquery("english", or_query)
        stmt_or = select(DocumentChunk).where(
            DocumentChunk.search_vector.op("@@")(tsquery_or)
        ).order_by(
            func.ts_rank_cd(DocumentChunk.search_vector, tsquery_or).desc()
        )
        stmt_or = apply_filters(stmt_or, ticker, year)
        stmt_or = stmt_or.limit(limit)
        results = session.scalars(stmt_or).all()

    return results


def get_chunk_by_id(session: Session, chunk_id) -> DocumentChunk | None:
    """Fetch a single chunk by ID with its parent SourceDocument loaded."""
    stmt = (
        select(DocumentChunk)
        .options(joinedload(DocumentChunk.document))
        .where(DocumentChunk.id == chunk_id)
    )
    return session.scalars(stmt).first()


def get_surrounding_chunks(
    session: Session, chunk_id, window: int = 1
) -> Sequence[DocumentChunk]:
    """Fetch neighboring chunks for context expansion around a given chunk ID."""
    base_chunk = session.get(DocumentChunk, chunk_id)
    if not base_chunk:
        return []

    stmt = (
        select(DocumentChunk)
        .options(joinedload(DocumentChunk.document))
        .where(
            DocumentChunk.document_id == base_chunk.document_id,
            DocumentChunk.chunk_index >= base_chunk.chunk_index - window,
            DocumentChunk.chunk_index <= base_chunk.chunk_index + window,
        )
        .order_by(DocumentChunk.chunk_index.asc())
    )
    return session.scalars(stmt).all()
