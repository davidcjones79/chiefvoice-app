# Chief

Voice-first frontend for [ChiefVoice](https://github.com/davidcjones79/chiefvoice). Built with Next.js, Pipecat, and Daily.co WebRTC.

Chief provides a push-to-talk voice interface to ChiefVoice's AI agents, with support for iOS (Capacitor), macOS desktop (Tauri/Electron), and web.

## Tech Stack

- **Framework:** Next.js 16, React 19
- **Voice:** Pipecat + Daily.co WebRTC
- **STT:** Deepgram Nova-2
- **TTS:** OpenAI / ElevenLabs / Piper (configurable)
- **iOS:** Capacitor 8
- **Desktop:** Tauri 2 / Electron
- **Styling:** Tailwind CSS 4

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment config
cp .env.example .env.local
# Edit .env.local with your API keys

# Run development server
npm run dev
```

The app runs at `http://localhost:3000` by default.

### Backend (Pipecat Bot)

```bash
cd backend
python3.13 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python chief_bot.py <daily_room_url> [call_id]
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DAILY_API_KEY` | Daily.co API key (required for voice calls) |
| `DEEPGRAM_API_KEY` | Deepgram API key (required for STT) |
| `OPENAI_API_KEY` | OpenAI API key (required for LLM/TTS) |
| `ELEVENLABS_API_KEY` | ElevenLabs API key (optional TTS) |
| `CHIEFVOICE_ENABLED` | Enable ChiefVoice Gateway routing (`true`/`false`) |
| `CHIEFVOICE_GATEWAY_URL` | Gateway WebSocket URL |
| `CHIEFVOICE_GATEWAY_TOKEN` | Gateway auth token |
| `CHIEF_DB_PATH` | SQLite database path (default: `./data/chief.db`) |
| `CHIEF_PUBLIC_URL` | Public URL for callbacks/deep links |
| `CHIEF_API_URL` | API URL for backend communication |

## Architecture

```
┌──────────────┐     WebRTC      ┌──────────────┐     WebSocket     ┌────────────────┐
│  Chief App   │ ◄──────────────► │  Daily.co    │ ◄───────────────► │  Pipecat Bot   │
│  (Next.js)   │                 │  (SFU)       │                   │  (Python)      │
└──────────────┘                 └──────────────┘                   └───────┬────────┘
                                                                           │
                                                                    Gateway Protocol v3
                                                                           │
                                                                   ┌───────▼────────┐
                                                                   │  ChiefVoice    │
                                                                   │  Gateway       │
                                                                   └────────────────┘
```

- **Frontend** handles UI, call management, settings, wake word detection ("Hey Chief"), and history
- **Pipecat Bot** manages the voice pipeline: STT → LLM → TTS, with optional ChiefVoice Gateway routing
- **ChiefVoice Gateway** provides AI agent access to tools, integrations, and memory

## Production Deployment

Both the frontend and Gateway run on a Vultr VPS (`voice01`), locked down to Tailscale-only access.

### Access

- **Frontend:** `http://voice01:3000` (Tailscale only)
- **Gateway:** `http://voice01:8000` (Tailscale only)

### Systemd Services

```bash
# Frontend
sudo systemctl status chiefvoice-app
sudo systemctl restart chiefvoice-app
sudo journalctl -u chiefvoice-app -f

# Gateway
sudo systemctl status chiefvoice-gateway
sudo systemctl restart chiefvoice-gateway
sudo journalctl -u chiefvoice-gateway -f
```

### After code changes

```bash
cd /root/chiefvoice-app
git pull
npm install
npm run build
sudo systemctl restart chiefvoice-app
```

### Security (three layers)

1. **Bind address** -- both services listen only on `100.84.13.66` (Tailscale IP), unreachable from public internet
2. **UFW firewall** -- ports 3000 and 8000 only allow `100.64.0.0/10` (Tailscale CGNAT range)
3. **Vultr cloud firewall** -- only allows UDP 41641 (Tailscale WireGuard), drops all other inbound traffic

### UFW Rules

```
22/tcp    ALLOW IN  100.64.0.0/10   # SSH - Tailscale only
3000/tcp  ALLOW IN  100.64.0.0/10   # Chief frontend - Tailscale only
8000/tcp  ALLOW IN  100.64.0.0/10   # ChiefVoice Gateway - Tailscale only
Default: deny incoming
```

### Vultr Cloud Firewall

| Protocol | Port  | Source   | Purpose             |
|----------|-------|----------|---------------------|
| UDP      | 41641 | Anywhere | Tailscale WireGuard |
| *        | *     | *        | DROP (default deny) |

Emergency access via Vultr web console (VNC) if Tailscale is down.

## Platforms

| Platform | Technology | Build Command |
|----------|-----------|---------------|
| Web | Next.js | `npm run build` |
| iOS | Capacitor | `npm run cap:sync && npm run cap:open` |
| macOS (Tauri) | Tauri 2 | `npm run tauri:build` |
| macOS (Electron) | Electron | `npm run electron:build` |

## Related

- **Backend:** [chiefvoice](https://github.com/davidcjones79/chiefvoice) - ChiefVoice Gateway and agent system
