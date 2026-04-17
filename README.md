# Call Code

Voice-activated Discord agent ("Jarvis") that lets you manage and communicate with Claude Code and Codex sessions running on your Mac — hands-free, from your phone.

Join a Discord voice channel, say **"Hey Jarvis, what's the status of the nisra agent?"** and Jarvis transcribes your speech, processes it through a Codex app-server session, communicates with your running sessions via the [claude-peers-mcp](https://github.com/anthropics/claude-peers-mcp) broker, and speaks the response back over Discord voice.

The goal: manage your development agents while mowing the lawn.

## Architecture

```
Phone (Discord) ←→ Discord Voice Bridge ←→ Codex App-Server (brain) ←→ Peers Broker ←→ Running Sessions
```

- **Discord Voice Bridge** — thin Node.js service handling audio I/O, wake word detection, STT/TTS. Zero intelligence.
- **Codex App-Server** — the brain. All NLU, intent routing, peer communication, and response generation via JSON-RPC over stdio.
- **Peers Broker** — localhost HTTP daemon for peer discovery and messaging between Claude Code/Codex sessions.

### Audio Pipeline

```
Discord Opus → decode → 48kHz stereo PCM → downsample → 16kHz mono → openWakeWord (continuous)
                                                                          ↓ wake detected
                                                                      buffer audio
                                                                          ↓ 2s silence
                                                                      write WAV → Swift STT → text → Codex → TTS → Discord
```

### Key Design Decisions

- **macOS-native audio** — SFSpeechRecognizer for STT and `say` for TTS. No cloud API keys for audio processing.
- **openWakeWord** — Python subprocess with pre-trained "hey_jarvis" model for always-on wake word detection.
- **Async-first peer communication** — Peer responses are polled from the broker and injected into Codex via `turn/start`, enabling unprompted notifications.

## Prerequisites

- macOS 13+ (Ventura)
- Node.js 20+ (LTS)
- pnpm
- Python 3.9+
- Xcode Command Line Tools (for Swift compiler)
- [Codex CLI](https://github.com/openai/codex) installed
- [claude-peers-mcp](https://github.com/anthropics/claude-peers-mcp) broker running
- Discord bot application ([setup guide](#discord-bot-setup))

## Setup

```bash
# Install Node dependencies
pnpm install

# Set up Python venv, build Swift STT binary
pnpm setup

# Configure environment
cp .env.example .env
# Fill in Discord credentials (see below)
```

### Discord Bot Setup

1. Create an application at [discord.com/developers](https://discord.com/developers/applications)
2. Go to **Installation** tab — set Install Link to **None** (required for private apps)
3. Go to **Bot** tab:
   - Click **Reset Token** and copy it
   - Enable **Server Members Intent** and **Message Content Intent**
   - Check voice permissions: **Connect**, **Speak**, **Use Voice Activity**
4. Invite to your server using:
   ```
   https://discord.com/oauth2/authorize?client_id=YOUR_APP_ID&scope=bot&permissions=36700160
   ```
5. Get IDs (enable Developer Mode in Discord Settings > Advanced):
   - **Guild ID** — right-click server name > Copy Server ID
   - **Voice Channel ID** — right-click voice channel > Copy Channel ID
   - **User ID** — right-click your name > Copy User ID

### Environment Variables

```bash
# Discord
DISCORD_BOT_TOKEN=           # bot token
DISCORD_GUILD_ID=            # server ID
DISCORD_VOICE_CHANNEL_ID=    # voice channel ID
DISCORD_USER_ID=             # your user ID (only listens to you)

# Codex
CODEX_MODEL=gpt-5.4          # model for Codex session
CODEX_CWD=/Users/you/dev     # working directory for Codex

# Peers Broker
PEERS_BROKER_URL=http://localhost:7899
PEERS_POLL_INTERVAL_MS=1000

# Audio
WAKE_WORD_THRESHOLD=0.5
SILENCE_THRESHOLD_RMS=500
SILENCE_DURATION_MS=2000
MAX_UTTERANCE_MS=30000

# TTS
TTS_VOICE=Evan (Enhanced)    # any macOS `say` voice
```

List available TTS voices with `say -v '?'`. Enhanced/Premium voices can be downloaded in System Settings > Accessibility > Spoken Content > System Voice > Manage Voices.

## Usage

```bash
pnpm dev
```

1. Join the configured Discord voice channel from your phone
2. Jarvis joins and speaks a greeting
3. Say **"Hey Jarvis"** — you'll hear a chime (listening)
4. Speak your command — after 2 seconds of silence, you'll hear a second chime (processing)
5. Jarvis processes via Codex and speaks the response

### Example Commands

- "Hey Jarvis, who's online?"
- "Hey Jarvis, what's the status of the nisra agent?"
- "Hey Jarvis, tell Cedar to prioritize the downlink module."
- "Hey Jarvis, what's everyone working on?"

### Async Notifications

Peer agents can send messages to Jarvis through the broker. The broker poller picks them up and Jarvis speaks them unprompted — no wake word needed for incoming messages.

## Project Structure

```
call-code/
├── src/
│   ├── index.ts              # orchestrator, state machine
│   ├── config.ts             # environment loading
│   ├── discord/
│   │   ├── bot.ts            # Discord client setup
│   │   └── voice.ts          # voice connection, audio rx/tx
│   ├── wake/
│   │   ├── detector.ts       # openWakeWord Node.js wrapper
│   │   └── detector.py       # Python wake word subprocess
│   ├── audio/
│   │   ├── downsample.ts     # 48kHz stereo → 16kHz mono
│   │   ├── silence.ts        # RMS-based silence detection
│   │   └── wav.ts            # WAV file writing
│   ├── stt/
│   │   ├── transcribe.swift  # macOS SFSpeechRecognizer CLI
│   │   └── transcribe.ts     # Node.js wrapper
│   ├── tts/
│   │   └── speak.ts          # macOS `say` wrapper
│   ├── codex/
│   │   ├── client.ts         # JSON-RPC 2.0 client
│   │   └── session.ts        # Codex app-server lifecycle
│   └── broker/
│       └── poller.ts         # broker message polling
├── assets/
│   ├── chime-wake.wav        # listening chime
│   └── chime-processing.wav  # processing chime
├── scripts/
│   ├── build-stt.sh          # compile Swift binary
│   └── setup.sh              # full setup script
└── python/
    └── requirements.txt      # openwakeword, onnxruntime
```

## State Machine

```
IDLE → (wake word) → LISTENING → (2s silence) → PROCESSING → (Codex responds) → SPEAKING → IDLE
                                                                                     ↑
                                                              (async peer message) ──┘
```

- Wake word during SPEAKING interrupts playback and transitions to LISTENING
- Peer messages during SPEAKING/PROCESSING are queued and delivered after

## Development

```bash
pnpm dev          # run with tsx --watch
pnpm typecheck    # type check
pnpm build:stt    # rebuild Swift STT binary
```
