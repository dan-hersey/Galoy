// ============================================================
// Telegram Bot — Long-polling listener with conversation routing
// ============================================================

import https from "https";
import type { LoanStore } from "../store";
import { ConversationManager } from "./conversation";
import { CommandHandlers, parseCommand } from "./handlers";
import { ConversationStep } from "../types";

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number; type: string; first_name?: string };
    from?: { id: number; first_name?: string; username?: string };
    text?: string;
    date: number;
  };
}

export class TelegramBot {
  private pollingOffset = 0;
  private running = false;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private backoffMs = 1000;
  private readonly maxBackoff = 30000;
  private token: string;
  private store: LoanStore;
  private conversation: ConversationManager;
  private handlers: CommandHandlers;

  constructor(botToken: string, store: LoanStore, dashboardHost: string) {
    this.token = botToken;
    this.store = store;
    this.conversation = new ConversationManager(store);

    this.handlers = new CommandHandlers(
      store,
      this.conversation,
      (chatId, text) => this.sendMessage(chatId, text),
      dashboardHost,
    );
  }

  // ── Lifecycle ────────────────────────────────────────────

  start(): void {
    if (this.running) return;
    this.running = true;
    this.backoffMs = 1000;
    console.log("[TelegramBot] Polling started");
    this.schedulePoll(0);

    // Clean stale conversations every 5 minutes
    setInterval(() => {
      const cleaned = this.store.cleanStaleConversations();
      if (cleaned > 0) console.log(`[TelegramBot] Cleaned ${cleaned} stale conversations`);
    }, 5 * 60 * 1000);
  }

  stop(): void {
    this.running = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    console.log("[TelegramBot] Polling stopped");
  }

  isRunning(): boolean { return this.running; }

  // Expose for testing
  getHandlers(): CommandHandlers { return this.handlers; }
  getConversationManager(): ConversationManager { return this.conversation; }

  // ── Polling Loop ─────────────────────────────────────────

  private schedulePoll(delayMs: number) {
    if (!this.running) return;
    this.pollTimer = setTimeout(() => this.pollUpdates(), delayMs);
  }

  private async pollUpdates(): Promise<void> {
    if (!this.running) return;

    try {
      const updates = await this.getUpdates();
      this.backoffMs = 1000;

      for (const update of updates) {
        if (update.message?.text) {
          const { chat, from, text } = update.message;
          const cmd = parseCommand(text, chat.id, from?.id ?? 0, from?.username);

          if (cmd) {
            await this.handlers.handleCommand(cmd);
          } else {
            // Not a command — check if there's an active conversation
            const ctx = this.store.getConversation(chat.id);
            if (ctx && ctx.step !== ConversationStep.IDLE) {
              await this.handlers.handleConversationInput(chat.id, text);
            }
          }
        }
        this.pollingOffset = update.update_id + 1;
      }

      this.schedulePoll(100);
    } catch (err: any) {
      console.error(`[TelegramBot] Poll error: ${err.message}`);
      this.schedulePoll(this.backoffMs);
      this.backoffMs = Math.min(this.backoffMs * 2, this.maxBackoff);
    }
  }

  private getUpdates(): Promise<TelegramUpdate[]> {
    return new Promise((resolve, reject) => {
      const url = new URL(`https://api.telegram.org/bot${this.token}/getUpdates`);
      url.searchParams.set("offset", String(this.pollingOffset));
      url.searchParams.set("timeout", "25");
      url.searchParams.set("allowed_updates", JSON.stringify(["message"]));

      const req = https.get(url.toString(), { timeout: 35000 }, (res) => {
        let data = "";
        res.on("data", (chunk: any) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.ok && Array.isArray(parsed.result)) {
              resolve(parsed.result);
            } else {
              reject(new Error(parsed.description || "Telegram API error"));
            }
          } catch { reject(new Error("Invalid JSON from Telegram")); }
        });
      });

      req.on("error", reject);
      req.on("timeout", () => { req.destroy(); reject(new Error("Timeout")); });
    });
  }

  // ── Send Message ─────────────────────────────────────────

  sendMessage(chatId: number, text: string, parseMode = "Markdown"): Promise<void> {
    return new Promise((resolve, reject) => {
      const body = JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
      });

      const options = {
        hostname: "api.telegram.org",
        path: `/bot${this.token}/sendMessage`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
        timeout: 10000,
      };

      const req = https.request(options, (res) => {
        let data = "";
        res.on("data", (chunk: any) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            if (!parsed.ok) {
              console.error(`[TelegramBot] Send error: ${parsed.description}`);
            }
          } catch {}
          resolve();
        });
      });

      req.on("error", (err) => {
        console.error(`[TelegramBot] Send error: ${err.message}`);
        resolve(); // Don't reject — sending failures shouldn't crash
      });

      req.on("timeout", () => {
        req.destroy();
        resolve();
      });

      req.write(body);
      req.end();
    });
  }
}
