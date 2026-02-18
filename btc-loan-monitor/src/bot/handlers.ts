// ============================================================
// Bot Command Handlers
// ============================================================

import type { LoanStore } from "../store";
import type { ConversationManager } from "./conversation";
import { ConversationStep } from "../types";

export interface ParsedCommand {
  command: string;
  args: string;
  chatId: number;
  userId: number;
  username?: string;
}

export function parseCommand(text: string, chatId: number, userId: number, username?: string): ParsedCommand | null {
  if (!text || !text.startsWith("/")) return null;
  const trimmed = text.trim();
  const match = trimmed.match(/^\/([a-zA-Z_]+)(?:@\S+)?\s*(.*)/s);
  if (!match) return null;
  return {
    command: match[1].toLowerCase(),
    args: match[2].trim(),
    chatId,
    userId,
    username,
  };
}

// Tier emoji mapping
const TIER_EMOJI: Record<string, string> = {
  GREEN: "\u{1F7E2}", YELLOW: "\u{1F7E1}", ORANGE: "\u{1F7E0}", RED: "\u{1F534}", LIQUIDATION: "\u{1F6A8}",
};

export class CommandHandlers {
  private store: LoanStore;
  private conversation: ConversationManager;
  private sendReply: (chatId: number, text: string) => Promise<void>;
  private dashboardHost: string;

  constructor(
    store: LoanStore,
    conversation: ConversationManager,
    sendReply: (chatId: number, text: string) => Promise<void>,
    dashboardHost: string,
  ) {
    this.store = store;
    this.conversation = conversation;
    this.sendReply = sendReply;
    this.dashboardHost = dashboardHost;
  }

  async handleCommand(cmd: ParsedCommand): Promise<void> {
    switch (cmd.command) {
      case "start": return this.handleStart(cmd);
      case "newloan": return this.handleNewLoan(cmd);
      case "status": return this.handleStatus(cmd);
      case "alert": return this.handleAlert(cmd);
      case "alerts": return this.handleAlerts(cmd);
      case "edit": return this.handleEdit(cmd);
      case "delete": return this.handleDelete(cmd);
      case "help": return this.handleHelp(cmd);
      default:
        return this.sendReply(cmd.chatId,
          `Unknown command: /${cmd.command}\n\nType /help to see available commands.`);
    }
  }

  async handleConversationInput(chatId: number, text: string): Promise<void> {
    const ctx = this.store.getConversation(chatId);
    if (!ctx) return;

    // Handle cancel at any point
    if (text.toLowerCase() === "cancel") {
      this.store.clearConversation(chatId);
      return this.sendReply(chatId, "Loan entry cancelled. Use /newloan to start again.");
    }

    // Handle confirmation step
    if (ctx.step === ConversationStep.CONFIRM) {
      if (text.toLowerCase() === "yes") {
        const result = this.conversation.confirmAndCreateLoan(chatId, this.dashboardHost);
        if (result) {
          return this.sendReply(chatId, [
            "\u{2705} *Loan created!*",
            "",
            "View your live dashboard:",
            result.dashboardUrl,
            "",
            "Use /status to check your loan anytime.",
            "Use /alert to set price or LTV alerts.",
          ].join("\n"));
        } else {
          return this.sendReply(chatId, "Something went wrong creating your loan. Try /newloan again.");
        }
      } else {
        this.store.clearConversation(chatId);
        return this.sendReply(chatId, "Loan entry cancelled. Use /newloan to start again.");
      }
    }

    // Process step input
    const result = this.conversation.processInput(chatId, text);

    if (result.error) {
      return this.sendReply(chatId, result.error);
    }

    // If we reached CONFIRM step, show confirmation
    if (result.nextStep === ConversationStep.CONFIRM) {
      const msg = this.conversation.buildConfirmationMessage(chatId);
      if (msg) return this.sendReply(chatId, msg);
    }

    // Otherwise, show next prompt
    const nextPrompt = this.conversation.getPromptForStep(result.nextStep);
    if (nextPrompt) {
      return this.sendReply(chatId, nextPrompt);
    }
  }

