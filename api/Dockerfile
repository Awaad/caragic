FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Copy lockfile and project descriptor first for layer caching
COPY pyproject.toml uv.lock* ./

# Install deps into a venv that lives inside the container
ENV UV_PROJECT_ENVIRONMENT=/app/.venv
RUN uv sync --frozen --no-install-project --no-dev

# Copy app code
COPY . .

# Install the project itself
RUN uv sync --frozen --no-dev

# Put venv on PATH
ENV PATH="/app/.venv/bin:$PATH"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]