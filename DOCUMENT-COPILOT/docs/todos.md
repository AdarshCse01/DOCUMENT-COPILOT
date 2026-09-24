# Document Copilot — implementation checklist

Work **top to bottom**. Do not skip ahead to the LLM agent or citation UI until the earlier phase is done — later layers depend on earlier ones.

## How to sequence this (not "frontend vs backend")

Do **not** build the whole backend first, and do **not** polish the SPA first.

Document Copilot is a **grounded retrieval product**. The client brief succeeds only if an analyst can sign in, ask a filing question, and get a **cited, verifiable** answer. That requires a thin full-stack slice early, then a **backend-heavy** core (schema, ingest, retrieval, grounding), then frontend that makes trust visible.

Recommended rhythm for each phase:

1. Schema / API / pipeline on the backend (source of truth).
2. Smallest frontend that can exercise that API.
3. Check the phase "done when" before moving on.

Frontend without retrieval is a chatbot demo. Retrieval without a chat surface cannot be judged against the brief. Schema and auth unlock both.

**Already done (do not redo):** repo layout, agent notes, architecture, setup guides, sample EDGAR 10-Ks under `data/downloads/`, empty `backend/pyproject.toml`, `frontend/.npmrc` + env examples.

---

## Phase 0 — Accounts and local env

- [x] Create a hosted Supabase project (see `docs/guides/supabase-setup.md`).
- [x] Copy `backend/.env.example` → `backend/.env` and fill URL, anon key, service-role key, **direct** `DATABASE_URL` (not the pooler).
- [x] Copy `frontend/.env.example` → `frontend/.env` and fill `VITE_*` (anon key only — never service-role).
- [x] Create an OpenAI API key (needed from Phase 5 onward).
- [x] Confirm email auth is enabled; for local dev, disable "Confirm email" if you have no inbox flow yet.

**Done when:** both env files exist, Supabase project is healthy, you can open the dashboard.

---

## Phase 1 — Scaffold both apps (empty but runnable)

**Backend** (`docs/guides/backend-setup.md`):

- [x] `uv add` FastAPI, uvicorn, pydantic, pydantic-settings, httpx, structlog, openai, supabase, pydantic-ai, sqlalchemy, alembic, `psycopg[binary]`, pgvector; dev: pytest, ruff.
- [x] `app/config.py` as the only env reader; fail fast if required vars are missing.
- [x] `app/main.py` with a health route and CORS from `ALLOWED_ORIGINS`.
- [x] `uv run alembic init alembic`; wire `alembic/env.py` to app metadata + direct `DATABASE_URL`.
- [x] App starts: `uv run uvicorn app.main:app --reload`.
- [x] SQLAlchemy models in `app/database/models/`: `users`, `chat_threads`, `chat_messages`, `message_citations`, `source_documents`, `document_chunks`.
- [x] Autogenerate Alembic revision; **review** it.
- [x] Explicit migration ops: `vector` extension, `vector(1536)`, generated `tsvector`, HNSW + GIN indexes, RLS + policies.
- [x] `uv run alembic upgrade head` against Supabase.

**Frontend** (`docs/guides/frontend-setup.md`):

- [x] Vite + React + TypeScript + Tailwind + shadcn ([frontend-setup](guides/frontend-setup.md))
- [x] `src/lib/env.ts` — validate `VITE_API_BASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- [x] `src/lib/supabase.ts` — browser Supabase client
- [x] `src/lib/http.ts` + `src/lib/api.ts` — fetch wrapper with automatic bearer token

**Done when:** health endpoint and blank SPA both run locally. No product features yet.

---

## Phase 2 — Auth (full stack)

Nothing product-shaped should be unauthenticated.

**Backend:**

- [x] `app/auth/dependencies.py` — verify `Authorization: Bearer <supabase_jwt>`, expose `get_current_user`
- [x] Reject missing/expired tokens with `401` before any chat or retrieval work

**Frontend:**

- [x] Scaffold Vite + React + TypeScript + Tailwind + shadcn ([frontend-setup](guides/frontend-setup.md))
- [x] `src/lib/env.ts` — validate `VITE_API_BASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- [x] `src/lib/supabase.ts` — browser Supabase client
- [x] `src/lib/http.ts` + `src/lib/api.ts` — fetch wrapper with automatic bearer token
- [x] Sign-in / sign-up pages (email only, no SSO)
- [x] Protected routes — redirect unauthenticated users to login
- [x] Verify: sign up, sign in, token reaches backend on a test authenticated endpoint

**Done when:** you can sign in in the browser and a FastAPI route knows who you are.

---

## Phase 3 — Chat shell (vertical slice, stubbed)

Goal: end-to-end chat UI streaming from FastAPI, no real retrieval yet.

### Backend

- [x] Chat thread CRUD: list threads, create thread, load message history
- [x] `POST /chat/stream` — accepts AI SDK message format, streams a stubbed assistant reply
- [x] Persist user + assistant messages to `chat_messages` after stream completes
- [x] `403` when user accesses another user's thread

### Frontend

