from __future__ import annotations

import time
from collections.abc import Sequence

from openai import OpenAI

from app.config import settings


class EmbeddingClient:
    """OpenAI vector embedding generation client with batching and validation."""

    def __init__(
        self,
        model_name: str | None = None,
        expected_dimensions: int | None = None,
        max_retries: int = 3,
        use_mock: bool = False,
    ) -> None:
        self.model_name = model_name or settings.openai_embedding_model
        self.expected_dimensions = expected_dimensions or settings.openai_embedding_dimensions
        self.max_retries = max_retries
        self.use_mock = use_mock
        if not use_mock:
            self.client = OpenAI(api_key=settings.openai_api_key.get_secret_value())

    def _generate_mock_embedding(self, text: str) -> list[float]:
        """Generates a deterministic normalized mock vector for testing without API cost."""
        import hashlib
        import math

        h = hashlib.sha256(text.encode("utf-8")).digest()
        # Seed pseudo-random values from hash
        raw = [(b / 255.0) * 2.0 - 1.0 for b in h]
        repeated = (raw * ((self.expected_dimensions // len(raw)) + 1))[: self.expected_dimensions]
        norm = math.sqrt(sum(x * x for x in repeated)) or 1.0
        return [x / norm for x in repeated]

    def embed_text(self, text: str) -> list[float]:
        """Generates an embedding vector for a single text."""
        cleaned = text.strip()
        if not cleaned:
            raise ValueError("Cannot embed empty text.")

        if self.use_mock:
            return self._generate_mock_embedding(cleaned)

        for attempt in range(1, self.max_retries + 1):
            try:
                response = self.client.embeddings.create(
                    input=cleaned,
                    model=self.model_name,
                )
                embedding = response.data[0].embedding
                if len(embedding) != self.expected_dimensions:
                    raise ValueError(
                        f"Expected embedding dimension {self.expected_dimensions}, got {len(embedding)}"
                    )
                return embedding
            except Exception:
                if attempt == self.max_retries:
                    raise
                wait_time = 2**attempt
                time.sleep(wait_time)

        raise RuntimeError("Failed to generate embedding after retries.")

    def embed_batch(
        self,
        texts: Sequence[str],
        batch_size: int = 100,
    ) -> list[list[float]]:
        """Generates embeddings for a sequence of texts in batches."""
        if not texts:
            return []

        if self.use_mock:
            return [self._generate_mock_embedding(t.strip() if t.strip() else " ") for t in texts]

        all_embeddings: list[list[float]] = []

        for i in range(0, len(texts), batch_size):
            batch = [t.strip() if t.strip() else " " for t in texts[i : i + batch_size]]

            for attempt in range(1, self.max_retries + 1):
                try:
                    response = self.client.embeddings.create(
                        input=batch,
                        model=self.model_name,
                    )
                    # OpenAI preserves ordering
                    batch_embeddings = [item.embedding for item in response.data]
                    for emb in batch_embeddings:
                        if len(emb) != self.expected_dimensions:
                            raise ValueError(
                                f"Expected embedding dimension {self.expected_dimensions}, got {len(emb)}"
                            )
                    all_embeddings.extend(batch_embeddings)
                    break
                except Exception:
                    if attempt == self.max_retries:
                        raise
                    wait_time = 2**attempt
                    time.sleep(wait_time)

        return all_embeddings