  // ── Individual Handlers ──────────────────────────────────

  private async handleStart(cmd: ParsedCommand): Promise<void> {
    const name = cmd.username ? ` ${cmd.username}` : "";
    await this.sendReply(cmd.chatId, [
      `*Welcome${name}!* \u{1F44B}`,
      "",
      "I help you monitor your BTC-collateralized loans in real-time.",
      "",
      "*Quick start:*",
      "1. Enter your loan details: /newloan",
      "2. Get a live dashboard with your magic link",
      "3. Set alerts: /alert",
      "",
      "Type /help for all commands.",
    ].join("\n"));
  }

  private async handleNewLoan(cmd: ParsedCommand): Promise<void> {
    // Check if they already have a loan
    const existing = this.store.getLoanByChatId(cmd.chatId);
    if (existing) {
      return this.sendReply(cmd.chatId, [
        "You already have a loan registered.",
        `Dashboard: ${this.dashboardHost}/dash/${existing.token}`,
        "",
        "Use /delete to remove it first, or /edit to update it.",
      ].join("\n"));
    }

    // Clear any stale conversation and start fresh
    this.store.clearConversation(cmd.chatId);
    this.store.startConversation(cmd.chatId);

    const prompt = this.conversation.getPromptForStep(ConversationStep.AWAITING_AMOUNT);
    await this.sendReply(cmd.chatId, [
      "Let's set up your loan monitor! I'll ask you a few questions.\n",
      "Type `cancel` at any time to stop.\n",
      prompt || "",
    ].join("\n"));
  }

  private async handleStatus(cmd: ParsedCommand): Promise<void> {
    const loan = this.store.getLoanByChatId(cmd.chatId);
    if (!loan) {
      return this.sendReply(cmd.chatId,
        "No loan found. Use /newloan to set up your loan monitor.");
    }

    const snapshot = this.store.computeSnapshot(loan.token);
    if (!snapshot) {
      return this.sendReply(cmd.chatId,
        "Unable to compute loan status (price feed may be loading). Try again in a moment.");
    }

    const emoji = TIER_EMOJI[snapshot.risk_tier] || "\u{26AA}";
    const lines = [
      `\u{1F4CA} *Loan Status* ${emoji}`,
      "",
      `*LTV:* ${(snapshot.current_ltv * 100).toFixed(1)}% — ${snapshot.risk_tier}`,
      `*BTC Price:* $${snapshot.btc_price.toLocaleString()}`,
      `*Collateral Value:* $${snapshot.collateral_usd.toLocaleString()}`,
      `*Loan Amount:* $${loan.loan_amount_usd.toLocaleString()}`,
      `*Margin Call at:* $${snapshot.margin_call_price.toLocaleString()}`,
      `*Liquidation at:* $${snapshot.liquidation_price.toLocaleString()}`,
    ];

    if (loan.lender_name) lines.push(`*Lender:* ${loan.lender_name}`);
    if (snapshot.days_remaining !== null) lines.push(`*Days Remaining:* ${snapshot.days_remaining}`);

    lines.push("", `*Stress Test:*`);
    lines.push(`  -5%  \u{2192} ${(snapshot.stress_test["5pct_drop"].ltv * 100).toFixed(1)}% LTV (${snapshot.stress_test["5pct_drop"].tier})`);
    lines.push(`  -10% \u{2192} ${(snapshot.stress_test["10pct_drop"].ltv * 100).toFixed(1)}% LTV (${snapshot.stress_test["10pct_drop"].tier})`);
    lines.push(`  -20% \u{2192} ${(snapshot.stress_test["20pct_drop"].ltv * 100).toFixed(1)}% LTV (${snapshot.stress_test["20pct_drop"].tier})`);
    lines.push(`  -30% \u{2192} ${(snapshot.stress_test["30pct_drop"].ltv * 100).toFixed(1)}% LTV (${snapshot.stress_test["30pct_drop"].tier})`);

    lines.push("", `\u{1F517} ${this.dashboardHost}/dash/${loan.token}`);

    await this.sendReply(cmd.chatId, lines.join("\n"));
  }

