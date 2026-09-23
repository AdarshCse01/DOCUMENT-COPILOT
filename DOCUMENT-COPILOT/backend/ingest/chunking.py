"""chunking.py — Docling HTML → DoclingDocument → HybridChunker pipeline.

Reads the original SEC 10-K HTML files (not the pre-converted Markdown)
and chunks them cleanly using Docling's HybridChunker with an OpenAI-compatible
tokenizer to stay within the text-embedding-3-small context window.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal

import tiktoken
from docling.chunking import HierarchicalChunker, HybridChunker
from docling.document_converter import DocumentConverter
from docling_core.transforms.chunker.tokenizer.base import BaseTokenizer

ChunkingStrategy = Literal["hybrid", "hierarchical"]

# ---------------------------------------------------------------------------
# Tokenizer
# ---------------------------------------------------------------------------

_ENCODING_CACHE: dict[str, tiktoken.Encoding] = {}


def _get_encoding(model_name: str) -> tiktoken.Encoding:
    if model_name not in _ENCODING_CACHE:
        try:
            _ENCODING_CACHE[model_name] = tiktoken.encoding_for_model(model_name)
        except KeyError:
            _ENCODING_CACHE[model_name] = tiktoken.get_encoding("cl100k_base")
    return _ENCODING_CACHE[model_name]


class OpenAITokenizer(BaseTokenizer):
    """Docling-compatible tokenizer using tiktoken for OpenAI embedding models."""

    model_name: str = "text-embedding-3-small"
    max_tokens: int = 8191

    def count_tokens(self, text: str) -> int:
        return len(_get_encoding(self.model_name).encode(text))

    def get_max_tokens(self) -> int:
        return self.max_tokens

    def get_tokenizer(self) -> Any:
        return _get_encoding(self.model_name)


# ---------------------------------------------------------------------------
# Chunk record
# ---------------------------------------------------------------------------


@dataclass
class ChunkRecord:
    """One retrieval-ready chunk, ready for embedding and DB insertion."""

    chunk_index: int
    content: str
    token_count: int
    page: int | None
    section: str | None
    metadata_json: dict[str, Any] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Pipeline
# ---------------------------------------------------------------------------


class ChunkingPipeline:
    """Converts an SEC 10-K HTML file into clean ChunkRecords using Docling."""

    def __init__(
        self,
        strategy: ChunkingStrategy = "hybrid",
        embedding_model: str = "text-embedding-3-small",
        max_tokens: int = 800,
    ) -> None:
        self.strategy = strategy
        self.embedding_model = embedding_model
        self.max_tokens = max_tokens

        self._tokenizer = OpenAITokenizer(model_name=embedding_model, max_tokens=max_tokens)
        self._converter = DocumentConverter()

        if strategy == "hybrid":
            self._chunker: HybridChunker | HierarchicalChunker = HybridChunker(
                tokenizer=self._tokenizer,
                max_tokens=max_tokens,
                repeat_table_header=True,
                merge_peers=True,
            )
        else:
            self._chunker = HierarchicalChunker(merge_list_items=True)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def chunk_html_file(
        self,
        html_path: Path | str,
        doc_metadata: dict[str, Any] | None = None,
    ) -> list[ChunkRecord]:
        """Convert an HTML file → DoclingDocument → list of ChunkRecord."""
        path = Path(html_path).resolve()
        if not path.exists():
            raise FileNotFoundError(f"HTML file not found: {path}")

        result = self._converter.convert(str(path))
        return self._chunk_doc(result.document, doc_metadata=doc_metadata)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _extract_page(self, chunk: Any) -> int | None:
        try:
            for item in chunk.meta.doc_items:
                for prov in item.prov:
                    if prov.page_no is not None:
                        return int(prov.page_no)
        except Exception:
            pass
        return None

    def _chunk_doc(
        self,
        doc: Any,
        doc_metadata: dict[str, Any] | None = None,
    ) -> list[ChunkRecord]:
        base_meta = doc_metadata or {}
        records: list[ChunkRecord] = []

        for idx, raw in enumerate(self._chunker.chunk(doc)):
            # contextualize() prepends heading breadcrumbs for better retrieval
            try:
                content = self._chunker.contextualize(raw)
            except Exception:
                content = raw.text

            content = (content or "").strip()
            if not content:
                continue

            headings: list[str] = []
            try:
                if raw.meta.headings:
                    headings = list(raw.meta.headings)
            except Exception:
                pass

            section = " > ".join(headings) if headings else None
            page = self._extract_page(raw)
            token_count = self._tokenizer.count_tokens(content)

            records.append(
                ChunkRecord(
                    chunk_index=idx,
                    content=content,
                    token_count=token_count,
                    page=page,
                    section=section[:255] if section else None,
                    metadata_json={
                        **base_meta,
                        "headings": headings,
                        "section": section,
                        "strategy": self.strategy,
                        "embedding_model": self.embedding_model,
                    },
                )
            )

        return records
