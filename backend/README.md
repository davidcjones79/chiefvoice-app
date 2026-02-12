# Chief Backend (Pipecat Bot)

Voice bot powered by Pipecat, Daily.co, Deepgram STT, and OpenAI/ElevenLabs TTS.

## Requirements

- **Python 3.13 or earlier** (3.14 is NOT supported due to `numba` dependency)
- Dependencies are installed automatically on first run

## How it works

1. The Next.js frontend calls `/api/pipecat/room` to start a call
2. The API spawns `start.sh` which:
   - Creates a Python 3.13 virtual environment (if not exists)
   - Installs dependencies from `requirements.txt`
   - Runs `chief_bot.py` with the room URL and call ID

## Important Notes

### Virtual Environment

- The `venv/` directory is created automatically on first bot start
- It uses `/opt/homebrew/bin/python3.13` to create the venv
- **Do not delete `venv/` unless you want to reinstall all dependencies**
- `venv/` is gitignored and should never be committed

### TTS Provider

The TTS provider (OpenAI or ElevenLabs) is set dynamically from the UI:
- `TTS_PROVIDER` - "openai" or "elevenlabs"
- `OPENAI_VOICE` - OpenAI voice ID (e.g., "shimmer", "nova")
- `ELEVENLABS_VOICE_ID` - ElevenLabs voice ID

These are passed as environment variables when spawning the bot, NOT read from `.env`.

### Troubleshooting

**"ModuleNotFoundError" errors:**
- Make sure `venv/` exists and was created with Python 3.13
- If corrupted, delete `venv/` and restart a call to recreate it

**"Cannot install on Python 3.14" errors:**
- The `numba` package only supports Python 3.10-3.13
- Ensure `start.sh` uses Python 3.13: `PYTHON="/opt/homebrew/bin/python3.13"`

**Bot process exits immediately:**
- Check PM2 logs: `pm2 logs chief --lines 100`
- Look for Python import errors or missing API keys
