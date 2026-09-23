"""Unit tests for keyword extraction, query formulation, and FTS integration."""

import uuid
from unittest.mock import MagicMock

from app.database.models.document_chunk import DocumentChunk
from app.retrieval.keywords import (
    build_fts_query_string,
    extract_search_keywords,
)
from app.retrieval.queries import keyword_search
from app.retrieval.retriever import DocumentRetriever


def test_extract_search_keywords_removes_stop_words() -> None:
    query = "Across Apple's filings, how did the revenue between products differ?"
    keywords = extract_search_keywords(query, max_terms=5)
    # Conversational stop words ('across', 'how', 'did', 'the', 'between', 'differ') must be removed
    for stop_word in ["across", "how", "did", "the", "between", "differ"]:
        assert stop_word not in [k.lower() for k in keywords]


def test_extract_search_keywords_removes_filing_indicators_and_years() -> None:
    query = "Across Apple's 2021-2025 10-Ks and 10-Q reports in FY24, show iPhone revenue"
    keywords = extract_search_keywords(query, max_terms=5)
    for indicator in ["10-k", "10-ks", "10k", "10-q", "fy24", "2021-2025", "reports", "show"]:
        assert indicator not in [k.lower() for k in keywords]
    assert "iPhone" in keywords
    assert "revenue" in keywords


def test_extract_search_keywords_preserves_financial_collocations() -> None:
    query = "How did NVIDIA describe demand drivers and customer concentration for its Data Center business?"
    keywords = extract_search_keywords(query, max_terms=5, ticker="NVDA")
    # Collocations must be extracted as quoted phrases
    assert '"data center"' in keywords
    assert '"demand drivers"' in keywords
    assert '"customer concentration"' in keywords
    assert 3 <= len(keywords) <= 5


def test_extract_search_keywords_ticker_awareness() -> None:
    query = "Across Apple's 10-Ks, how did the revenue mix between iPhone, Services, Mac, iPad, and Wearables change?"
    # When ticker is AAPL, 'Apple' is deprioritized to give slots to products
    keywords_with_ticker = extract_search_keywords(query, max_terms=5, ticker="AAPL")
    assert "Apple" not in keywords_with_ticker
    assert '"revenue mix"' in keywords_with_ticker
    assert "iPhone" in keywords_with_ticker
    assert "Services" in keywords_with_ticker
    assert len(keywords_with_ticker) == 5

    # When no ticker is provided, 'Apple' is kept as an entity search term
    keywords_no_ticker = extract_search_keywords(query, max_terms=5, ticker=None)
    assert "Apple" in keywords_no_ticker


def test_extract_search_keywords_term_count_capping() -> None:
    long_query = "What changed in Azure, AI infrastructure, cloud capacity constraints, server products, and enterprise security?"
    keywords = extract_search_keywords(long_query, max_terms=5)
    assert len(keywords) <= 5
    assert len(keywords) >= 3


def test_extract_search_keywords_empty_or_whitespace() -> None:
    assert extract_search_keywords("") == []
    assert extract_search_keywords("   ") == []
    assert extract_search_keywords("what is this and that") == []


def test_build_fts_query_string() -> None:
    terms = ['"data center"', "demand", "surge"]
    # AND mode
    and_query = build_fts_query_string(terms, mode="AND")
    assert and_query == '"data center" demand surge'

    # OR mode
    or_query = build_fts_query_string(terms, mode="OR")
    assert or_query == '"data center" OR demand OR surge'

    # Empty
    assert build_fts_query_string([]) == ""


def test_document_retriever_extract_keywords_method() -> None:
    retriever = DocumentRetriever(session=MagicMock(), embedder=MagicMock())
    keywords = retriever.extract_keywords(
        "What changed in Microsoft Azure and cloud capacity constraints?",
        ticker="MSFT",
    )
    assert isinstance(keywords, list)
    assert '"capacity constraints"' in keywords
    assert "Azure" in keywords


def test_keyword_search_with_explicit_keywords() -> None:
    mock_session = MagicMock()
    chunk = DocumentChunk(id=uuid.uuid4(), content="iPhone and Services revenue table")
    # Simulate DB returning results on scalars().all()
    mock_scalars = MagicMock()
    mock_scalars.all.return_value = [chunk]
    mock_session.scalars.return_value = mock_scalars

    results = keyword_search(
        session=mock_session,
        query_text="Dummy query",
        keywords=['"revenue mix"', "iPhone", "Services"],
        ticker="AAPL",
        limit=5,
    )
    assert len(results) == 1
    assert results[0].id == chunk.id
    mock_session.scalars.assert_called_once()
