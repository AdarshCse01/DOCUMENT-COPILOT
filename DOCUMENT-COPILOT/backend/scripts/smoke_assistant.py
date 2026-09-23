"""Manual verification of grounded assistant answers for client-brief questions.

Supports single-query execution as well as concurrent parallel execution via asyncio.gather.
Fully compatible with both terminal and Jupyter Interactive Sessions.
"""

from __future__ import annotations

import asyncio
import logging
import os
import sys
import time
import uuid
from pathlib import Path

# Ensure backend root is on sys.path so app can always be imported directly
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# Enable nested event loop support for Jupyter Interactive Sessions
try:
    import nest_asyncio

    nest_asyncio.apply()
except ImportError:
    pass

# Configure root logger with force=True so Jupyter cells display real-time output
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
    handlers=[logging.StreamHandler(sys.stdout)],
    force=True,
)
logger = logging.getLogger("smoke_assistant")

from app.assistant.agent import GroundedAnswer, run_document_agent
from app.assistant.deps import DocumentAgentDeps, TurnRegistry
from app.config import settings
from app.database.session import SessionLocal
from app.grounding.validator import GroundingValidator
from app.retrieval.retriever import DocumentRetriever

# Ensure OpenAI API key is set in environment for OpenAI SDK / pydantic-ai
if settings.openai_api_key:
    os.environ["OPENAI_API_KEY"] = settings.openai_api_key.get_secret_value()

QUERIES: dict[str, str] = {
    "apple-mix": "Across Apple's 2021-2025 10-Ks, how did the revenue mix between iPhone, Services, Mac, iPad, and Wearables change?",
    "nvda-datacenter": "How did NVIDIA describe demand drivers for its Data Center business from fiscal 2021 through fiscal 2025?",
    "msft-azure": "Across Microsoft's 2021-2025 filings, what changed in the way the company describes Azure and AI infrastructure?",
    "q10-refusal": "Do the filings prove that generative AI improved margins for any of these companies?",
}

# =========================================================================
# CONTROLS
# =========================================================================
# QUERY_KEY: Which query to run when testing one at a time.
# Options: "apple-mix" | "nvda-datacenter" | "msft-azure" | "q10-refusal"
QUERY_KEY = "apple-mix"

# PARALLEL_ALL: If True, executes all 4 client-brief queries concurrently in
# parallel using asyncio.gather rather than one-by-one sequentially.
PARALLEL_ALL = False


async def _run_single(key: str, question: str) -> tuple[str, GroundedAnswer | None, float, str]:
    """Execute a single query with timer and error tracking."""
    tag = f"[{key}]"
    start_time = time.perf_counter()
    logger.info("%s Question: '%s'", tag, question)

    logger.info("%s Initializing database session and retriever...", tag)
    with SessionLocal() as session:
        registry = TurnRegistry()
        deps = DocumentAgentDeps(
            user_id=uuid.uuid4(),
            thread_id=uuid.uuid4(),
            session=session,
            retriever=DocumentRetriever(session=session),
            registry=registry,
        )

        logger.info("%s Calling Document Copilot Agent (%s)...", tag, settings.openai_chat_model)
        try:
            answer = await run_document_agent(question, deps=deps)
        except Exception as err:  # noqa: BLE001
            elapsed = time.perf_counter() - start_time
            logger.error("%s Agent execution failed after %.2fs: %s", tag, elapsed, err)
            return key, None, elapsed, f"FAILED: {err}"

        elapsed = time.perf_counter() - start_time
        logger.info("%s Agent finished in %.2fs. Answer preview: %s...", tag, elapsed, answer.answer[:120].replace("\n", " "))
        logger.info("%s Retrieved & attached %d citations.", tag, len(answer.citations))

        for i, c in enumerate(answer.citations, start=1):
            year_str = f" FY{c.year}" if c.year else ""
            page_str = f" p.{c.page}" if c.page is not None else ""
            logger.info("  %s Citation [%d] %s %s%s (%s)%s | Excerpt: '%s'", tag, i, c.ticker, c.form, year_str, c.filing_date, page_str, c.excerpt)

        logger.info("%s Validating citations with GroundingValidator...", tag)
        try:
            GroundingValidator().validate(answer, registry)
            validation_status = "PASSED"
            logger.info("%s [VALIDATION: PASSED] All citations verified against retrieved passages.", tag)
        except Exception as err:  # noqa: BLE001
            validation_status = f"FAILED: {err}"
            logger.error("%s [VALIDATION: FAILED] %s", tag, err)

        return key, answer, elapsed, validation_status


async def _run_queries(keys: list[str], parallel: bool = False) -> None:
    """Run one or more queries either in parallel or sequentially."""
    print("=" * 80, flush=True)
    if parallel:
        logger.info("PARALLEL OPTIMIZATION: Launching %d queries concurrently via asyncio.gather...", len(keys))
        tasks = [_run_single(k, QUERIES.get(k, k)) for k in keys]
        results = await asyncio.gather(*tasks)
    else:
        logger.info("SEQUENTIAL MODE: Executing %d query...", len(keys))
        results = []
        for k in keys:
            results.append(await _run_single(k, QUERIES.get(k, k)))

    print("\n" + "=" * 80, flush=True)
    logger.info("--- EXECUTION SUMMARY ---")
    print(f"{'Key':<18} | {'Status':<10} | {'Citations':<10} | {'Time (s)':<10} | {'Preview'}")
    print("-" * 80)
    for key, answer, elapsed, status in results:
        status_short = "PASSED" if status == "PASSED" else ("ERROR" if "FAILED" in status else "OK")
        c_count = len(answer.citations) if answer else 0
        preview = (answer.answer[:45] + "...") if answer else status[:45]
        print(f"{key:<18} | {status_short:<10} | {c_count:<10} | {elapsed:<10.2f} | {preview}")
    print("=" * 80 + "\n", flush=True)


def main(key: str = QUERY_KEY, run_all_parallel: bool = PARALLEL_ALL) -> None:
    """Run queries. Supports both single-query and parallel multi-query execution."""
    keys = list(QUERIES.keys()) if run_all_parallel else [key]

    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        # Inside Jupyter / IPython interactive session where event loop is active
        task = loop.create_task(_run_queries(keys, parallel=run_all_parallel))
        return task
    else:
        return asyncio.run(_run_queries(keys, parallel=run_all_parallel))


if __name__ == "__main__":
    main(QUERY_KEY, run_all_parallel=PARALLEL_ALL)
