FROM python:3.11-slim

WORKDIR /app

# Install dependencies using pyproject.toml (layer-cached separately from source)
COPY pyproject.toml .
COPY backend/ backend/

RUN pip install --no-cache-dir .

EXPOSE 8000

# Use 4 workers for production throughput; Railway injects $PORT at runtime
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
