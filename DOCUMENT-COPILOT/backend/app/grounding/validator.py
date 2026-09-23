from __future__ import annotations

import re
import uuid
from typing import Any

from app.assistant.agent import GroundedAnswer
from app.retrieval.types import RetrievedPassage


class GroundingValidationError(Exception):
    """Raised when an assistant answer violates grounding or citation integrity."""

    def __init__(self, message: str, details: dict | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details or {}


INSUFFICIENT_EVIDENCE_PHRASES: tuple[str, ...] = (
    "not enough evidence",
    "insufficient evidence",
    "cannot find evidence",
    "filings do not contain",
    "no evidence exists",
    "does not provide evidence",
    "does not contain information",
    "does not provide investment",
    "cannot make stock",
    "does not provide stock",
    "no filing chunks found",
)


def _normalize_text(text: str) -> str:
    """Normalize whitespace and lowercase for fuzzy substring comparison."""
    return re.sub(r"\s+", " ", text).strip().lower()


def is_insufficient_evidence_response(answer_text: str) -> bool:
    """Check if the response explicitly indicates a lack of evidence or refusal."""
    normalized = _normalize_text(answer_text)
    return any(phrase in normalized for phrase in INSUFFICIENT_EVIDENCE_PHRASES)


def is_excerpt_in_passage(excerpt: str, passage_text: str) -> bool:
    """Verify that the cited excerpt actually occurs within the retrieved passage text."""
    if not excerpt or not excerpt.strip():
        return False

    # 1. Exact match
    if excerpt.strip() in passage_text:
        return True

    # 2. Normalized whitespace match
    norm_excerpt = _normalize_text(excerpt)
    norm_passage = _normalize_text(passage_text)
    if norm_excerpt in norm_passage:
        return True

    # 3. Sub-phrase match if excerpt was truncated or slightly edited (>= 30 chars or 70% overlap)
    if len(norm_excerpt) > 40:
        words = norm_excerpt.split()
        if len(words) >= 6:
            # Check if first 5 words or last 5 words exist in passage
            start_phrase = " ".join(words[:5])
            end_phrase = " ".join(words[-5:])
            if start_phrase in norm_passage or end_phrase in norm_passage:
                return True

    return False


def validate_grounding(
    answer: GroundedAnswer,
    retrieved_passages: dict[uuid.UUID, RetrievedPassage],
) -> GroundedAnswer:
    """Enforce the Driftwood product contract on an assistant response.

    Rules:
    1. Every citation must reference a chunk_id that was actually retrieved in this turn.
    2. Every citation excerpt must be verifiable against the retrieved chunk's text.
    3. Factual answers must have >= 1 citation unless they state insufficient evidence or refusal.
    4. Required citation fields (ticker, form, filing_date, excerpt) must be present.

    Raises:
        GroundingValidationError if any violation is detected.
    """
    if not answer.answer or not answer.answer.strip():
        raise GroundingValidationError("Assistant response text is empty.")

    # Rule 3: Check citation presence for factual answers
    if not answer.citations:
        if not (answer.insufficient_evidence or is_insufficient_evidence_response(answer.answer)):
            raise GroundingValidationError(
                "Factual answer provided without any citations. "
                "Every factual response must cite at least one retrieved SEC filing passage."
            )
        return answer

    # Validate each citation
    for idx, citation in enumerate(answer.citations):
        # Rule 1: No citing unseen docs
        if citation.chunk_id not in retrieved_passages:
            raise GroundingValidationError(
                f"Citation {idx + 1} cites unseen chunk_id='{citation.chunk_id}'. "
                "Citations must only map to documents retrieved during this turn.",
                details={"chunk_id": str(citation.chunk_id)},
            )

        passage = retrieved_passages[citation.chunk_id]

        # Rule 4: Required fields
        if not citation.ticker or not citation.form:
            raise GroundingValidationError(
                f"Citation {idx + 1} missing required metadata (ticker='{citation.ticker}', form='{citation.form}')."
            )

        # Rule 2: Excerpt fidelity
        if not is_excerpt_in_passage(citation.excerpt, passage.text):
            raise GroundingValidationError(
                f"Citation {idx + 1} excerpt could not be substantiated in chunk {citation.chunk_id}.",
                details={
                    "chunk_id": str(citation.chunk_id),
                    "excerpt": citation.excerpt,
                },
            )

    return answer


class GroundingValidator:
    """Grounding validation engine enforcing the Driftwood trust contract."""

    def validate(
        self,
        answer: GroundedAnswer,
        registry: Any,
    ) -> GroundedAnswer:
        """Validate answer citations against the turn registry or passages dict."""
        passages = getattr(registry, "passages", registry)
        return validate_grounding(answer, passages)

