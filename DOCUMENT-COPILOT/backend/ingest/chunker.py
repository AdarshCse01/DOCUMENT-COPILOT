from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

from docling.chunking import HierarchicalChunker, HybridChunker
from docling.document_converter import DocumentConverter

from ingest.tokenizer import OpenAIBaseTokenizer

ChunkingStrategy = Literal["hybrid", "hierarchical"]


@dataclass
class ChunkRecord:
    """Normalized chunk data ready for embedding and database insertion."""

    chunk_index: int
    content: str
    token_count: int
    page: int | None
    section: str | None
    metadata_json: dict[str, Any]


class DocumentChunkingPipeline:
    """Processes Markdown documents into structured chunks using Docling."""

    def __init__(
        self,
        strategy: ChunkingStrategy = "hybrid",
        model_name: str = "text-embedding-3-small",
        max_tokens: int = 800,
    ) -> None:
        self.strategy = strategy
        self.model_name = model_name
        self.max_tokens = max_tokens
        self.tokenizer = OpenAIBaseTokenizer(model_name=model_name, max_tokens=max_tokens)
        self.converter = DocumentConverter()

        if strategy == "hybrid":
            self.chunker: HybridChunker | HierarchicalChunker = HybridChunker(
                tokenizer=self.tokenizer,
                max_tokens=max_tokens,
                repeat_table_header=True,
                merge_peers=True,
            )
        else:
            self.chunker = HierarchicalChunker(
                merge_list_items=True,
            )

    def _extract_page_number(self, chunk: Any) -> int | None:
        """Extracts page number from doc item provenance if available."""
        if hasattr(chunk.meta, "doc_items") and chunk.meta.doc_items:
            for item in chunk.meta.doc_items:
                if hasattr(item, "prov") and item.prov:
                    for p in item.prov:
                        if hasattr(p, "page_no") and p.page_no is not None:
                            return int(p.page_no)
        return None

    def chunk_markdown_file(
        self,
        file_path: Path | str,
        doc_metadata: dict[str, Any] | None = None,
    ) -> list[ChunkRecord]:
        """Converts a Markdown file to a Docling document and chunks it."""
        path = Path(file_path).resolve()
        if not path.exists():
            raise FileNotFoundError(f"Markdown file does not exist: {path}")

        conv_result = self.converter.convert(str(path))
        doc = conv_result.document
        return self.chunk_document(doc, doc_metadata=doc_metadata)

    def chunk_document(
        self,
        doc: Any,
        doc_metadata: dict[str, Any] | None = None,
    ) -> list[ChunkRecord]:
        """Chunks a DoclingDocument instance into a list of ChunkRecord objects."""
        base_meta = doc_metadata or {}
        raw_chunks = list(self.chunker.chunk(doc))
        records: list[ChunkRecord] = []

        for idx, raw_chunk in enumerate(raw_chunks):
            # Prefer contextualized text (includes heading breadcrumbs)
            try:
                content = self.chunker.contextualize(raw_chunk)
            except Exception:
                content = raw_chunk.text

            content = content.strip() if content else ""
            if not content:
                continue

            headings = (
                list(raw_chunk.meta.headings)
                if hasattr(raw_chunk.meta, "headings") and raw_chunk.meta.headings
                else []
            )
            section = " > ".join(headings) if headings else None
            page = self._extract_page_number(raw_chunk)
            token_count = self.tokenizer.count_tokens(content)

            chunk_meta = {
                **base_meta,
                "headings": headings,
                "section": section,
                "strategy": self.strategy,
                "model_name": self.model_name,
            }

            records.append(
                ChunkRecord(
                    chunk_index=idx,
                    content=content,
                    token_count=token_count,
                    page=page,
                    section=section[:255] if section else None,
                    metadata_json=chunk_meta,
                )
            )

        return records
