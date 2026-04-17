import { spawn, type ChildProcess } from "node:child_process";
import * as readline from "node:readline";
import { EventEmitter } from "node:events";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../config.ts";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const SCRIPT_PATH = join(__dirname, "detector.py");
const PYTHON_PATH = join(__dirname, "../../python/venv/bin/python3");

export class WakeWordDetector extends EventEmitter {
  private proc: ChildProcess | null = null;

  start(): void {
    this.proc = spawn(PYTHON_PATH, [SCRIPT_PATH], {
      stdio: ["pipe", "pipe", "inherit"],
    });

    const rl = readline.createInterface({ input: this.proc.stdout! });
    rl.on("line", (line) => {
      try {
        const event = JSON.parse(line);
        if (event.event === "wake" && event.score >= config.audio.wakeWordThreshold) {
          this.emit("wake", event.score);
        }
      } catch {
        // ignore malformed lines
      }
    });

    this.proc.on("exit", (code) => {
      this.emit("exit", code);
    });
  }

  feed(pcm16kMono: Buffer): void {
    if (this.proc?.stdin?.writable) {
      this.proc.stdin.write(pcm16kMono);
    }
  }

  destroy(): void {
    if (this.proc && !this.proc.killed) {
      this.proc.kill("SIGTERM");
    }
  }
}
