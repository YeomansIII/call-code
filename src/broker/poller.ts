import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "../config.ts";

const PEER_ID_DIR = "/tmp/claude-peers";

interface BrokerMessage {
  from_id: string;
  text: string;
  sent_at: string;
}

interface Peer {
  id: string;
  pid: number;
  client_kind: string;
  cwd: string;
  summary: string;
  registered_at: string;
}

interface PeerIdFile {
  id: string;
  pid: number;
  ppid: number;
  cwd: string;
  client_kind: string;
}

export class BrokerPoller {
  private peerId: string | null = null;
  private interval: ReturnType<typeof setInterval> | null = null;
  private onMessage: (formatted: string) => void;
  private codexPid: number;

  constructor(codexPid: number, onMessage: (formatted: string) => void) {
    this.codexPid = codexPid;
    this.onMessage = onMessage;
  }

  async start(): Promise<void> {
    this.peerId = await this.discoverPeerId();
    console.log(`[broker] Discovered Jarvis peer ID: ${this.peerId}`);
    this.interval = setInterval(() => this.poll(), config.broker.pollIntervalMs);
  }

  private async discoverPeerId(): Promise<string> {
    for (let attempt = 0; attempt < 60; attempt++) {
      // Method 1: scan registration files for a PPID close to our Codex PID
      try {
        const files = readdirSync(PEER_ID_DIR);
        for (const file of files) {
          if (!file.endsWith(".json")) continue;
          try {
            const data = JSON.parse(
              readFileSync(join(PEER_ID_DIR, file), "utf-8"),
            ) as PeerIdFile;
            // The MCP server's PPID is the Codex child process that spawned it.
            // It's typically within a few PIDs of our Codex PID.
            if (
              data.client_kind === "codex" &&
              Math.abs(data.ppid - this.codexPid) <= 5
            ) {
              return data.id;
            }
          } catch {
            continue;
          }
        }
      } catch {
        // directory might not exist yet
      }

      // Method 2: fallback to broker API — find codex peer with PID closest to ours
      try {
        const res = await fetch(`${config.broker.url}/list-peers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scope: "machine", cwd: ".", git_root: null }),
        });
        if (res.ok) {
          const peers = (await res.json()) as Peer[];
          const codexPeers = peers.filter((p) => p.client_kind === "codex");
          const nearby = codexPeers.find(
            (p) => Math.abs(p.pid - this.codexPid) <= 50,
          );
          if (nearby) return nearby.id;
        }
      } catch {
        // broker may not be up yet
      }

      await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error("Failed to discover Codex peer ID after 60 seconds");
  }

  private async poll(): Promise<void> {
    if (!this.peerId) return;

    try {
      const res = await fetch(`${config.broker.url}/poll-messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: this.peerId }),
      });

      if (!res.ok) return;
      const result = (await res.json()) as { messages: BrokerMessage[] };
      if (result.messages.length === 0) return;

      const peersRes = await fetch(`${config.broker.url}/list-peers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "machine", cwd: ".", git_root: null }),
      });
      const peers = peersRes.ok ? ((await peersRes.json()) as Peer[]) : [];

      const lines = result.messages.map((msg) => {
        const sender = peers.find((p) => p.id === msg.from_id);
        const ctx = sender
          ? `${sender.client_kind}, working on: ${sender.summary || "unknown"}, in ${sender.cwd}`
          : "unknown session";
        return `[Peer Message] From: ${msg.from_id} (${ctx})\nMessage: "${msg.text}"`;
      });

      console.log(`[broker] ${result.messages.length} peer message(s) received`);
      this.onMessage(lines.join("\n\n"));
    } catch {
      // non-critical
    }
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}
