from __future__ import annotations

import functools
from typing import Any

import tiktoken
from docling_core.transforms.chunker.tokenizer.base import BaseTokenizer
from pydantic import Field


@functools.lru_cache(maxsize=4)
def _get_cached_encoding(model_name: str) -> tiktoken.Encoding:
    try:
        return tiktoken.encoding_for_model(model_name)
    except KeyError:
        return tiktoken.get_encoding("cl100k_base")


class OpenAIBaseTokenizer(BaseTokenizer):
    """Docling-compatible BaseTokenizer backed by tiktoken for OpenAI embedding models."""

    model_name: str = Field(default="text-embedding-3-small")
    max_tokens: int = Field(default=8191)

    def count_tokens(self, text: str) -> int:
        enc = _get_cached_encoding(self.model_name)
        return len(enc.encode(text))

    def get_max_tokens(self) -> int:
        return self.max_tokens

    def get_tokenizer(self) -> Any:
        return _get_cached_encoding(self.model_name)
