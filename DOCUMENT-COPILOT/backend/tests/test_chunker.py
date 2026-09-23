from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from ingest.chunker import DocumentChunkingPipeline
from ingest.embedder import EmbeddingClient
from ingest.tokenizer import OpenAIBaseTokenizer


def test_openai_base_tokenizer_counts_tokens() -> None:
    tokenizer = OpenAIBaseTokenizer(model_name="text-embedding-3-small", max_tokens=800)
    count = tokenizer.count_tokens("Hello world! This is an SEC filing test.")
    assert count > 0
    assert tokenizer.get_max_tokens() == 800
    assert tokenizer.get_tokenizer() is not None


def test_chunking_pipeline_hybrid_creates_records(tmp_path: Path) -> None:
    sample_md = tmp_path / "sample.md"
    sample_md.write_text(
        "# Item 1. Business\n\n"
        "Apple Inc. designs, manufactures and markets smartphones, personal computers, tablets, "
        "wearables and accessories, and sells a variety of related services.\n\n"
        "## Products\n\n"
        "iPhone is the Company's line of smartphones based on its iOS operating system.\n\n"
        "| Year | Revenue |\n"
        "|---|---|\n"
        "| 2024 | $391,035 |\n"
        "| 2023 | $383,285 |\n",
        encoding="utf-8",
    )

    pipeline = DocumentChunkingPipeline(strategy="hybrid", max_tokens=800)
    records = pipeline.chunk_markdown_file(
        sample_md,
        doc_metadata={"ticker": "AAPL", "year": 2024},
    )

    assert len(records) >= 1
    first = records[0]
    assert first.chunk_index == 0
    assert first.token_count > 0
    assert len(first.content) > 0
    assert first.metadata_json["ticker"] == "AAPL"
    assert first.metadata_json["year"] == 2024
    assert first.metadata_json["strategy"] == "hybrid"


def test_chunking_pipeline_hierarchical(tmp_path: Path) -> None:
    sample_md = tmp_path / "sample.md"
    sample_md.write_text(
        "# Heading 1\n\nFirst paragraph.\n\n# Heading 2\n\nSecond paragraph.",
        encoding="utf-8",
    )

    pipeline = DocumentChunkingPipeline(strategy="hierarchical")
    records = pipeline.chunk_markdown_file(sample_md)

    assert len(records) >= 1
    assert records[0].metadata_json["strategy"] == "hierarchical"


def test_embedding_client_embed_text_validates_dimensions() -> None:
    with patch("ingest.embedder.OpenAI") as mock_openai:
        mock_instance = MagicMock()
        mock_openai.return_value = mock_instance
        # Mock embedding return with 1536 floats
        mock_response = MagicMock()
        mock_response.data = [MagicMock(embedding=[0.01] * 1536)]
        mock_instance.embeddings.create.return_value = mock_response

        client = EmbeddingClient(model_name="text-embedding-3-small", expected_dimensions=1536)
        emb = client.embed_text("Sample text")

        assert len(emb) == 1536
        mock_instance.embeddings.create.assert_called_once()


def test_embedding_client_rejects_empty_text() -> None:
    with patch("ingest.embedder.OpenAI"):
        client = EmbeddingClient(model_name="text-embedding-3-small")
        with pytest.raises(ValueError, match="Cannot embed empty text"):
            client.embed_text("   ")