  private async handleAlert(cmd: ParsedCommand): Promise<void> {
    const loan = this.store.getLoanByChatId(cmd.chatId);
    if (!loan) {
      return this.sendReply(cmd.chatId,
        "No loan found. Use /newloan first.");
    }

    // Parse: /alert price 60000 BELOW  or  /alert ltv 80 ABOVE
    const parts = cmd.args.split(/\s+/);
    if (parts.length < 3) {
      return this.sendReply(cmd.chatId, [
        "*Set an alert:*",
        "",
        "Price alert: `/alert price 60000 BELOW`",
        "LTV alert: `/alert ltv 80 ABOVE`",
        "",
        "Directions: `ABOVE` or `BELOW`",
      ].join("\n"));
    }

    const type = parts[0].toLowerCase();
    const threshold = parseFloat(parts[1]);
    const direction = (parts[2] || "").toUpperCase();

    if (direction !== "ABOVE" && direction !== "BELOW") {
      return this.sendReply(cmd.chatId, "Direction must be `ABOVE` or `BELOW`.");
    }

    if (type === "price") {
      if (isNaN(threshold) || threshold <= 0) {
        return this.sendReply(cmd.chatId, "Please provide a valid price threshold.");
      }
      const alert = this.store.createPriceAlert(loan.token, threshold, direction as "ABOVE" | "BELOW");
      return this.sendReply(cmd.chatId,
        `\u{2705} Price alert set: notify when BTC goes *${direction}* $${threshold.toLocaleString()}`);
    }

    if (type === "ltv") {
      if (isNaN(threshold) || threshold <= 0 || threshold > 100) {
        return this.sendReply(cmd.chatId, "Please provide a valid LTV percentage (1-100).");
      }
      const alert = this.store.createLtvAlert(loan.token, threshold / 100, direction as "ABOVE" | "BELOW");
      return this.sendReply(cmd.chatId,
        `\u{2705} LTV alert set: notify when LTV goes *${direction}* ${threshold}%`);
    }

    return this.sendReply(cmd.chatId, "Alert type must be `price` or `ltv`.");
  }

  private async handleAlerts(cmd: ParsedCommand): Promise<void> {
    const loan = this.store.getLoanByChatId(cmd.chatId);
    if (!loan) {
      return this.sendReply(cmd.chatId, "No loan found. Use /newloan first.");
    }

    const priceAlerts = this.store.getPriceAlerts(loan.token);
    const ltvAlerts = this.store.getLtvAlerts(loan.token);

    if (priceAlerts.length === 0 && ltvAlerts.length === 0) {
      return this.sendReply(cmd.chatId,
        "No alerts set. Use /alert to create one.");
    }

    const lines: string[] = ["\u{1F514} *Your Alerts:*", ""];

    for (const a of priceAlerts) {
      const status = a.triggered ? "\u{2705} triggered" : "\u{23F3} active";
      lines.push(`Price ${a.direction} $${a.threshold.toLocaleString()} — ${status}`);
    }

    for (const a of ltvAlerts) {
      const status = a.triggered ? "\u{2705} triggered" : "\u{23F3} active";
      lines.push(`LTV ${a.direction} ${(a.ltv_threshold * 100).toFixed(1)}% — ${status}`);
    }

    await this.sendReply(cmd.chatId, lines.join("\n"));
  }

