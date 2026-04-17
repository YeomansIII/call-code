#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR/.."

echo "=== Setting up Call Code ==="

# Python environment
echo "Setting up Python virtual environment..."
cd "$PROJECT_DIR"
python3 -m venv python/venv
source python/venv/bin/activate
pip install -r python/requirements.txt
deactivate
echo "Python setup complete."

# Swift STT binary
echo "Building Swift STT helper..."
"$SCRIPT_DIR/build-stt.sh"

# Environment file
if [ ! -f "$PROJECT_DIR/.env" ]; then
  cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
  echo "Created .env from .env.example — fill in your Discord credentials."
else
  echo ".env already exists, skipping."
fi

echo "=== Setup complete ==="
