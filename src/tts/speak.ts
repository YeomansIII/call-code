import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { config } from "../config.ts";

const execFileAsync = promisify(execFile);

export async function speak(text: string): Promise<string> {
  const outPath = join(tmpdir(), `jarvis-${Date.now()}.aiff`);
  await execFileAsync("say", ["-v", config.tts.voice, "-o", outPath, text], {
    timeout: 10_000,
  });
  return outPath;
}

export function chunkBySentence(text: string, maxLen = 500): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if (current.length + sentence.length > maxLen && current) {
      chunks.push(current.trim());
      current = "";
    }
    current += sentence;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}
