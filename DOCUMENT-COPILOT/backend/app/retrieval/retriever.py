import logging

from openai import OpenAIError
from sqlalchemy.orm import Session

from app.database.models.document_chunk import DocumentChunk
from app.database.session import SessionLocal
from app.retrieval.embeddings import EmbeddingClient
from app.retrieval.fusion import reciprocal_rank_fusion
from app.retrieval.keywords import extract_search_keywords
from app.retrieval.queries import keyword_search, semantic_search
from app.retrieval.types import SearchFilters

logger = logging.getLogger(__name__)


class DocumentRetriever:
    """
    Orchestrates hybrid search using pgvector (dense semantic) and Postgres full-text search (sparse lexical),
    fused with Reciprocal Rank Fusion (RRF).
    """

    def __init__(self, session: Session | None = None, embedder: EmbeddingClient | None = None):
        self.session = session or SessionLocal()
        self.embedder = embedder or EmbeddingClient()

    def extract_keywords(
        self, query: str, ticker: str | None = None, max_terms: int = 5
    ) -> list[str]:
        """Extract 3 to 5 high-signal search terms/collocations from a user query."""
        return extract_search_keywords(query, max_terms=max_terms, ticker=ticker)

    def search(
        self,
        query: str,
        filters: SearchFilters | None = None,
        ticker: str | None = None,
        year: int | None = None,
        top_k: int = 12,
        candidate_k: int = 60,
        match_count: int | None = None,
        keywords: list[str] | None = None,
    ) -> list[DocumentChunk]:
        """
        Executes a hybrid search query across the ingested corpus.

        Pipeline steps:
        1. Keyword Extraction: Extracts 3 to 5 high-signal terms/phrases for PostgreSQL FTS.
        2. Query Embedding: Embeds query using OpenAI text-embedding-3-small (with fallback).
        3. Dual Database Search: Runs semantic cosine distance and FTS tsquery in sequence.
        4. Reciprocal Rank Fusion: Combines ranked lists into unified scores.
        5. Top-K Selection: Returns the highest ranked chunks.
        """
        if filters is not None:
            if filters.ticker:
                ticker = filters.ticker
            if filters.fiscal_years:
                year = filters.fiscal_years[0]

        # 1. Keyword Extraction (3 to 5 high-signal terms/phrases)
        search_keywords = (
            keywords
            if keywords is not None
            else self.extract_keywords(query, ticker=ticker, max_terms=5)
        )

        effective_top_k = match_count if match_count is not None else top_k

        # 2. Query Embedding (Dense Semantic Search)
        semantic_results: list[DocumentChunk] = []
        try:
            query_embedding = self.embedder.embed(query)
            semantic_results = list(
                semantic_search(
                    self.session,
                    query_embedding,
                    limit=candidate_k,
                    match_count=candidate_k,
                    ticker=ticker,
                    year=year,
                )
            )
        except (OpenAIError, RuntimeError, ValueError, OSError) as exc:
            err_msg = str(exc)
            if "insufficient_quota" in err_msg or "credit_balance_exhausted" in err_msg:
                logger.info("Dense embedding skipped due to exhausted OpenAI quota; using PostgreSQL full-text search.")
            else:
                logger.warning("Dense embedding failed (%s); continuing with keyword search only.", exc)

        # 3. Full-Text Search (Sparse Lexical Search with AND -> OR fallback)
        keyword_results = list(
            keyword_search(
                self.session,
                query_text=query,
                limit=candidate_k,
                match_count=candidate_k,
                ticker=ticker,
                year=year,
                keywords=search_keywords,
            )
        )

        # 4. Reciprocal Rank Fusion (RRF)
        rankings = [r for r in [semantic_results, keyword_results] if r]
        if not rankings:
            return []
        fused_results = reciprocal_rank_fusion(rankings)

        # 5. Top-K Selection
        return fused_results[:effective_top_k]


HybridRetriever = DocumentRetriever
