# Railway Deployment Guide

This guide covers deploying Document Copilot to Railway using the containerized frontend and backend services.

## Overview

The deployment consists of two Railway services:
1. **Frontend Service:** Containerized React SPA built with Vite and served via Caddy 2 (`frontend/Dockerfile`).
2. **Backend Service:** Containerized FastAPI service powered by `uv` and Uvicorn (`backend/Dockerfile`).
3. **Database & Auth:** Hosted Supabase instance (PostgreSQL with `pgvector` and Supabase Auth).

## Deployment Methods

You can deploy to Railway using either **GitHub Integration (Automated)** or **Railway CLI**.

### Option A: GitHub Integration (Recommended & Currently Connected)
Whenever you push commits to `origin/main`, Railway automatically builds and deploys both services.

1. **Backend Service:**
   - **Root Directory:** `/DOCUMENT-COPILOT/backend` (or `backend`)
   - **Dockerfile:** `backend/Dockerfile`
   - **Port:** Bound to `$PORT` (Railway provides `PORT=8000` / `8080`)
   - **Environment Variables:**
     - `DATABASE_URL`: Connection string to your Supabase Postgres database.
     - `SUPABASE_URL`: Supabase project URL.
     - `SUPABASE_ANON_KEY`: Supabase anon/public API key.
     - `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role secret key.
     - `OPENAI_API_KEY`: OpenAI API key.
     - `ALLOWED_ORIGINS`: Comma-separated allowed CORS origins (e.g. `https://frontend-production-420b.up.railway.app,http://localhost:5173`).
2. **Frontend Service:**
   - **Root Directory:** `/DOCUMENT-COPILOT/frontend` (or `frontend`)
   - **Dockerfile:** `frontend/Dockerfile`
   - **Port:** Caddy serves on `$PORT` (`8080`).
   - **Networking:** Under service settings → Networking, the **Target Port** for `frontend-production-420b.up.railway.app` is set to `8080`.
   - **Environment Variables / Build Arguments:**
     - `VITE_API_BASE_URL`: Backend URL (e.g. `https://document-copilot-production-3f7c.up.railway.app`).
     - `VITE_SUPABASE_URL`: Supabase project URL.
     - `VITE_SUPABASE_ANON_KEY`: Supabase anon/public API key.

---

### Option B: Railway CLI Deployment (Manual Upload)
If you want to manually trigger deployments from your terminal without committing/pushing to GitHub:

1. Link to your Railway project:
   ```bash
   railway link 1889e3f1-32f2-44fb-ad06-ca37c3dee2c0
   ```
2. Deploy the backend service:
   ```bash
   railway up ./backend --path-as-root --service DOCUMENT-COPILOT --detach
   ```
3. Deploy the frontend service:
   ```bash
   railway up ./frontend --path-as-root --service frontend --detach
   ```

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
