#!/usr/bin/env bash
# Exit immediately if a command exits with a non-zero status
set -o errexit

echo "==> Installing Python backend dependencies..."
pip install -r requirements.txt

echo "==> Running database migrations via Alembic..."
alembic upgrade head

echo "==> Production Web Dashboard dist/ is verified and ready."
if [ ! -f "dist/index.html" ]; then
  echo "Error: dist/index.html is missing!"
  exit 1
fi

echo "==> Build complete! dist/ is ready for FastAPI to serve on Render."
