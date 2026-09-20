#!/usr/bin/env bash
# Exit immediately if a command exits with a non-zero status
set -o errexit

echo "==> Installing Python dependencies..."
pip install -r requirements.txt

echo "==> Building React frontend..."
npm install
npm run build

echo "==> Build finished successfully! dist/ is ready for FastAPI."
