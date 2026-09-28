#!/usr/bin/env bash
# Exit immediately if a command exits with a non-zero status
set -o errexit

echo "==> Installing Python backend dependencies..."
pip install -r requirements.txt

echo "==> Building React frontend dashboard..."
if command -v npm &> /dev/null; then
  npm install
  npm run build
fi

echo "==> Build complete! dist/ is ready for FastAPI to serve on Render."
