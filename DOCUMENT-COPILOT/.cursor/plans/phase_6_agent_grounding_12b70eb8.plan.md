# Phase 6 — LLM Agent & Grounding Plan

## Overview
Grounded answers with enforced citations — the core product contract for Driftwood Capital Document Copilot.

---

### 1. Configuration (`backend/app/config.py`)

Add LLM settings (defaults overridable via `.env`):

| Setting | Default | Purpose |
| :--- | :--- | :--- |
| `openai_chat_model` | `gpt-4.1` | PydanticAI model string `openai:{model}` |
| `openai_agent_request_limit` | `20` | `UsageLimits(request_limit=...)` cap per turn |
| `openai_agent_temperature` | `0` | Deterministic analyst answers |

Mirror in `backend/.env.example`.

---

### 2. Product contract (`backend/app/assistant/instructions.md`)

Encode `docs/client-brief.md` trust rules as system instructions:

- Answer **only** from tool-retrieved filing passages
- Cite every factual claim with `[n]` markers matching `citation_index`
- If corpus lacks evidence → set `insufficient_evidence: true`, explain what's missing, **no fabricated citations**
- No stock picks, investment advice, or inference beyond filings (especially Q10-style margin causation)
- Corpus scope: S&P 500 10-K/10-Q, 2020–2025; pilot tickers AAPL, AMZN, GOOGL, MSFT, NVDA FY2021–2025
- Keep answers concise; prefer direct quotes in `excerpt` fields

Load file contents in `agent.py` at module init (same pattern as cookbook instructions string, but externalized markdown).

---

### 3. Turn Registry & Passages (`backend/app/retrieval/types.py`)

- `TurnRegistry`: In-memory registry holding all `RetrievedPassage` records fetched during the active turn.
- `format_passages_for_agent(passages)`: Formats retrieved chunks into structured prompt-ready blocks for LLM tools.

---

### 4. Grounded Agent & Tools (`backend/app/assistant/agent.py`)

- PydanticAI `Agent` with typed `DocumentAgentDeps(registry, retriever, session)`.
- Structured output: `GroundedAnswer(answer, citations, insufficient_evidence)`.
- Tools:
  - `search_filings(query, ticker, year, top_k)`: hybrid search registering chunks into `TurnRegistry`.
  - `read_chunk(chunk_id)`: fetches full text and registers chunk.
  - `read_surrounding_chunks(chunk_id, window)`: fetches neighboring chunks for context expansion.

---

### 5. Grounding Validator (`backend/app/grounding/validator.py`)

- Fail-closed citation validation against `TurnRegistry`.
- Checks:
  1. Every citation must map to a retrieved chunk in `TurnRegistry`.
  2. Every citation excerpt must be verifiable in the chunk text.
  3. `insufficient_evidence=False`: requires ≥1 verified citation.
  4. `insufficient_evidence=True`: requires 0 citations and clear missing evidence explanation.
- On failure: orchestrator emits AI SDK `{"type":"error","errorText":"..."}` SSE event and **does not persist**.

---

### 6. Chat Orchestrator (`backend/app/chat/orchestrator.py`)

Single entry point replacing the stub path:

```python
async def run_turn(
    *,
    client: AsyncClient,
    thread_id: UUID,
    user: CurrentUser,
    user_message: UIMessage,
    thread_title: str,
    retriever: DocumentRetriever,
) -> AsyncIterator[str]:
```

**Algorithm:**
1. Build `TurnRegistry` + `DocumentAgentDeps`.
2. Extract user query text from message parts.
3. `grounded = await asyncio.to_thread(run_document_agent, query, deps)` (or `await doc_agent.run(...)`).
4. `result = validator.validate(grounded, registry)` — return error stream if not `result.ok`.
5. Yield grounded SSE events (text + citations) via streaming helper.
6. `await append_grounded_turn(...)` in finally only on success.

Wire in `backend/app/api/chat.py`: swap `stream_stub_and_persist` → `run_turn`. Instantiate `DocumentRetriever()` once per request (or via FastAPI dependency).

---

### 7. Streaming & Persistence

- **Streaming (`backend/app/chat/streaming.py`)**: AI SDK Data Stream protocol (`0:...` text deltas, `2:...` citation data parts, `d:...` finish metadata).
- **Persistence (`backend/app/database/chats.py`)**: `create_message_citations` storing normalized citations in PostgreSQL `message_citations` table linked to assistant message.
