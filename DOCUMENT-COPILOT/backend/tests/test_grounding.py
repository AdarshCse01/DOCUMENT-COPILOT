import uuid
from datetime import date

import pytest

from app.assistant.agent import CitationItem, GroundedAnswer
from app.grounding.validator import (
    GroundingValidationError,
    is_excerpt_in_passage,
    is_insufficient_evidence_response,
    validate_grounding,
)
from app.retrieval.types import RetrievedPassage


def make_passage(
    chunk_id: uuid.UUID,
    text: str,
    ticker: str = "AAPL",
    page: int = 12,
    year: int = 2024,
) -> RetrievedPassage:
    return RetrievedPassage(
        chunk_id=chunk_id,
        document_id=uuid.uuid4(),
        chunk_index=0,
        text=text,
        page=page,
        section="Item 7. MD&A",
        fusion_score=0.05,
        ticker=ticker,
        company_name="Apple Inc.",
        form="10-K",
        filing_date=date(2024, 10, 31),
        fiscal_year=year,
        accession_number="0000320193-24-000106",
    )


def test_valid_grounded_answer() -> None:
    chunk_id = uuid.uuid4()
    passage_text = "Total net sales in 2024 were $391,035 million compared to $383,285 million in 2023."
    passages = {chunk_id: make_passage(chunk_id, passage_text)}

    answer = GroundedAnswer(
        answer="Apple reported total net sales of $391,035 million in fiscal year 2024.",
        citations=[
            CitationItem(
                chunk_id=chunk_id,
                ticker="AAPL",
                company="Apple Inc.",
                form="10-K",
                filing_date=date(2024, 10, 31),
                year=2024,
                page=12,
                excerpt="Total net sales in 2024 were $391,035 million compared to $383,285 million in 2023.",
            )
        ],
    )

    validated = validate_grounding(answer, passages)
    assert len(validated.citations) == 1
    assert validated.citations[0].ticker == "AAPL"


def test_unseen_chunk_id_fails_closed() -> None:
    seen_id = uuid.uuid4()
    unseen_id = uuid.uuid4()
    passages = {seen_id: make_passage(seen_id, "Some text here.")}

    answer = GroundedAnswer(
        answer="Apple grew its revenue by 10%.",
        citations=[
            CitationItem(
                chunk_id=unseen_id,
                ticker="AAPL",
                company="Apple Inc.",
                form="10-K",
                filing_date=date(2024, 10, 31),
                year=2024,
                excerpt="Some text here.",
            )
        ],
    )

    with pytest.raises(GroundingValidationError) as exc_info:
        validate_grounding(answer, passages)
    assert "cites unseen chunk_id" in str(exc_info.value)


def test_hallucinated_excerpt_fails_closed() -> None:
    chunk_id = uuid.uuid4()
    passage_text = "Services revenue increased 13% during 2024, driven by Advertising and Cloud Services."
    passages = {chunk_id: make_passage(chunk_id, passage_text)}

    answer = GroundedAnswer(
        answer="Apple stated generative AI drove 50% operating margins.",
        citations=[
            CitationItem(
                chunk_id=chunk_id,
                ticker="AAPL",
                company="Apple Inc.",
                form="10-K",
                filing_date=date(2024, 10, 31),
                year=2024,
                excerpt="generative AI drove 50% operating margins across all device categories.",
            )
        ],
    )

    with pytest.raises(GroundingValidationError) as exc_info:
        validate_grounding(answer, passages)
    assert "could not be substantiated" in str(exc_info.value)


def test_factual_answer_without_citations_fails_closed() -> None:
    chunk_id = uuid.uuid4()
    passages = {chunk_id: make_passage(chunk_id, "iPhone revenue was $200B.")}

    answer = GroundedAnswer(
        answer="iPhone revenue was $200B in 2024.",
        citations=[],
    )

    with pytest.raises(GroundingValidationError) as exc_info:
        validate_grounding(answer, passages)
    assert "Factual answer provided without any citations" in str(exc_info.value)


def test_insufficient_evidence_response_allowed_without_citations() -> None:
    passages = {}
    answer = GroundedAnswer(
        answer="There is not enough evidence in the available SEC filings to answer this question. Please provide more details.",
        citations=[],
    )

    validated = validate_grounding(answer, passages)
    assert len(validated.citations) == 0
    assert "not enough evidence" in validated.answer


def test_refusal_response_allowed_without_citations() -> None:
    passages = {}
    answer = GroundedAnswer(
        answer="Driftwood Copilot does not provide investment recommendations or stock picks.",
        citations=[],
    )

    validated = validate_grounding(answer, passages)
    assert len(validated.citations) == 0


def test_question_10_generative_ai_margins_refusal_allowed() -> None:
    chunk_id = uuid.uuid4()
    passage_text = "We continue to invest in generative artificial intelligence technologies."
    passages = {chunk_id: make_passage(chunk_id, passage_text)}

    answer = GroundedAnswer(
        answer="The filings do not contain evidence proving that generative AI improved margins for Microsoft. While the 10-K mentions ongoing investments in generative AI, it does not quantitatively link them to margin expansion.",
        citations=[],
    )

    validated = validate_grounding(answer, passages)
    assert len(validated.citations) == 0
    assert is_insufficient_evidence_response(answer.answer)


def test_normalized_excerpt_match() -> None:
    passage_text = "Net income   was  \n $93,736 million in \t 2024."
    excerpt = "Net income was $93,736 million in 2024."
    assert is_excerpt_in_passage(excerpt, passage_text)
