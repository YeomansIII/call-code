import { EventEmitter } from "node:events";
import { CodexClient } from "./client.ts";
import { config } from "../config.ts";

const SYSTEM_PROMPT = `You are Jarvis, a voice assistant managing development sessions on Jason's Mac.

CRITICAL OUTPUT RULES:
- Everything you say is spoken aloud via text-to-speech.
- Keep responses to 1-3 sentences unless the user asks for detail.
- Never output tables, code blocks, markdown, bullet lists, or structured data.
- Use natural spoken language. Say "about 80 percent" not "~80%".
- Spell out abbreviations that would sound odd via TTS.

CAPABILITIES:
- You have claude-peers-mcp tools: list_peers, peer_message, check_messages, set_summary, whoami.
- Use list_peers with machine scope to discover running Claude Code and Codex sessions.
- Use peer_message to communicate with specific peers by their ID.
- When asked about "everyone" or "all agents", call list_peers first.

PEER COMMUNICATION:
- When sending peer_message, be specific about what you need.
- After sending a message, tell the user you've sent it. Don't wait for a response inline.
- When you receive an injected peer message (prefixed with [Peer Message]), assess urgency:
  - Errors, failures, questions: report immediately.
  - Routine status updates: summarize briefly.
- Summarize peer messages in your own words rather than quoting verbatim.
- Do NOT use check_messages — messages are delivered to you automatically.

PERSONALITY:
- Professional but warm. Brief and direct.
- Proactively offer next steps ("Want me to tell it to retry?").
- If you can't reach a peer or the broker is down, say so plainly.`;

export interface CodexSessionEvents {
  response: [text: string];
  error: [error: Error];
  exit: [code: number | null];
}

export class CodexSession extends EventEmitter {
  private client: CodexClient;
  private threadId: string | null = null;
  private responseBuffer = "";
  private turnInFlight = false;
  private pendingInputs: string[] = [];

  constructor() {
    super();
    this.client = new CodexClient(config.codex.cwd);

    this.client.on("notification", (method: string, params: Record<string, unknown>) => {
      this.handleNotification(method, params);
    });

    this.client.on("exit", (code: number | null) => {
      this.emit("exit", code);
    });
  }

  get pid(): number {
    return this.client.pid;
  }

  async initialize(): Promise<void> {
    await this.client.request("initialize", {
      clientInfo: { name: "call-code", version: "0.1.0" },
      capabilities: {},
    });
    this.client.notify("initialized", {});

    const result = (await this.client.request("thread/start", {
      model: config.codex.model,
      cwd: config.codex.cwd,
      baseInstructions: SYSTEM_PROMPT,
      approvalPolicy: "never",
      sandbox: "danger-full-access",
    })) as { thread: { id: string } };

    this.threadId = result.thread.id;
  }

  async sendTurn(text: string): Promise<void> {
    if (!this.threadId) throw new Error("Session not initialized");

    if (this.turnInFlight) {
      this.pendingInputs.push(text);
      return;
    }

    this.turnInFlight = true;
    this.responseBuffer = "";

    await this.client.request("turn/start", {
      threadId: this.threadId,
      input: [{ type: "text", text }],
    });
  }

  private handleNotification(method: string, params: Record<string, unknown>): void {
    switch (method) {
      case "item/agentMessage/delta":
        this.responseBuffer += params.delta as string;
        break;

      case "turn/completed":
        {
          const response = this.responseBuffer;
          this.responseBuffer = "";
          this.turnInFlight = false;

          if (response.trim()) {
            this.emit("response", response);
          }

          this.drainPending();
        }
        break;

      case "item/commandExecution/requestApproval":
      case "item/fileChange/requestApproval":
        this.client
          .request("serverRequest/resolved", {
            requestId: params.requestId as string,
            resolution: "acceptForSession",
          })
          .catch(() => {});
        break;
    }
  }

  private drainPending(): void {
    const next = this.pendingInputs.shift();
    if (next) {
      this.sendTurn(next).catch((e) => this.emit("error", e));
    }
  }

  destroy(): void {
    this.client.destroy();
  }
}
