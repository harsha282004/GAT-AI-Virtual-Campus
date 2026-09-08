# Production / Railway image for the FastAPI backend.
#
# BUILD CONTEXT MUST BE THE REPOSITORY ROOT.
# Railway uses the repo root as the Docker build context, and
# docker-compose.yml already sets `context: .`. The running application
# imports scripts/ai/* and reads data/processed/, data/campus_spatial/ and
# data/chroma_db/ during startup (see backend/app/api/v1/chat.py's warmup),
# so all of them are copied into the image below.

FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HUB_DISABLE_TELEMETRY=1

WORKDIR /app

# --- Python dependencies (versions unchanged from requirements.txt) ---
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# --- Pre-cache the embedding model so the image is self-contained and
#     startup does not depend on Hugging Face network egress.
#     This is the exact model id the application already loads at runtime
#     (scripts/ai/_shared.py: EMBEDDING_MODEL_NAME = "all-MiniLM-L6-v2").
#     Only the on-disk HF cache is warmed here — no application code,
#     retrieval logic, or model choice is changed. ---
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

# The model is now baked into the image cache — run fully offline at runtime
# so startup never makes Hugging Face network calls (also cuts warmup time).
ENV HF_HUB_OFFLINE=1 \
    TRANSFORMERS_OFFLINE=1

# --- Application code ---
COPY backend/ ./backend/
COPY scripts/ ./scripts/

# --- RAG assets read at startup. These are copied AS-IS from the existing
#     local files — nothing is rebuilt, re-embedded, or regenerated. ---
COPY data/processed/ ./data/processed/
COPY data/campus_spatial/ ./data/campus_spatial/
COPY data/chroma_db/ ./data/chroma_db/

ENV PYTHONPATH=/app/backend

# Railway injects $PORT at runtime; the fallback keeps `docker run` working
# locally. Railway also overrides this via railway.json's startCommand.
EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --app-dir backend"]
