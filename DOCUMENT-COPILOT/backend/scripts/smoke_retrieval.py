"""Print top retrieval hits for client-brief-style questions with keyword extraction diagnostics."""

import sys
from pathlib import Path

# Ensure backend root is on sys.path so app can always be imported directly
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.retrieval.keywords import build_fts_query_string
from app.retrieval.retriever import DocumentRetriever
from app.retrieval.types import SearchFilters, format_passages_for_agent

SMOKE_QUERIES: list[tuple[str, SearchFilters | None]] = [
    (
        "Across Apple's 10-Ks, how did the revenue mix between iPhone, Services, Mac, iPad, and Wearables change?",
        SearchFilters(ticker="AAPL", form="10-K"),
    ),
    (
        "How did NVIDIA describe demand drivers and customer concentration for its Data Center business?",
        SearchFilters(ticker="NVDA", form="10-K"),
    ),
    (
        "What changed in the way Microsoft describes Azure, AI infrastructure, and cloud capacity constraints?",
        SearchFilters(ticker="MSFT", form="10-K"),
    ),
]


def main() -> None:
    retriever = DocumentRetriever()
    for query, filters in SMOKE_QUERIES:
        print("\n" + "=" * 80)
        print(f"Query: {query}")
        ticker = filters.ticker if filters else None
        if filters is not None:
            print(f"Filters: {filters.model_dump_json()}")

        # Diagnostic keyword extraction step
        keywords = retriever.extract_keywords(query, ticker=ticker, max_terms=5)
        print(f"Extracted FTS Keywords (3-5 terms): {keywords}")
        print(f"  -> AND query: {build_fts_query_string(keywords, mode='AND')}")
        print(f"  -> OR  query: {build_fts_query_string(keywords, mode='OR')}")

        passages = retriever.search(query, filters=filters, top_k=5)
        print(f"\nRetrieved {len(passages)} passages:")
        print(format_passages_for_agent(passages))


if __name__ == "__main__":
    main()
