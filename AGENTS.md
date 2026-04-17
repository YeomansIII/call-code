# Call Code

Voice-activated Discord agent for managing development sessions.

See CLAUDE.md for architecture details. See SPEC.md for feature spec. See TECHNICAL_PLAN.md for implementation details.

## Development

- Runtime: Node.js + pnpm + TypeScript ESM
- `pnpm dev` to run, `pnpm typecheck` for type checking
- All audio processing is macOS-native (SFSpeechRecognizer, `say`)
- Wake word detection via openWakeWord Python subprocess
