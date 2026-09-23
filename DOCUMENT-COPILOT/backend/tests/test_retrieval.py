import uuid
from unittest.mock import MagicMock, patch

from sqlalchemy import select

from app.database.models.document_chunk import DocumentChunk
from app.retrieval.fusion import reciprocal_rank_fusion
from app.retrieval.queries import apply_filters
from app.retrieval.retriever import HybridRetriever


def test_reciprocal_rank_fusion() -> None:
    # Create mock chunks
    chunk_a = DocumentChunk(id=uuid.uuid4(), content="A")
    chunk_b = DocumentChunk(id=uuid.uuid4(), content="B")
    chunk_c = DocumentChunk(id=uuid.uuid4(), content="C")

    # Semantic search puts A first, B second.
    ranking1 = [chunk_a, chunk_b]
    # Keyword search puts B first, C second, A third.
    ranking2 = [chunk_b, chunk_c, chunk_a]

    # Fusion
    fused = reciprocal_rank_fusion([ranking1, ranking2], k=60)

    assert len(fused) == 3
    # B has rank 2 and 1 -> score: 1/62 + 1/61 = 0.0161 + 0.0163 = 0.0324
    # A has rank 1 and 3 -> score: 1/61 + 1/63 = 0.0163 + 0.0158 = 0.0321
    # C has rank 2 -> score: 1/62 = 0.0161
    # Therefore order should be B, A, C
    assert fused[0].id == chunk_b.id
    assert fused[1].id == chunk_a.id
    assert fused[2].id == chunk_c.id


def test_apply_filters() -> None:
    stmt = select(DocumentChunk)
    
    # Apply no filters
    stmt_no_filters = apply_filters(stmt)
    # The statement should not have any joins
    assert "JOIN source_documents" not in str(stmt_no_filters)
    
    # Apply ticker filter
    stmt_ticker = apply_filters(stmt, ticker="AAPL")
    sql_ticker = str(stmt_ticker)
    assert "JOIN source_documents" in sql_ticker
    assert "source_documents.ticker =" in sql_ticker
    
    # Apply year filter
    stmt_year = apply_filters(stmt, year=2024)
    sql_year = str(stmt_year)
    assert "JOIN source_documents" in sql_year
    assert "source_documents.year =" in sql_year


@patch("app.retrieval.retriever.semantic_search")
@patch("app.retrieval.retriever.keyword_search")
def test_hybrid_retriever(mock_keyword, mock_semantic) -> None:
    mock_session = MagicMock()
    mock_embedder = MagicMock()
    mock_embedder.embed.return_value = [0.1] * 1536
    
    chunk = DocumentChunk(id=uuid.uuid4(), content="Test")
    mock_semantic.return_value = [chunk]
    mock_keyword.return_value = [chunk]
    
    retriever = HybridRetriever(session=mock_session, embedder=mock_embedder)
    
    results = retriever.search("Test query", ticker="AAPL", top_k=5, candidate_k=10)
    
    # Check embedder was called
    mock_embedder.embed.assert_called_once_with("Test query")
    
    # Check searches were called
    mock_semantic.assert_called_once()
    mock_keyword.assert_called_once()
    
    # Check results
    assert len(results) == 1
    assert results[0].id == chunk.id
