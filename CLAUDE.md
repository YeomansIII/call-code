# Call Code

Voice-activated Discord agent ("Jarvis") for managing Claude Code and Codex sessions hands-free.

## Architecture

- **Node.js Discord service** — thin voice I/O bridge, zero intelligence
- **Codex app-server** — the brain, JSON-RPC 2.0 over stdio
- **claude-peers-mcp broker** — peer discovery and messaging (localhost:7899)
- **openWakeWord** — Python subprocess for "hey jarvis" wake word detection
- **macOS SFSpeechRecognizer** — on-device STT via compiled Swift CLI
- **macOS `say`** — TTS output

## Commands

```bash
pnpm dev          # development with tsx --watch
pnpm typecheck    # type check without emit
pnpm build:stt    # compile Swift STT binary
pnpm setup        # full setup (python venv, STT binary, .env)
```

## Key files

- `src/index.ts` — orchestrator, state machine (IDLE/LISTENING/PROCESSING/SPEAKING)
- `src/codex/session.ts` — Codex app-server lifecycle, response handling
- `src/codex/client.ts` — JSON-RPC 2.0 client
- `src/discord/voice.ts` — voice connection, audio rx/tx
- `src/wake/detector.ts` — openWakeWord subprocess wrapper
- `src/broker/poller.ts` — broker message polling and injection into Codex

## Runtime

- Node.js (LTS), pnpm, TypeScript, ESM
- tsx for development
- Native addons: @discordjs/opus, sodium-native
