import { join } from "node:path";
import { tmpdir } from "node:os";
import { createBot } from "./discord/bot.ts";
import { VoiceBridge } from "./discord/voice.ts";
import { WakeWordDetector } from "./wake/detector.ts";
import { SilenceDetector } from "./audio/silence.ts";
import { writeWav } from "./audio/wav.ts";
import { transcribe } from "./stt/transcribe.ts";
import { speak, chunkBySentence } from "./tts/speak.ts";
import { CodexSession } from "./codex/session.ts";
import { BrokerPoller } from "./broker/poller.ts";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

type State = "IDLE" | "LISTENING" | "PROCESSING" | "SPEAKING";

let state: State = "IDLE";
let audioChunks: Buffer[] = [];
let pendingMessages: string[] = [];

const CHIME_WAKE = join(__dirname, "../assets/chime-wake.wav");
const CHIME_PROCESSING = join(__dirname, "../assets/chime-processing.wav");

function log(msg: string) {
  console.log(`[jarvis] [${state}] ${msg}`);
}

function setState(next: State) {
  log(`→ ${next}`);
  state = next;
}

async function main() {
  console.log("[jarvis] Starting Call Code...");

  const { guild } = await createBot();
  const voice = new VoiceBridge();
  await voice.connect(guild);

  const codex = new CodexSession();
  await codex.initialize();
  console.log(`[jarvis] Codex session initialized (pid: ${codex.pid})`);

  const wake = new WakeWordDetector();
  wake.start();

  const silence = new SilenceDetector();

  const poller = new BrokerPoller(codex.pid, (formatted) => {
    if (state === "IDLE") {
      codex.sendTurn(formatted).catch((e) => log(`Codex turn error: ${e}`));
    } else {
      pendingMessages.push(formatted);
    }
  });
  poller.start().catch((e) => log(`Broker poller error: ${e}`));

  voice.on("audio", (pcm16kMono: Buffer) => {
    wake.feed(pcm16kMono);

    if (state === "LISTENING") {
      audioChunks.push(pcm16kMono);
      const result = silence.feed(pcm16kMono);

      if (result.silent || result.maxDurationReached) {
        finishListening(voice, codex);
      }
    }
  });

  wake.on("wake", (score: number) => {
    log(`Wake word detected (score: ${score})`);

    if (state === "SPEAKING") {
      voice.stopPlayback();
    }

    if (state === "IDLE" || state === "SPEAKING") {
      setState("LISTENING");
      audioChunks = [];
      silence.reset();
      voice.play(CHIME_WAKE).catch(() => {});
    }
  });

  wake.on("exit", (code) => {
    log(`Wake word detector exited (${code}), restarting...`);
    setTimeout(() => wake.start(), 1000);
  });

  codex.on("response", async (text: string) => {
    setState("SPEAKING");
    try {
      const chunks = chunkBySentence(text);
      for (const chunk of chunks) {
        if (state !== "SPEAKING") break;
        const audioFile = await speak(chunk);
        if (state !== "SPEAKING") break;
        await voice.play(audioFile);
      }
    } catch (e) {
      log(`TTS/playback error: ${e}`);
    }

    setState("IDLE");
    drainPendingMessages(codex);
  });

  codex.on("exit", (code) => {
    log(`Codex exited (${code}), shutting down...`);
    cleanup(voice, wake, poller, codex);
  });

  codex.sendTurn(
    "Greet the user briefly. You just came online. Report how many peers are active if you can."
  ).catch((e) => log(`Greeting turn error: ${e}`));

  function handleShutdown() {
    log("Shutting down...");
    cleanup(voice, wake, poller, codex);
  }

  process.on("SIGINT", handleShutdown);
  process.on("SIGTERM", handleShutdown);
}

async function finishListening(voice: VoiceBridge, codex: CodexSession) {
  setState("PROCESSING");

  voice.play(CHIME_PROCESSING).catch(() => {});

  const pcm = Buffer.concat(audioChunks);
  audioChunks = [];

  if (pcm.length < 16000) {
    log("Audio too short, discarding");
    setState("IDLE");
    return;
  }

  const wavPath = join(tmpdir(), `jarvis-utterance-${Date.now()}.wav`);
  writeWav(pcm, 16000, wavPath);

  try {
    const text = await transcribe(wavPath);
    log(`Transcribed: "${text}"`);

    if (!text.trim()) {
      log("Empty transcription, ignoring");
      setState("IDLE");
      return;
    }

    await codex.sendTurn(text);
  } catch (e) {
    log(`STT error: ${e}`);
    const errAudio = await speak("Sorry, I didn't catch that. Could you repeat?");
    setState("SPEAKING");
    await voice.play(errAudio).catch(() => {});
    setState("IDLE");
  }
}

function drainPendingMessages(codex: CodexSession) {
  if (pendingMessages.length > 0) {
    const batch = pendingMessages.join("\n\n");
    pendingMessages = [];
    codex.sendTurn(batch).catch((e) => log(`Drain error: ${e}`));
  }
}

function cleanup(
  voice: VoiceBridge,
  wake: WakeWordDetector,
  poller: BrokerPoller,
  codex: CodexSession,
) {
  poller.stop();
  voice.disconnect();
  wake.destroy();
  codex.destroy();
  setTimeout(() => process.exit(0), 2000);
}

main().catch((e) => {
  console.error("[jarvis] Fatal error:", e);
  process.exit(1);
});