- [x] React Router: login, chat list, chat thread routes
- [x] AI SDK chat primitives pointed at `POST /chat/stream` with Supabase bearer token
- [x] Thread sidebar (past conversations)
- [x] Basic message list + input + streaming indicator
- [ ] Verify: create thread, send message, see streamed stub response, reload and see history

---

## Phase 4 — Ingestion pipeline

Goal: SEC filings in the corpus are parsed, chunked, embedded, and stored in Supabase.

- [x] `ingest/` scripts (or CLI entrypoint) for one-off corpus loading
- [x] HTML → normalized Markdown extraction (preserve page/section metadata)
- [x] Chunking strategy (size + overlap; store chunk index, page, section, ticker, filing type, year) 
- [x] Write `source_documents` rows with filing metadata from `manifest.json`
- [x] Write `document_chunks` rows with text + metadata
- [x] OpenAI embedding generation → store `vector(1536)` per chunk
- [x] Generated `tsvector` populated for full-text search
- [x] Idempotent re-run (skip already-ingested documents)
- [x] Unit tests: chunking logic, metadata extraction
- [ ] Run ingestion on full sample corpus (25 filings × 5 companies)
- [ ] Verify: chunks exist in Supabase; spot-check a known passage (e.g. Apple revenue mix table)

**Done when:** every sample filing has documents + chunks + embeddings you can query in SQL.

---

## Phase 5 — Retrieval

Goal: a user question returns ranked, relevant source passages.

- [x] `retrieval/queries.py` — pgvector semantic search over `document_chunks`
- [x] `retrieval/queries.py` — Postgres full-text search over `search_vector`
- [x] `retrieval/fusion.py` — Reciprocal Rank Fusion in Python
- [x] `retrieval/retriever.py` — query → fused ranked passages + neighbor chunks
- [x] Unit tests: fusion ranking, query assembly (mock DB)
- [x] Integration test (optional, `@pytest.mark.integration`): real query against ingested corpus
- [x] Verify: test queries from [client-brief](client-brief.md) return relevant chunks (manual or scripted)

**Done when:** a query like "Apple iPhone revenue mix" returns the right companies/years/sections without calling the chat LLM.

---

## Phase 6 — LLM agent & grounding

Goal: grounded answers with enforced citations — the core product contract.

- [x] `assistant/instructions.md` — product contract (cite everything, refuse to invent, no stock picks)
- [x] PydanticAI agent with typed deps (`DocumentAgentDeps`) and output (`GroundedAnswer`)
- [x] Agent tools: `search_filings`, `read_chunk`, `read_surrounding_chunks`
- [x] `chat/orchestrator.py` — one turn: retrieve -> agent -> validate -> stream -> persist
- [x] `grounding/validator.py` — every citation maps to a retrieved passage; fail closed on violation
- [x] `chat/streaming.py` — AI SDK-compatible stream (text deltas + citation metadata parts)
- [x] Persist `message_citations` linked to assistant messages
- [x] Unit tests: citation validation, grounding enforcement, message conversion
- [x] Verify against [client-brief example questions](client-brief.md#example-analyst-questions):
    - [x] Answers cite specific filings and pages
    - [x] Under-specified questions get "not enough evidence" responses
    - [x] Question 10 (generative AI margins) refuses to infer beyond filings

---

## Phase 7 — Trust UI (citations & source passages)

Goal: analysts can verify every claim in one click — this is what makes the product usable.

- [x] Citation chips/links on assistant messages (company, filing type, date, page/section)
- [x] Source passage panel — show underlying excerpt for selected citation
- [x] Empty states (no threads, no corpus match)
- [x] Error states (auth expired, retrieval failure, grounding failure, network/CORS)
- [x] Loading/streaming status during assistant run
- [x] Verify: click a citation -> see the exact passage from the filing

---

## Phase 8 — Pilot readiness

Goal: 5 senior analysts can use it for a week and report ≥3 hours saved per analyst per week.

- [x] README "Running locally" section — copy-paste commands for backend + frontend + env vars
- [x] Seed or document how to ingest/update the corpus
- [x] Smoke-test all 10 example questions from the client brief
- [x] Confirm chat history persists across sessions
- [x] Confirm ~40-user scale assumptions (no hardcoded single-user shortcuts)
- [x] Basic structured logging on backend (`structlog`) for debugging failed turns
- [x] Review latency: streaming starts within a few seconds for typical queries

---

## Phase 9 — Deployment (Railway)

- [ ] Railway: backend service (Uvicorn, env vars, `ALLOWED_ORIGINS`)
- [ ] Railway: frontend service (Vite build, `VITE_*` env vars at build time)
- [ ] Supabase: re-enable email confirmation for production if disabled during dev
- [ ] Run `alembic upgrade head` against production Supabase (direct connection)
- [ ] Production env: Supabase, OpenAI, CORS, email confirmations as needed.
- [ ] Backend stays stateless; all durable state in Supabase.
- [ ] Smoke-test sign-in + one cited question on the deployed URL.

**Done when:** a Driftwood email can use production without local Docker.

---

## Out of scope (do not put on the board)

Trading recommendations, news/alt-data, multi-tenant, billing, mobile app, Next.js/SSR, browser OpenAI calls, a separate vector DB.
