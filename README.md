# Document Copilot

A full-stack GenAI application for analyzing SEC filings with verifiable citations.

![Status](https://img.shields.io/badge/Status-Live-brightgreen)
![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688)
![React](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB)
![Supabase](https://img.shields.io/badge/Database-Supabase-3ECF8E)
![OpenAI](https://img.shields.io/badge/LLM-OpenAI-412991)

## Live Demo

**[https://frontend-production-420b.up.railway.app](https://frontend-production-420b.up.railway.app)**

## Demo Access

You can try the live app without signing up using these demo credentials:

- **Email:** documentcopilot.demo@gmail.com
- **Password:** Demo@2026!Pass

> **Note:** This is a demo account for testing purposes only. Please do not use this password for any other service.

## Overview

Document Copilot is an AI-powered assistant that helps you analyze SEC 10-K filings from major companies like Apple, Microsoft, NVIDIA, and Amazon. Ask questions in natural language and get detailed, accurate answers backed by source citations.

Every answer is grounded in the actual SEC filing documents using a Retrieval-Augmented Generation (RAG) pipeline.

## Features

- **Natural Language Queries** — Ask questions about SEC filings in plain English
- **Detailed Answers** — Multi-paragraph responses with tables and bullet points
- **Inline Citations** — Every claim is backed by [1], [2], etc.
- **Source References** — Clickable source pills linking to specific filing sections
- **Real-time Search** — Fast hybrid retrieval using vector + full-text search
- **User Authentication** — Secure login via Supabase Auth
- **Chat History** — All conversations saved and accessible
- **Clean UI** — Minimal, modern interface inspired by the reference design

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| Backend | Python, FastAPI, Uvicorn |
| Frontend | React, Vite, TypeScript, Tailwind CSS, shadcn/ui |
| Database | Supabase (PostgreSQL + pgvector) |
| Auth | Supabase Auth |
| LLM | OpenAI GPT-4 |
| Embeddings | OpenAI text-embedding-3-small |
| Retrieval | Hybrid search (pgvector + Postgres full-text search) |
| Deployment | Railway |

## Architecture

User Query
    |
    v
Frontend (React + Vite)
    |
    v
Backend API (FastAPI)
    |
    v
Retrieval Layer
    |-- Vector Search (pgvector)
    |-- Full-Text Search (Postgres)
    |
    v
LLM (OpenAI GPT-4)
    |
    v
Answer + Citations
    |
    v
Frontend Display

## Project Structure

DOCUMENT-COPILOT/
├── backend/                  # FastAPI backend
│   ├── app/
│   │   ├── routes/          # API endpoints
│   │   ├── services/        # Business logic (retrieval, LLM)
│   │   ├── models/          # Data models
│   │   └── utils/           # Helper functions
│   ├── main.py              # Entry point
│   └── requirements.txt     # Python dependencies
│
├── frontend/                 # React frontend
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/           # Page components
│   │   ├── lib/             # Utilities and API client
│   │   └── App.tsx          # Main app component
│   ├── package.json
│   └── vite.config.ts
│
├── docs/                     # Documentation
│   ├── architecture.md
│   ├── backend-setup.md
│   ├── frontend-setup.md
│   └── railway-deployment.md
│
└── README.md

## Getting Started

### Prerequisites

- Node.js 20+
- Python 3.11+
- Supabase account
- OpenAI API key

### 1. Clone the Repository

git clone https://github.com/AdarshCse01/DOCUMENT-COPILOT.git
cd DOCUMENT-COPILOT

### 2. Backend Setup

cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt

Create a .env file in the backend folder:

OPENAI_API_KEY=your_openai_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_key

Run the backend:

uvicorn main:app --reload

Backend will be available at http://localhost:8000

### 3. Frontend Setup

cd frontend
npm install

Create a .env file in the frontend folder:

VITE_API_URL=http://localhost:8000
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

Run the frontend:

npm run dev

Frontend will be available at http://localhost:5173

## Deployment

This project is deployed on Railway with two separate services:

1. Frontend Service — Containerized React SPA served via Nginx
2. Backend Service — Containerized FastAPI service

Both services are connected to the same GitHub repository and auto-deploy on push to main.

For detailed deployment instructions, see docs/railway-deployment.md.

## Example Queries

Try asking:

- "Across Apple's 2021–2025 10-Ks, how did the revenue mix between iPhone, Services, Mac, iPad, and Wearables change?"
- "For Amazon, compare AWS operating income and margin against North America and International from 2021–2025."
- "How did NVIDIA describe demand drivers, customer concentration, and supply constraints for its Data Center business?"
- "Across Microsoft filings, what changed in how the company describes Azure, AI infrastructure, and cloud capacity constraints?"

## How It Works

1. Ingestion — SEC 10-K filings are chunked and embedded using OpenAI embeddings
2. Storage — Chunks are stored in Supabase with pgvector for semantic search
3. Query — User asks a question in natural language
4. Retrieval — Hybrid search finds the most relevant chunks (vector + full-text)
5. Generation — LLM generates a detailed answer using only retrieved context
6. Citations — Every claim is linked back to the source filing
7. Display — Frontend renders the answer with inline citations and source pills

## Contributing

This project was built as part of a full-stack GenAI learning journey. Contributions, issues, and feature requests are welcome!

## License

This project is open source and available under the MIT License.

## Author

**Adarsh Singh**

- GitHub: [@AdarshCse01](https://github.com/AdarshCse01)
- Email: dave@driftwood.com

## Acknowledgments

- Built following a full-stack GenAI tutorial
- Inspired by modern RAG architectures
- Powered by OpenAI, Supabase, and Railway

---

**If you found this project helpful, please give it a star!**
