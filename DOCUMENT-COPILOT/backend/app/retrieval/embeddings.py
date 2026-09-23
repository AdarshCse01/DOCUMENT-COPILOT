"""embeddings.py — OpenAI text-embedding-3-small batched embedding client."""

from __future__ import annotations

import time
from collections.abc import Sequence

from openai import OpenAI

from app.config import settings


class EmbeddingClient:
    """Generates 1536-dim vector embeddings using OpenAI's text-embedding-3-small."""

    def __init__(
        self,
        model_name: str | None = None,
        dimensions: int | None = None,
        max_retries: int = 3,
    ) -> None:
        self.model_name = model_name or settings.openai_embedding_model
        self.dimensions = dimensions or settings.openai_embedding_dimensions
        self.max_retries = max_retries
        self.client = OpenAI(api_key=settings.openai_api_key.get_secret_value())

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def embed(self, text: str) -> list[float]:
        """Embed a single text string. Raises on empty input."""
        text = text.strip()
        if not text:
            raise ValueError("Cannot embed empty text.")
        return self._call_api([text])[0]

    def embed_batch(
        self,
        texts: Sequence[str],
        batch_size: int = 100,
    ) -> list[list[float]]:
        """Embed multiple texts in batches. Returns embeddings in the same order."""
        if not texts:
            return []

        cleaned = [t.strip() or " " for t in texts]
        results: list[list[float]] = []

        for start in range(0, len(cleaned), batch_size):
            batch = cleaned[start : start + batch_size]
            results.extend(self._call_api(batch))

        return results

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _call_api(self, texts: list[str]) -> list[list[float]]:
        """Calls the OpenAI embeddings API with retry logic."""
        for attempt in range(1, self.max_retries + 1):
            try:
                response = self.client.embeddings.create(
                    input=texts,
                    model=self.model_name,
                )
                embeddings = [item.embedding for item in response.data]
                for emb in embeddings:
                    if len(emb) != self.dimensions:
                        raise ValueError(
                            f"Expected {self.dimensions} dimensions, got {len(emb)}"
                        )
                return embeddings
            except Exception as exc:
                err_msg = str(exc).lower()
                if "credit_balance_exhausted" in err_msg or "insufficient_quota" in err_msg or "401" in err_msg:
                    raise
                if attempt == self.max_retries:
                    raise
                time.sleep(2**attempt)

        raise RuntimeError("Embedding API call failed after retries.")
