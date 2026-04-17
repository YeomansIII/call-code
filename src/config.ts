import "dotenv/config";

function required(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

function optional(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

function optionalInt(name: string, fallback: number): number {
  const val = process.env[name];
  return val ? parseInt(val, 10) : fallback;
}

export const config = {
  discord: {
    token: required("DISCORD_BOT_TOKEN"),
    guildId: required("DISCORD_GUILD_ID"),
    voiceChannelId: required("DISCORD_VOICE_CHANNEL_ID"),
    userId: required("DISCORD_USER_ID"),
  },
  codex: {
    model: optional("CODEX_MODEL", "o4-mini"),
    cwd: optional("CODEX_CWD", process.cwd()),
  },
  broker: {
    url: optional("PEERS_BROKER_URL", "http://localhost:7899"),
    pollIntervalMs: optionalInt("PEERS_POLL_INTERVAL_MS", 1000),
  },
  audio: {
    wakeWordThreshold: parseFloat(optional("WAKE_WORD_THRESHOLD", "0.5")),
    silenceThresholdRms: optionalInt("SILENCE_THRESHOLD_RMS", 500),
    silenceDurationMs: optionalInt("SILENCE_DURATION_MS", 2000),
    maxUtteranceMs: optionalInt("MAX_UTTERANCE_MS", 30000),
  },
  tts: {
    voice: optional("TTS_VOICE", "Daniel"),
  },
} as const;
