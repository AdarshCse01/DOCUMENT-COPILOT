# Document Copilot Backend

FastAPI service powering ingestion, retrieval, grounding, and chat orchestration.

## Quick Start

### 1. Environment & Dependencies

From the `backend/` directory:

```bash
# Copy and configure environment variables
cp .env.example .env

# Install dependencies and editable app package
uv sync
```

### 2. Run the Development Server

```bash
# Recommended (with live reload)
uv run uvicorn app.main:app --reload

# Or direct execution
uv run python app/main.py
```

The API will be available at `http://localhost:8000`. Health check: `http://localhost:8000/health`.

### 3. Testing & Linting

```bash
# Run test suite
uv run pytest

# Run linter
uv run ruff check .

# Auto-fix lint issues
uv run ruff check --fix .
```

### 4. Database Migrations (Alembic)

```bash
# Initialize Alembic (one-time setup)
uv run alembic init alembic

# Create a migration after updating models
uv run alembic revision --autogenerate -m "migration name"

# Apply migrations to database
uv run alembic upgrade head
```

### 5. Jupyter Kernel (Notebooks & Interactive Window)

Register the backend virtual environment for IDE interactive windows:

```bash
uv run python -m ipykernel install --user --name document-copilot-backend --display-name "Document Copilot Backend"
```
