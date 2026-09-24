FROM python:3.12-slim

WORKDIR /app

# Install uv for fast, reliable dependency resolution
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Copy dependency definition files
COPY pyproject.toml uv.lock ./

# Install python dependencies without installing the project itself yet
RUN uv sync --frozen --no-install-project --no-dev

# Copy application source code
COPY . .

# Final sync including the project
RUN uv sync --frozen --no-dev

ENV PATH="/app/.venv/bin:$PATH"
ENV PORT=8000

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
