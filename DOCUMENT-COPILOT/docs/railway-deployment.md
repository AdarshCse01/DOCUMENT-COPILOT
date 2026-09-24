# Railway Deployment Guide

This guide covers deploying Document Copilot to Railway using the containerized frontend and backend services.

## Overview

The deployment consists of two Railway services:
1. **Frontend Service:** Containerized React SPA built with Vite and served via Caddy 2 (`frontend/Dockerfile`).
2. **Backend Service:** Containerized FastAPI service powered by `uv` and Uvicorn (`backend/Dockerfile`).
3. **Database & Auth:** Hosted Supabase instance (PostgreSQL with `pgvector` and Supabase Auth).

---

## 1. Backend Service Deployment

1. Create a new service in Railway from your GitHub repo root pointing to the `/backend` directory (or Railway will detect `backend/Dockerfile`).
2. Set the **Root Directory** to `backend`.
3. Configure the following environment variables in Railway:
   - `DATABASE_URL`: Connection string to your hosted Supabase Postgres database (Transaction pooler or session mode).
   - `SUPABASE_URL`: Your Supabase project URL (e.g. `https://xyzcompany.supabase.co`).
   - `SUPABASE_ANON_KEY`: Supabase anon/public API key.
   - `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role secret key.
   - `OPENAI_API_KEY`: OpenAI API key for embeddings and GPT responses.
   - `ALLOWED_ORIGINS`: Comma-separated list including your Railway frontend domain (e.g. `https://your-frontend.up.railway.app,http://localhost:5173`).
   - `PORT`: `8000` (Railway automatically provides `PORT`).
4. Railway will build using `backend/Dockerfile` and start Uvicorn.

---

## 2. Frontend Service Deployment

1. Create a new service in Railway from your GitHub repo.
2. Set the **Root Directory** to `frontend`.
3. In the service settings, ensure Dockerfile deployment is selected (`frontend/Dockerfile`).
4. Set the **Build Arguments** (or Environment Variables):
   - `VITE_API_BASE_URL`: Public HTTPS URL of the Railway backend service (e.g. `https://your-backend.up.railway.app`).
   - `VITE_SUPABASE_URL`: Your Supabase project URL.
   - `VITE_SUPABASE_ANON_KEY`: Supabase anon/public API key.
5. Caddy serves the static production assets on port `3000` with automated SPA routing (`try_files {path} /index.html`) and gzip compression.

---

## 3. Database Migrations

Run Alembic migrations against the production database:
```bash
cd backend
alembic upgrade head
```
Or run the seed script if populating with the SEC 10-K corpus:
```bash
uv run python -m ingest.ingest_chunks
```
