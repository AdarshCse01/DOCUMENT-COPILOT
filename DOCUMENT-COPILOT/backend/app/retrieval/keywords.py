"""Keyword extraction and query formulation for PostgreSQL Full-Text Search."""

from __future__ import annotations

import functools
import re

import nltk
from nltk.corpus import stopwords


@functools.lru_cache(maxsize=1)
def get_nltk_stopwords() -> frozenset[str]:
    """Load standard NLTK English stopwords, downloading corpus if needed."""
    try:
        return frozenset(stopwords.words("english"))
    except LookupError:
        nltk.download("stopwords", quiet=True)
        return frozenset(stopwords.words("english"))


# SEC filing terminology and conversational analyst question filler words
SEC_QUESTION_FILLER_WORDS: frozenset[str] = frozenset({
    "across", "tell", "explain", "describe", "describes", "described",
    "change", "changed", "changes", "differ", "way", "filing", "filings",
    "10-k", "10-q", "10k", "10q", "10-ks", "10-qs", "10ks", "10qs", "sec",
    "annual", "report", "reports", "fiscal", "form", "forms",
    "year", "years", "between", "prove", "proven", "company", "companies",
    "show", "shows", "shown", "look", "looking", "compare", "compared",
    "much", "many", "find", "give", "per", "state", "stated", "states",
    "detail", "details", "discuss", "discusses", "discussed", "information",
    "according", "provide", "provides", "provided", "identify", "identifies",
})

# Combined stop words: NLTK English corpus + domain-specific SEC filing filler
QUERY_STOP_WORDS: frozenset[str] = get_nltk_stopwords() | SEC_QUESTION_FILLER_WORDS

# High-signal multi-word financial and tech phrases to preserve as exact units
COMMON_FINANCIAL_PHRASES: tuple[str, ...] = (
    "customer concentration",
    "demand drivers",
    "capacity constraints",
    "capital expenditures",
    "research and development",
    "share repurchase",
    "share repurchases",
    "cloud infrastructure",
    "ai infrastructure",
    "generative ai",
    "operating margin",
    "operating margins",
    "gross margin",
    "gross margins",
    "free cash flow",
    "cost of revenue",
    "cost of sales",
    "operating income",
    "revenue mix",
    "data center",
    "cash flow",
    "net sales",
    "product line",
    "product lines",
    "segment revenue",
)

# Known ticker to company aliases for disambiguation and deduplication
TICKER_COMPANY_MAP: dict[str, tuple[str, ...]] = {
    "AAPL": ("apple", "apple inc"),
    "NVDA": ("nvidia", "nvidia corp", "nvidia corporation"),
    "MSFT": ("microsoft", "microsoft corp", "microsoft corporation"),
    "AMZN": ("amazon", "amazon.com"),
    "GOOG": ("google", "alphabet"),
    "GOOGL": ("google", "alphabet"),
    "META": ("meta", "facebook"),
    "TSLA": ("tesla",),
}


def extract_search_keywords(
    query: str,
    max_terms: int = 5,
    ticker: str | None = None,
) -> list[str]:
    """Extract 3 to 5 high-signal search terms or phrases from a user query.

    1. Preserves multi-word financial/domain collocations (e.g. "data center").
    2. Strips conversational stop words (via NLTK), filing terminology, and year numbers.
    3. Retains high-signal entity/product names (e.g. iPhone, Azure, demand).
    4. When a ticker filter is present (e.g. AAPL), filters redundant company
       names to allocate keyword slots to specific topics/products.
    5. Returns a deduplicated list of 3–5 terms for full-text search.
    """
    if not query or not query.strip():
        return []

    query_lower = query.lower()
    extracted: list[str] = []

    # 1. Match known domain collocations first
    remaining = query
    for phrase in COMMON_FINANCIAL_PHRASES:
        if phrase in query_lower:
            extracted.append(f'"{phrase}"')
            pattern = re.compile(re.escape(phrase), re.IGNORECASE)
            remaining = pattern.sub(" ", remaining)
            query_lower = remaining.lower()
            if len(extracted) >= max_terms:
                return extracted

    # 2. Clean punctuation: possessives ('s), filing indicators (10-K, 10-Ks), years (FY24, 2021-2025)
    clean_text = re.sub(r"['’]s\b", "", remaining)
    clean_text = re.sub(r"\b10-?[kq]s?\b", " ", clean_text, flags=re.IGNORECASE)
    clean_text = re.sub(r"\b(fy\s?\d{2,4}|\d{4}[-\s]?\d{0,4})\b", " ", clean_text, flags=re.IGNORECASE)
    clean_text = re.sub(r"[^\w\s-]", " ", clean_text)

    # 3. Filter candidate words
    words = clean_text.split()
    candidates: list[str] = []

    # Identify redundant company names if ticker filter is active
    redundant_names: set[str] = set()
    if ticker:
        aliases = TICKER_COMPANY_MAP.get(ticker.upper(), ())
        for alias in aliases:
            redundant_names.update(alias.split())

    for w in words:
        cleaned = w.strip("-").strip()
        if not cleaned or len(cleaned) <= 1:
            continue
        lower = cleaned.lower()
        if lower in QUERY_STOP_WORDS:
            continue
        candidates.append(cleaned)

    # If we have enough candidate terms and a ticker filter is applied,
    # deprioritize redundant company names (e.g. "Apple" when ticker="AAPL")
    if redundant_names and (len(candidates) > 2 or (len(extracted) >= 2 and candidates)):
        non_redundant = [c for c in candidates if c.lower() not in redundant_names]
        if non_redundant:
            candidates = non_redundant

    # 4. Deduplicate while preserving order
    seen = {p.strip('"').lower() for p in extracted}
    for c in candidates:
        if c.lower() not in seen:
            seen.add(c.lower())
            extracted.append(c)
        if len(extracted) >= max_terms:
            break

    return extracted[:max_terms]


def build_fts_query_string(terms: list[str], mode: str = "AND") -> str:
    """Build a PostgreSQL websearch_to_tsquery compatible string from terms."""
    if not terms:
        return ""
    if mode.upper() == "OR":
        return " OR ".join(terms)
    return " ".join(terms)
