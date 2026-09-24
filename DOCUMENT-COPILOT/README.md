# Document Copilot

An internal AI chatbot that lets analysts query a corpus of documents in plain English and get sourced, citable answers.

## The client

**Driftwood Capital** — fictional independent investment research firm. Their analysts spend half their week reading 10-Ks and 10-Qs before they can produce any original analysis. Document Copilot eats that intake work so they can skip straight to insight.

Full brief: [docs/client-brief.md](docs/client-brief.md)

## Stack

| Layer              | Choice                                               |
| ------------------ | ---------------------------------------------------- |
| Backend            | Python + FastAPI                                     |
| Frontend           | Vite + React SPA + TypeScript                        |
| Database           | Supabase Postgres (users, chats, documents, chunks)  |
| Migrations         | SQLAlchemy models + Alembic                          |
| Retrieval          | Supabase `pgvector` + Postgres full-text search      |
| Auth               | Supabase Auth (email only)                           |
| Hosting            | Railway                                              |
| LLM + embeddings   | OpenAI                                               |

## Repo layout

```text
document-copilot/
├── AGENTS.md           # agent instructions (read first)
├── README.md           # this file
├── data/               # local corpus + download script (payloads gitignored)
├── docs/
│   └── client-brief.md # the client one-pager
├── backend/            # FastAPI service
└── frontend/           # React SPA (Vite)
```

## Prerequisites

Install these before setting up `backend/` or `frontend/`:

| Tool | Version | Used for | Install |
| ---- | ------- | -------- | ------- |
| [Python](https://www.python.org/downloads/) | 3.12+ | Backend runtime | OS package manager or python.org |
| [uv](https://docs.astral.sh/uv/getting-started/installation/) | latest | Backend deps + `data/download.py` | `curl -LsSf https://astral.sh/uv/install.sh \| sh` |
| [Node.js](https://nodejs.org/) | 20+ (LTS) | Frontend toolchain | nodejs.org or `nvm install --lts` |
| [pnpm](https://pnpm.io/installation) | latest | Frontend package manager | `corepack enable && corepack prepare pnpm@latest --activate` |

You also need accounts/keys for external services once the app is wired up. Start with [docs/guides/supabase-setup.md](docs/guides/supabase-setup.md) (account + project), then create an [OpenAI API key](https://platform.openai.com/api-keys) when the LLM layer is wired up.

## Running locally

### 1. Environment variables

Copy the example env files:

```bash
# Backend env
cp backend/.env.example backend/.env

# Frontend env
cp frontend/.env.example frontend/.env
```

Fill in your `DATABASE_URL` (Supabase Postgres), `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `OPENAI_API_KEY`.

### 2. Backend service

```bash
cd backend
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --reload
```
API runs on `http://localhost:8000` (docs at `http://localhost:8000/docs`).

### 3. Frontend application

In a separate terminal:

```bash
cd frontend
pnpm install
pnpm dev
```
Client runs on `http://localhost:5173`.

---

## Corpus Ingestion & Updates

The sample corpus contains SEC 10-K filings for Apple (AAPL), Microsoft (MSFT), NVIDIA (NVDA), Amazon (AMZN), and Alphabet (GOOGL).

### 1. Download filings from SEC EDGAR

```bash
uv run data/download.py
```
Downloads filings into `data/downloads/` and generates `manifest.json`.

### 2. Seed source documents into Postgres

```bash
cd backend
uv run python -m ingest.seed_source_documents
```

### 3. Chunk and embed filings

```bash
cd backend
# Dry run to inspect chunking:
uv run python -m ingest.ingest_chunks --dry-run --ticker AAPL

# Full ingestion into pgvector:
uv run python -m ingest.ingest_chunks --strategy hybrid
```
