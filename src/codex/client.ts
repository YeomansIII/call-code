import { spawn, type ChildProcess } from "node:child_process";
import * as readline from "node:readline";
import { EventEmitter } from "node:events";
import type { JsonRpcMessage } from "./protocol.ts";
import { isResponse, isNotification } from "./protocol.ts";

interface PendingRequest {
  resolve: (result: unknown) => void;
  reject: (error: unknown) => void;
}

export class CodexClient extends EventEmitter {
  private proc: ChildProcess;
  private nextId = 0;
  private pending = new Map<number, PendingRequest>();
  private rl: readline.Interface;

  constructor(cwd: string) {
    super();
    this.proc = spawn("codex", ["app-server"], {
      stdio: ["pipe", "pipe", "inherit"],
      cwd,
    });

    this.rl = readline.createInterface({ input: this.proc.stdout! });
    this.rl.on("line", (line) => this.handleLine(line));

    this.proc.on("exit", (code) => {
      this.emit("exit", code);
      for (const { reject } of this.pending.values()) {
        reject(new Error(`Codex process exited with code ${code}`));
      }
      this.pending.clear();
    });
  }

  get pid(): number {
    return this.proc.pid!;
  }

  private handleLine(line: string): void {
    let msg: JsonRpcMessage;
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }

    if (isResponse(msg) && this.pending.has(msg.id)) {
      const { resolve, reject } = this.pending.get(msg.id)!;
      this.pending.delete(msg.id);
      if (msg.error) {
        reject(msg.error);
      } else {
        resolve(msg.result);
      }
    } else if (isNotification(msg)) {
      this.emit("notification", msg.method, msg.params);
    }
  }

  async request(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    const id = this.nextId++;
    const msg = JSON.stringify({ jsonrpc: "2.0", method, id, params });
    this.proc.stdin!.write(msg + "\n");

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  notify(method: string, params: Record<string, unknown> = {}): void {
    const msg = JSON.stringify({ jsonrpc: "2.0", method, params });
    this.proc.stdin!.write(msg + "\n");
  }

  destroy(): void {
    this.proc.stdin!.end();
    setTimeout(() => {
      if (!this.proc.killed) this.proc.kill("SIGKILL");
    }, 5000);
  }
}
