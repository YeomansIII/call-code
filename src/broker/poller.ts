import { config } from "../config.ts";

interface BrokerMessage {
  from_id: string;
  text: string;
  sent_at: string;
}

interface Peer {
  id: string;
  client_kind: string;
  cwd: string;
  summary: string;
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
    console.log(`[broker] Discovered Codex peer ID: ${this.peerId}`);
    this.interval = setInterval(() => this.poll(), config.broker.pollIntervalMs);
  }

  private async discoverPeerId(): Promise<string> {
    for (let attempt = 0; attempt < 60; attempt++) {
      try {
        const res = await fetch(`${config.broker.url}/list-peers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scope: "machine", cwd: ".", git_root: null }),
        });

        if (!res.ok) throw new Error(`${res.status}`);
        const peers = (await res.json()) as Peer[];

        const codexPeer = peers.find((p) => p.client_kind === "codex");
        if (codexPeer) return codexPeer.id;
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