  private async handleEdit(cmd: ParsedCommand): Promise<void> {
    const loan = this.store.getLoanByChatId(cmd.chatId);
    if (!loan) {
      return this.sendReply(cmd.chatId, "No loan found. Use /newloan first.");
    }

    // Parse: /edit field value
    const parts = cmd.args.split(/\s+/);
    if (parts.length < 2) {
      return this.sendReply(cmd.chatId, [
        "*Edit your loan:*",
        "",
        "`/edit amount 60000` — Update loan amount",
        "`/edit collateral 1.5` — Update BTC collateral",
        "`/edit margincall 75` — Update margin call %",
        "`/edit liquidation 90` — Update liquidation %",
        "`/edit interest 12.5` — Update interest rate",
        "`/edit enddate 2025-12-31` — Update end date",
        "`/edit lender BlockFi` — Update lender name",
      ].join("\n"));
    }

    const field = parts[0].toLowerCase();
    const value = parts.slice(1).join(" ");
    const updates: Partial<typeof loan> = {};

    switch (field) {
      case "amount": {
        const n = parseFloat(value.replace(/[,$]/g, ""));
        if (isNaN(n) || n <= 0) return this.sendReply(cmd.chatId, "Invalid amount.");
        updates.loan_amount_usd = n;
        break;
      }
      case "collateral": {
        const n = parseFloat(value);
        if (isNaN(n) || n <= 0) return this.sendReply(cmd.chatId, "Invalid collateral amount.");
        updates.btc_collateral = n;
        break;
      }
      case "margincall": {
        const n = parseFloat(value.replace(/%/g, ""));
        if (isNaN(n) || n <= 0 || n > 100) return this.sendReply(cmd.chatId, "Invalid percentage.");
        updates.margin_call_ltv = n / 100;
        break;
      }
      case "liquidation": {
        const n = parseFloat(value.replace(/%/g, ""));
        if (isNaN(n) || n <= 0 || n > 100) return this.sendReply(cmd.chatId, "Invalid percentage.");
        updates.liquidation_ltv = n / 100;
        break;
      }
      case "interest": {
        const n = parseFloat(value.replace(/%/g, ""));
        if (isNaN(n) || n < 0) return this.sendReply(cmd.chatId, "Invalid rate.");
        updates.interest_rate = n;
        break;
      }
      case "enddate": {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return this.sendReply(cmd.chatId, "Use YYYY-MM-DD format.");
        updates.end_date = value;
        break;
      }
      case "lender": {
        updates.lender_name = value;
        break;
      }
      default:
        return this.sendReply(cmd.chatId, `Unknown field: \`${field}\`. Type /edit for available fields.`);
    }

    this.store.updateLoan(loan.token, updates);
    await this.sendReply(cmd.chatId, `\u{2705} Updated *${field}*. Use /status to see the new snapshot.`);
  }

  private async handleDelete(cmd: ParsedCommand): Promise<void> {
    const loan = this.store.getLoanByChatId(cmd.chatId);
    if (!loan) {
      return this.sendReply(cmd.chatId, "No loan found.");
    }

    if (cmd.args.toLowerCase() !== "confirm") {
      return this.sendReply(cmd.chatId, [
        "\u{26A0}\u{FE0F} This will delete your loan and all alerts.",
        "",
        "Type `/delete confirm` to proceed.",
      ].join("\n"));
    }

    this.store.deleteLoan(loan.token);
    await this.sendReply(cmd.chatId, "\u{1F5D1}\u{FE0F} Loan and all alerts deleted. Use /newloan to start fresh.");
  }

  private async handleHelp(cmd: ParsedCommand): Promise<void> {
    await this.sendReply(cmd.chatId, [
      "*Available Commands:*",
      "",
      "/newloan — Set up a new loan to monitor",
      "/status — View current loan LTV and risk",
      "/alert — Set BTC price or LTV alerts",
      "/alerts — List your active alerts",
      "/edit — Update loan details",
      "/delete — Remove your loan",
      "/help — Show this message",
    ].join("\n"));
  }
}
