import { config } from "../config.ts";

const FRAME_DURATION_MS = 80;
const FRAMES_FOR_SILENCE = Math.ceil(config.audio.silenceDurationMs / FRAME_DURATION_MS);

export function computeRMS(pcm16bit: Buffer): number {
  let sumSquares = 0;
  const sampleCount = pcm16bit.length / 2;
  for (let i = 0; i < sampleCount; i++) {
    const sample = pcm16bit.readInt16LE(i * 2);
    sumSquares += sample * sample;
  }
  return Math.sqrt(sumSquares / sampleCount);
}

export class SilenceDetector {
  private silentFrames = 0;
  private totalFrames = 0;

  feed(pcm16kMono: Buffer): { silent: boolean; maxDurationReached: boolean } {
    this.totalFrames++;
    const rms = computeRMS(pcm16kMono);

    if (rms < config.audio.silenceThresholdRms) {
      this.silentFrames++;
    } else {
      this.silentFrames = 0;
    }

    const elapsedMs = this.totalFrames * FRAME_DURATION_MS;

    return {
      silent: this.silentFrames >= FRAMES_FOR_SILENCE,
      maxDurationReached: elapsedMs >= config.audio.maxUtteranceMs,
    };
  }

  reset(): void {
    this.silentFrames = 0;
    this.totalFrames = 0;
  }
}
