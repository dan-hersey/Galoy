// ============================================================
// BTC Loan Monitor — Entry Point
// ============================================================

import { LoanStore } from "./store";
import { PriceOracleService } from "./price-oracle";
import { TelegramBot } from "./bot";
import { AlertEngine } from "./alerts";
import { DashboardServer } from "./server";
import { eventBus } from "./events";
import type { PriceOracleConfig } from "./types";

async function main() {
  console.log("=".repeat(60));
  console.log("  BTC Loan Monitor — Self-Service Edition");
  console.log("=".repeat(60));
  console.log();

  // ── Config ──────────────────────────────────────────────

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const PORT = parseInt(process.env.PORT || "3000", 10);
  const HOST = process.env.DASHBOARD_HOST || `http://localhost:${PORT}`;

  if (!BOT_TOKEN) {
    console.warn("[WARN] TELEGRAM_BOT_TOKEN not set — bot will not start");
    console.warn("[WARN] Set it with: TELEGRAM_BOT_TOKEN=your_token npx tsx src/index.ts");
    console.warn();
  }

  const oracleConfig: PriceOracleConfig = {
    twap_window_seconds: 300,
    circuit_breaker_pct: 10,
    min_sources: 1,
    price_poll_interval_ms: 5000,
  };

  // ── Initialize Services ──────────────────────────────────

  const store = new LoanStore("./data");
  const priceOracle = new PriceOracleService(oracleConfig);
  const server = new DashboardServer(store, PORT);

  // Bot (optional — only if token is set)
  let bot: TelegramBot | null = null;
  if (BOT_TOKEN) {
    bot = new TelegramBot(BOT_TOKEN, store, HOST);
  }

  // Alert engine — uses bot's sendMessage or a no-op
  const sendNotification = bot
    ? (chatId: number, text: string) => bot!.sendMessage(chatId, text)
    : async (_chatId: number, _text: string) => { /* no-op without bot */ };

  const alertEngine = new AlertEngine(store, sendNotification);

  // ── Event Logging ────────────────────────────────────────

  eventBus.on("system:log", (msg) => {
    console.log(`[System] ${msg}`);
  });

  // ── Start ────────────────────────────────────────────────

  // Start server first
  await server.start();

  // Start price oracle
  priceOracle.start();

  // Start alert engine
  alertEngine.start();

  // Start bot
  if (bot) {
    bot.start();
    console.log(`[Bot] Telegram bot started`);
  }

  console.log();
  console.log("  Services running:");
  console.log(`    Dashboard:     ${HOST}`);
  console.log(`    Price Oracle:  3 WebSocket feeds (Coinbase, Kraken, Bitstamp)`);
  console.log(`    Alert Engine:  Monitoring price + LTV crossings`);
  console.log(`    Telegram Bot:  ${bot ? "Active" : "Disabled (no token)"}`);
  console.log();
  console.log("  How to use:");
  if (bot) {
    console.log("    1. Message your bot with /start on Telegram");
    console.log("    2. Use /newloan to enter your loan details");
    console.log("    3. Get a magic link to your live dashboard");
  } else {
    console.log("    Set TELEGRAM_BOT_TOKEN to enable the Telegram bot");
  }
  console.log();

  // ── Graceful Shutdown ────────────────────────────────────

  const shutdown = async () => {
    console.log("\nShutting down...");
    if (bot) bot.stop();
    priceOracle.stop();
    store.flush(); // Save data before exit
    await server.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
