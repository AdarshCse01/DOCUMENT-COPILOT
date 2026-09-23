from collections import defaultdict
from collections.abc import Sequence

from app.database.models.document_chunk import DocumentChunk


def reciprocal_rank_fusion(
    rankings: list[Sequence[DocumentChunk]], k: int = 60
) -> list[DocumentChunk]:
    """
    Combine multiple ranked lists of DocumentChunks using Reciprocal Rank Fusion.
    
    Each element in `rankings` is a sequence of chunks returned by a retriever.
    Scores are calculated as 1.0 / (k + rank).
    Chunks are deduped by ID and returned sorted by the highest fused score.
    """
    scores: dict[str, float] = defaultdict(float)
    chunk_map: dict[str, DocumentChunk] = {}

    for ranking in rankings:
        for rank, chunk in enumerate(ranking, start=1):
            chunk_id = str(chunk.id)
            scores[chunk_id] += 1.0 / (k + rank)
            if chunk_id not in chunk_map:
                chunk_map[chunk_id] = chunk

    # Sort chunk IDs by score descending
    sorted_ids = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    
    return [chunk_map[chunk_id] for chunk_id, _ in sorted_ids]
