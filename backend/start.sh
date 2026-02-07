#!/bin/bash
# Start Chief Pipecat bot

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Load environment variables from parent .env.local
ENV_FILE="../.env.local"
if [ -f "$ENV_FILE" ]; then
    set -a
    source "$ENV_FILE"
    set +a
fi

# Use Python 3.13 (required by pipecat dependencies, 3.14 not supported)
PYTHON="/opt/homebrew/bin/python3.13"

# Activate virtual environment if it exists, or create it
if [ -d "venv" ]; then
    source venv/bin/activate
else
    echo "Creating virtual environment with Python 3.13..."
    $PYTHON -m venv venv
    source venv/bin/activate
    echo "Installing dependencies..."
    pip install -r requirements.txt
fi

# Run the bot using the venv's Python (unbuffered for immediate logging)
exec python -u chief_bot.py "$@" 2>&1 | tee -a /tmp/chief-bot.log
