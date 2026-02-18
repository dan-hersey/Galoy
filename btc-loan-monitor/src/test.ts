// ============================================================
// BTC Loan Monitor — Test Suite
// ============================================================

import http from "http";
import { LoanStore } from "./store";
import { ConversationManager } from "./bot/conversation";
import { CommandHandlers, parseCommand } from "./bot/handlers";
import { AlertEngine } from "./alerts";
import { DashboardServer } from "./server";
import { eventBus } from "./events";
import { ConversationStep } from "./types";
import type { PriceUpdate, SelfServiceLoan } from "./types";

// ── Test Framework ─────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
  } else {
    failed++;
    failures.push(message);
    console.error(`  FAIL: ${message}`);
  }
}

function assertEq(actual: any, expected: any, message: string) {
  if (actual === expected) {
    passed++;
  } else {
    failed++;
    const msg = `${message} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`;
    failures.push(msg);
    console.error(`  FAIL: ${msg}`);
  }
}

function assertClose(actual: number, expected: number, tolerance: number, message: string) {
  if (Math.abs(actual - expected) <= tolerance) {
    passed++;
  } else {
    failed++;
    const msg = `${message} — expected ~${expected}, got ${actual} (tolerance ${tolerance})`;
    failures.push(msg);
    console.error(`  FAIL: ${msg}`);
  }
}

function section(name: string) {
  console.log(`\n--- ${name} ---`);
}

// ── HTTP Helper ────────────────────────────────────────────

function httpRequest(
  method: string,
  path: string,
  port: number,
  body?: any,
): Promise<{ status: number; body: any; raw: string }> {
  return new Promise((resolve, reject) => {
    const options: http.RequestOptions = {
      hostname: "127.0.0.1",
      port,
      path,
      method,
      headers: body ? { "Content-Type": "application/json" } : {},
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode || 0, body: parsed, raw: data });
        } catch {
          resolve({ status: res.statusCode || 0, body: null, raw: data });
        }
      });
    });

    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ── Tests ──────────────────────────────────────────────────

async function runTests() {
  console.log("BTC Loan Monitor — Test Suite");
  console.log("=".repeat(50));

  // ============================================================
  // 1. Store — Loan CRUD
  // ============================================================
  section("Store — Loan CRUD");

  const store = new LoanStore();

  // Create loan
  const loan = store.createLoan(12345, {
    loan_amount_usd: 50000,
    btc_collateral: 1.5,
    margin_call_ltv: 0.75,
    liquidation_ltv: 0.90,
    interest_rate: 12.5,
    end_date: "2026-12-31",
    lender_name: "TestLender",
  });
  assert(loan.token.length === 48, "Token is 48 hex chars");
  assertEq(loan.loan_amount_usd, 50000, "Loan amount");
  assertEq(loan.btc_collateral, 1.5, "BTC collateral");
  assertEq(loan.margin_call_ltv, 0.75, "Margin call LTV");
  assertEq(loan.liquidation_ltv, 0.90, "Liquidation LTV");
  assertEq(loan.interest_rate, 12.5, "Interest rate");
  assertEq(loan.end_date, "2026-12-31", "End date");
  assertEq(loan.lender_name, "TestLender", "Lender name");
  assertEq(loan.chat_id, 12345, "Chat ID");

  // Get loan by token
  const retrieved = store.getLoan(loan.token);
  assertEq(retrieved?.token, loan.token, "Get loan by token");

  // Get loan by chat ID
  const byChatId = store.getLoanByChatId(12345);
  assertEq(byChatId?.token, loan.token, "Get loan by chat ID");

  // Get all loans
  assertEq(store.getAllLoans().length, 1, "Get all loans");

  // Update loan
  const updated = store.updateLoan(loan.token, { loan_amount_usd: 60000 });
  assertEq(updated?.loan_amount_usd, 60000, "Update loan amount");

  // Non-existent loan
  assertEq(store.getLoan("nonexistent"), null, "Non-existent loan returns null");
  assertEq(store.updateLoan("nonexistent", {}), null, "Update non-existent returns null");

  // Delete loan
  const loan2 = store.createLoan(99999, { loan_amount_usd: 10000, btc_collateral: 0.5 });
  assert(store.deleteLoan(loan2.token), "Delete loan returns true");
  assertEq(store.getLoan(loan2.token), null, "Deleted loan is gone");
  assertEq(store.getLoanByChatId(99999), null, "Deleted loan chat lookup gone");
  assert(!store.deleteLoan("nonexistent"), "Delete non-existent returns false");

  // ============================================================
  // 2. Store — Price Alerts
  // ============================================================
  section("Store — Price Alerts");

  const priceAlert = store.createPriceAlert(loan.token, 60000, "BELOW");
  assertEq(priceAlert.threshold, 60000, "Price alert threshold");
  assertEq(priceAlert.direction, "BELOW", "Price alert direction");
  assertEq(priceAlert.triggered, false, "Price alert not triggered");
  assert(priceAlert.alert_id.length > 0, "Price alert has ID");

  const priceAlert2 = store.createPriceAlert(loan.token, 100000, "ABOVE");
  assertEq(store.getPriceAlerts(loan.token).length, 2, "Two price alerts");

  assertEq(store.getPriceAlert(priceAlert.alert_id)?.threshold, 60000, "Get price alert by ID");
  assertEq(store.getPriceAlert("nonexistent"), null, "Non-existent price alert");

  assert(store.deletePriceAlert(priceAlert2.alert_id), "Delete price alert");
  assertEq(store.getPriceAlerts(loan.token).length, 1, "One price alert after delete");

  // ============================================================
  // 3. Store — LTV Alerts
  // ============================================================
  section("Store — LTV Alerts");

  const ltvAlert = store.createLtvAlert(loan.token, 0.80, "ABOVE");
  assertEq(ltvAlert.ltv_threshold, 0.80, "LTV alert threshold");
  assertEq(ltvAlert.direction, "ABOVE", "LTV alert direction");
  assert(ltvAlert.alert_id.length > 0, "LTV alert has ID");

  const ltvAlert2 = store.createLtvAlert(loan.token, 0.50, "BELOW");
  assertEq(store.getLtvAlerts(loan.token).length, 2, "Two LTV alerts");

  assert(store.deleteLtvAlert(ltvAlert2.alert_id), "Delete LTV alert");
  assertEq(store.getLtvAlerts(loan.token).length, 1, "One LTV alert after delete");

  // ============================================================
  // 4. Store — Conversation Context
  // ============================================================
  section("Store — Conversation Context");

  const ctx = store.startConversation(55555);
  assertEq(ctx.step, ConversationStep.AWAITING_AMOUNT, "Conversation starts at AWAITING_AMOUNT");
  assertEq(ctx.chat_id, 55555, "Conversation chat ID");

  const updatedCtx = store.updateConversation(55555, ConversationStep.AWAITING_COLLATERAL, { loan_amount_usd: 50000 });
  assertEq(updatedCtx?.step, ConversationStep.AWAITING_COLLATERAL, "Updated step");
  assertEq(updatedCtx?.partial.loan_amount_usd, 50000, "Updated partial");

  assertEq(store.getConversation(55555)?.step, ConversationStep.AWAITING_COLLATERAL, "Get conversation");
  assertEq(store.getConversation(99998), null, "Non-existent conversation");

  assert(store.clearConversation(55555), "Clear conversation");
  assertEq(store.getConversation(55555), null, "Cleared conversation gone");

  // Stale cleanup
  const staleCtx = store.startConversation(88888);
  // Manually set last_activity to 31 minutes ago
  const rawCtx = store.getConversation(88888)!;
  rawCtx.last_activity = Date.now() - 31 * 60 * 1000;
  const cleaned = store.cleanStaleConversations();
  assertEq(cleaned, 1, "Cleaned 1 stale conversation");
  assertEq(store.getConversation(88888), null, "Stale conversation gone");

  // ============================================================
  // 5. Store — LTV Computation
  // ============================================================
  section("Store — LTV Computation");

  // loan: $60,000 loan, 1.5 BTC collateral
  // At BTC=$100,000: collateral=$150,000, LTV=60,000/150,000=0.4
  const snapshot1 = store.computeSnapshot(loan.token, 100000);
  assert(snapshot1 !== null, "Snapshot computed");
  assertClose(snapshot1!.current_ltv, 0.4, 0.001, "LTV at $100K");
  assertEq(snapshot1!.risk_tier, "GREEN", "Tier is GREEN at 40% LTV");
  assertClose(snapshot1!.collateral_usd, 150000, 1, "Collateral value at $100K");

  // Margin call price: loan / (btc * margin_call_ltv) = 60000 / (1.5 * 0.75) = 53333.33
  assertClose(snapshot1!.margin_call_price, 53333.33, 1, "Margin call price");

  // Liquidation price: loan / (btc * liquidation_ltv) = 60000 / (1.5 * 0.90) = 44444.44
  assertClose(snapshot1!.liquidation_price, 44444.44, 1, "Liquidation price");

  // At BTC=$50,000: LTV=60000/75000=0.8 → RED
  const snapshot2 = store.computeSnapshot(loan.token, 50000);
  assertClose(snapshot2!.current_ltv, 0.8, 0.001, "LTV at $50K");
  assertEq(snapshot2!.risk_tier, "RED", "Tier is RED at 80% LTV");

  // At BTC=$40,000: LTV=60000/60000=1.0 → LIQUIDATION
  const snapshot3 = store.computeSnapshot(loan.token, 40000);
  assertClose(snapshot3!.current_ltv, 1.0, 0.001, "LTV at $40K");
  assertEq(snapshot3!.risk_tier, "LIQUIDATION", "Tier is LIQUIDATION at 100% LTV");

  // Stress test
  assert(snapshot1!.stress_test["5pct_drop"].price === 95000, "Stress -5% price");
  assertClose(snapshot1!.stress_test["10pct_drop"].ltv, 60000 / (1.5 * 90000), 0.001, "Stress -10% LTV");
  assertClose(snapshot1!.stress_test["30pct_drop"].ltv, 60000 / (1.5 * 70000), 0.001, "Stress -30% LTV");

  // Days remaining
  assert(snapshot1!.days_remaining !== null, "Days remaining is computed");
  assert(snapshot1!.days_remaining! > 0, "Days remaining is positive");

  // Non-existent loan
  assertEq(store.computeSnapshot("nonexistent"), null, "Non-existent loan snapshot is null");

  // Zero price
  assertEq(store.computeSnapshot(loan.token, 0), null, "Zero price returns null");

  // ============================================================
  // 6. Store — Tier Classification
  // ============================================================
  section("Store — Tier Classification");

  // With margin_call=0.75, liquidation=0.90
  // GREEN: < 0.75 * 0.6 = 0.45
  // YELLOW: 0.45 - 0.60
  // ORANGE: 0.60 - 0.75
  // RED: 0.75 - 0.90
  // LIQUIDATION: >= 0.90
  assertEq(store.classifyTier(0.30, 0.75, 0.90), "GREEN", "30% → GREEN");
  assertEq(store.classifyTier(0.44, 0.75, 0.90), "GREEN", "44% → GREEN");
  assertEq(store.classifyTier(0.46, 0.75, 0.90), "YELLOW", "46% → YELLOW");
  assertEq(store.classifyTier(0.59, 0.75, 0.90), "YELLOW", "59% → YELLOW");
  assertEq(store.classifyTier(0.61, 0.75, 0.90), "ORANGE", "61% → ORANGE");
  assertEq(store.classifyTier(0.74, 0.75, 0.90), "ORANGE", "74% → ORANGE");
  assertEq(store.classifyTier(0.76, 0.75, 0.90), "RED", "76% → RED");
  assertEq(store.classifyTier(0.89, 0.75, 0.90), "RED", "89% → RED");
  assertEq(store.classifyTier(0.91, 0.75, 0.90), "LIQUIDATION", "91% → LIQUIDATION");
  assertEq(store.classifyTier(1.5, 0.75, 0.90), "LIQUIDATION", "150% → LIQUIDATION");

  // ============================================================
  // 7. Conversation Manager
  // ============================================================
  section("Conversation Manager");

  const convStore = new LoanStore();
  const convManager = new ConversationManager(convStore);

  // Start conversation
  convStore.startConversation(11111);

  // Step 1: Loan amount
  const step1 = convManager.processInput(11111, "50000");
  assertEq(step1.error, undefined, "Valid amount has no error");
  assertEq(step1.field, "loan_amount_usd", "Field is loan_amount_usd");
  assertEq(step1.value, 50000, "Value is 50000");
  assertEq(step1.nextStep, ConversationStep.AWAITING_COLLATERAL, "Next step is collateral");

  // Validation errors
  convStore.startConversation(22222);
  const badAmount = convManager.processInput(22222, "abc");
  assert(badAmount.error !== undefined, "Invalid amount has error");
  assertEq(badAmount.nextStep, ConversationStep.AWAITING_AMOUNT, "Stays at same step on error");

  const negAmount = convManager.processInput(22222, "-500");
  assert(negAmount.error !== undefined, "Negative amount has error");

  // Step 2: Collateral
  const step2 = convManager.processInput(11111, "1.5");
  assertEq(step2.field, "btc_collateral", "Field is btc_collateral");
  assertEq(step2.value, 1.5, "Value is 1.5");

  // Step 3: Margin call
  const step3 = convManager.processInput(11111, "75");
  assertEq(step3.field, "margin_call_ltv", "Field is margin_call_ltv");
  assertClose(step3.value as number, 0.75, 0.001, "Value is 0.75");

  // Step 4: Liquidation
  const step4 = convManager.processInput(11111, "90%");
  assertEq(step4.field, "liquidation_ltv", "Field is liquidation_ltv");
  assertClose(step4.value as number, 0.90, 0.001, "Value is 0.90 (with % sign)");

  // Step 5: Interest (optional, skip)
  const step5 = convManager.processInput(11111, "skip");
  assertEq(step5.field, "interest_rate", "Field is interest_rate");
  assertEq(step5.value, null, "Skipped interest rate is null");

  // Step 6: End date
  const step6 = convManager.processInput(11111, "2026-12-31");
  assertEq(step6.field, "end_date", "Field is end_date");
  assertEq(step6.value, "2026-12-31", "End date value");

  // Step 7: Lender
  const step7 = convManager.processInput(11111, "BlockFi");
  assertEq(step7.field, "lender_name", "Field is lender_name");
  assertEq(step7.value, "BlockFi", "Lender value");
  assertEq(step7.nextStep, ConversationStep.CONFIRM, "Next step is CONFIRM");

  // Confirmation message
  const confirmMsg = convManager.buildConfirmationMessage(11111);
  assert(confirmMsg !== null, "Confirmation message exists");
  assert(confirmMsg!.includes("50,000") || confirmMsg!.includes("50000"), "Confirm message has amount");
  assert(confirmMsg!.includes("BlockFi"), "Confirm message has lender");

  // Confirm and create loan
  const result = convManager.confirmAndCreateLoan(11111, "http://localhost:3000");
  assert(result !== null, "Loan created");
  assert(result!.token.length === 48, "Token is 48 chars");
  assert(result!.dashboardUrl.includes(result!.token), "Dashboard URL includes token");

  // Conversation cleared after creation
  assertEq(convStore.getConversation(11111), null, "Conversation cleared after creation");

  // Date validation
  convStore.startConversation(33333);
  convManager.processInput(33333, "50000"); // amount
  convManager.processInput(33333, "1.0");   // collateral
  convManager.processInput(33333, "75");    // margin call
  convManager.processInput(33333, "90");    // liquidation
  convManager.processInput(33333, "skip");  // interest
  const badDate = convManager.processInput(33333, "not-a-date");
  assert(badDate.error !== undefined, "Bad date format has error");

  // ============================================================
  // 8. Command Parsing
  // ============================================================
  section("Command Parsing");

  const cmd1 = parseCommand("/start", 111, 222, "testuser");
  assertEq(cmd1?.command, "start", "Parse /start");
  assertEq(cmd1?.chatId, 111, "Chat ID");
  assertEq(cmd1?.username, "testuser", "Username");

  const cmd2 = parseCommand("/alert price 60000 BELOW", 111, 222);
  assertEq(cmd2?.command, "alert", "Parse /alert");
  assertEq(cmd2?.args, "price 60000 BELOW", "Args");

  const cmd3 = parseCommand("/newloan@mybot", 111, 222);
  assertEq(cmd3?.command, "newloan", "Parse with bot name");
  assertEq(cmd3?.args, "", "Empty args");

  const cmd4 = parseCommand("hello", 111, 222);
  assertEq(cmd4, null, "Non-command returns null");

  const cmd5 = parseCommand("", 111, 222);
  assertEq(cmd5, null, "Empty string returns null");

  const cmd6 = parseCommand("/edit amount 60000", 111, 222);
  assertEq(cmd6?.command, "edit", "Parse /edit");
  assertEq(cmd6?.args, "amount 60000", "Edit args");

  const cmd7 = parseCommand("/delete confirm", 111, 222);
  assertEq(cmd7?.command, "delete", "Parse /delete");
  assertEq(cmd7?.args, "confirm", "Delete args");

  // ============================================================
  // 9. Command Handlers
  // ============================================================
  section("Command Handlers");

  const handlerStore = new LoanStore();
  const handlerConv = new ConversationManager(handlerStore);
  const replies: { chatId: number; text: string }[] = [];
  const mockSend = async (chatId: number, text: string) => {
    replies.push({ chatId, text });
  };

  const handlers = new CommandHandlers(handlerStore, handlerConv, mockSend, "http://localhost:3000");

  // /start
  replies.length = 0;
  await handlers.handleCommand({ command: "start", args: "", chatId: 100, userId: 100, username: "testbot" });
  assertEq(replies.length, 1, "/start sends reply");
  assert(replies[0].text.includes("Welcome"), "/start reply has welcome");

  // /help
  replies.length = 0;
  await handlers.handleCommand({ command: "help", args: "", chatId: 100, userId: 100 });
  assertEq(replies.length, 1, "/help sends reply");
  assert(replies[0].text.includes("/newloan"), "/help mentions /newloan");

  // /newloan (starts conversation)
  replies.length = 0;
  await handlers.handleCommand({ command: "newloan", args: "", chatId: 100, userId: 100 });
  assertEq(replies.length, 1, "/newloan sends prompt");
  assert(replies[0].text.includes("loan amount"), "/newloan asks for amount");

  // Walk through conversation
  replies.length = 0;
  await handlers.handleConversationInput(100, "50000");
  assert(replies.length === 1, "Amount step sends next prompt");

  replies.length = 0;
  await handlers.handleConversationInput(100, "1.5");
  assert(replies.length === 1, "Collateral step sends next prompt");

  replies.length = 0;
  await handlers.handleConversationInput(100, "75");
  assert(replies.length === 1, "Margin call step sends next prompt");

  replies.length = 0;
  await handlers.handleConversationInput(100, "90");
  assert(replies.length === 1, "Liquidation step sends next prompt");

  replies.length = 0;
  await handlers.handleConversationInput(100, "skip");
  assert(replies.length === 1, "Interest skip sends next prompt");

  replies.length = 0;
  await handlers.handleConversationInput(100, "skip");
  assert(replies.length === 1, "End date skip sends next prompt");

  replies.length = 0;
  await handlers.handleConversationInput(100, "TestLender");
  assert(replies.length === 1, "Lender sends confirmation");
  assert(replies[0].text.includes("confirm"), "Shows confirmation prompt");

  // Confirm
  replies.length = 0;
  await handlers.handleConversationInput(100, "yes");
  assertEq(replies.length, 1, "Confirmation sends dashboard link");
  assert(replies[0].text.includes("dashboard") || replies[0].text.includes("/dash/"), "Reply has dashboard URL");

  // Verify loan was created
  const createdLoan = handlerStore.getLoanByChatId(100);
  assert(createdLoan !== null, "Loan was created via conversation");
  assertEq(createdLoan!.loan_amount_usd, 50000, "Conversation loan amount");
  assertEq(createdLoan!.lender_name, "TestLender", "Conversation lender");

  // /status (need price)
  handlerStore.setLastPrice({
    price: 100000,
    timestamp: Date.now(),
    sources: ["test"],
    twap_5m: 100000,
    confidence: "HIGH",
    circuit_breaker: false,
  });

  replies.length = 0;
  await handlers.handleCommand({ command: "status", args: "", chatId: 100, userId: 100 });
  assertEq(replies.length, 1, "/status sends reply");
  assert(replies[0].text.includes("LTV"), "/status has LTV");
  assert(replies[0].text.includes("Stress"), "/status has stress test");

  // /status without loan
  replies.length = 0;
  await handlers.handleCommand({ command: "status", args: "", chatId: 999, userId: 999 });
  assert(replies[0].text.includes("No loan"), "/status without loan says no loan");

  // /alert price
  replies.length = 0;
  await handlers.handleCommand({ command: "alert", args: "price 60000 BELOW", chatId: 100, userId: 100 });
  assert(replies[0].text.includes("alert set"), "/alert creates price alert");

  // /alert ltv
  replies.length = 0;
  await handlers.handleCommand({ command: "alert", args: "ltv 80 ABOVE", chatId: 100, userId: 100 });
  assert(replies[0].text.includes("alert set"), "/alert creates LTV alert");

  // /alert bad args
  replies.length = 0;
  await handlers.handleCommand({ command: "alert", args: "", chatId: 100, userId: 100 });
  assert(replies[0].text.includes("Price alert") || replies[0].text.includes("Set an alert"), "/alert no args shows help");

  // /alert bad direction
  replies.length = 0;
  await handlers.handleCommand({ command: "alert", args: "price 60000 SIDEWAYS", chatId: 100, userId: 100 });
  assert(replies[0].text.includes("ABOVE") || replies[0].text.includes("BELOW"), "/alert bad direction");

  // /alerts
  replies.length = 0;
  await handlers.handleCommand({ command: "alerts", args: "", chatId: 100, userId: 100 });
  assert(replies[0].text.includes("60000") || replies[0].text.includes("60,000"), "/alerts lists price alert");

  // /edit
  replies.length = 0;
  await handlers.handleCommand({ command: "edit", args: "amount 70000", chatId: 100, userId: 100 });
  assert(replies[0].text.includes("Updated"), "/edit updates field");
  assertEq(handlerStore.getLoanByChatId(100)!.loan_amount_usd, 70000, "Loan amount updated via /edit");

  // /edit bad field
  replies.length = 0;
  await handlers.handleCommand({ command: "edit", args: "foo bar", chatId: 100, userId: 100 });
  assert(replies[0].text.includes("Unknown field"), "/edit bad field");

  // /edit no args shows help
  replies.length = 0;
  await handlers.handleCommand({ command: "edit", args: "", chatId: 100, userId: 100 });
  assert(replies[0].text.includes("Edit your loan"), "/edit no args shows help");

  // /delete without confirm
  replies.length = 0;
  await handlers.handleCommand({ command: "delete", args: "", chatId: 100, userId: 100 });
  assert(replies[0].text.includes("confirm"), "/delete asks for confirmation");

  // /delete confirm
  replies.length = 0;
  await handlers.handleCommand({ command: "delete", args: "confirm", chatId: 100, userId: 100 });
  assert(replies[0].text.includes("deleted") || replies[0].text.includes("Deleted"), "/delete confirm deletes");
  assertEq(handlerStore.getLoanByChatId(100), null, "Loan deleted via /delete");

  // /newloan conversation with cancel
  replies.length = 0;
  await handlers.handleCommand({ command: "newloan", args: "", chatId: 100, userId: 100 });
  await handlers.handleConversationInput(100, "50000");
  await handlers.handleConversationInput(100, "cancel");
  assertEq(handlerStore.getConversation(100), null, "Cancel clears conversation");

  // Unknown command
  replies.length = 0;
  await handlers.handleCommand({ command: "unknown", args: "", chatId: 100, userId: 100 });
  assert(replies[0].text.includes("Unknown command"), "Unknown command response");

  // ============================================================
  // 10. Alert Engine — Price Crossing
  // ============================================================
  section("Alert Engine — Price Crossing");

  const alertStore = new LoanStore();
  const notifications: { chatId: number; text: string }[] = [];
  const alertEngine = new AlertEngine(alertStore, async (chatId, text) => {
    notifications.push({ chatId, text });
  });

  // Create a loan
  const alertLoan = alertStore.createLoan(44444, {
    loan_amount_usd: 50000,
    btc_collateral: 1.0,
    margin_call_ltv: 0.75,
    liquidation_ltv: 0.90,
  });

  // Create a price alert: notify when BTC goes below $60,000
  alertStore.createPriceAlert(alertLoan.token, 60000, "BELOW");

  // Price starts at $70,000 — above threshold
  notifications.length = 0;
  await alertEngine.processPrice(70000);
  assertEq(notifications.length, 0, "No notification at $70K (above threshold)");

  // Price drops to $65,000 — still above
  notifications.length = 0;
  await alertEngine.processPrice(65000);
  assertEq(notifications.length, 0, "No notification at $65K");

  // Price drops to $58,000 — crosses below $60K
  notifications.length = 0;
  await alertEngine.processPrice(58000);
  assertEq(notifications.length, 1, "Notification triggered at $58K");
  assert(notifications[0].text.includes("below"), "Notification says below");
  assertEq(notifications[0].chatId, 44444, "Notification to correct chat");

  // Second time at $55K — already triggered, no duplicate
  notifications.length = 0;
  await alertEngine.processPrice(55000);
  assertEq(notifications.length, 0, "No duplicate after trigger");

  // Alert is marked triggered
  const triggeredAlerts = alertStore.getPriceAlerts(alertLoan.token);
  assert(triggeredAlerts[0].triggered, "Alert marked triggered");
  assert(triggeredAlerts[0].triggered_at !== null, "Triggered_at is set");

  // ABOVE alert test
  alertStore.createPriceAlert(alertLoan.token, 80000, "ABOVE");

  notifications.length = 0;
  await alertEngine.processPrice(75000);
  assertEq(notifications.length, 0, "No notification at $75K (below threshold)");

  notifications.length = 0;
  await alertEngine.processPrice(82000);
  assertEq(notifications.length, 1, "Notification at $82K (crosses above $80K)");
  assert(notifications[0].text.includes("above"), "Notification says above");

  // ============================================================
  // 11. Alert Engine — LTV Crossing
  // ============================================================
  section("Alert Engine — LTV Crossing");

  const ltvAlertStore = new LoanStore();
  const ltvNotifications: { chatId: number; text: string }[] = [];
  const ltvAlertEngine = new AlertEngine(ltvAlertStore, async (chatId, text) => {
    ltvNotifications.push({ chatId, text });
  });

  const ltvLoan = ltvAlertStore.createLoan(55555, {
    loan_amount_usd: 50000,
    btc_collateral: 1.0,
    margin_call_ltv: 0.75,
    liquidation_ltv: 0.90,
  });

  // Alert: notify when LTV goes above 70%
  ltvAlertStore.createLtvAlert(ltvLoan.token, 0.70, "ABOVE");

  // At $100K: LTV = 50000/100000 = 50% — below threshold
  ltvNotifications.length = 0;
  await ltvAlertEngine.processPrice(100000);
  assertEq(ltvNotifications.length, 0, "No LTV notification at 50%");

  // At $80K: LTV = 50000/80000 = 62.5% — still below
  ltvNotifications.length = 0;
  await ltvAlertEngine.processPrice(80000);
  assertEq(ltvNotifications.length, 0, "No LTV notification at 62.5%");

  // At $65K: LTV = 50000/65000 = 76.9% — crosses above 70%
  ltvNotifications.length = 0;
  await ltvAlertEngine.processPrice(65000);
  assertEq(ltvNotifications.length, 1, "LTV notification at 76.9%");
  assert(ltvNotifications[0].text.includes("LTV"), "LTV notification mentions LTV");

  // No duplicate
  ltvNotifications.length = 0;
  await ltvAlertEngine.processPrice(60000);
  assertEq(ltvNotifications.length, 0, "No LTV duplicate");

  // ============================================================
  // 12. HTTP Server — API Endpoints
  // ============================================================
  section("HTTP Server — API Endpoints");

  const serverStore = new LoanStore();
  const testPort = 3999;
  const server = new DashboardServer(serverStore, testPort);
  await server.start();

  // Set price
  serverStore.setLastPrice({
    price: 100000,
    timestamp: Date.now(),
    sources: ["test"],
    twap_5m: 100000,
    confidence: "HIGH",
    circuit_breaker: false,
  });

  // Create a loan
  const serverLoan = serverStore.createLoan(77777, {
    loan_amount_usd: 50000,
    btc_collateral: 1.5,
    margin_call_ltv: 0.75,
    liquidation_ltv: 0.90,
    interest_rate: 10,
    end_date: "2026-12-31",
    lender_name: "TestBank",
  });

  // Health check
  const healthRes = await httpRequest("GET", "/health", testPort);
  assertEq(healthRes.status, 200, "Health check 200");
  assertEq(healthRes.body.status, "ok", "Health check ok");

  // Price endpoint
  const priceRes = await httpRequest("GET", "/api/price", testPort);
  assertEq(priceRes.status, 200, "Price endpoint 200");
  assertEq(priceRes.body.price, 100000, "Price value");

  // Loan snapshot
  const loanRes = await httpRequest("GET", `/api/loan/${serverLoan.token}`, testPort);
  assertEq(loanRes.status, 200, "Loan snapshot 200");
  assertClose(loanRes.body.current_ltv, 50000 / (1.5 * 100000), 0.001, "Loan LTV from API");
  assertEq(loanRes.body.lender_name, "TestBank", "Lender name from API");

  // Non-existent loan
  const noLoanRes = await httpRequest("GET", "/api/loan/" + "a".repeat(48), testPort);
  assertEq(noLoanRes.status, 404, "Non-existent loan 404");

  // Simulate
  const simRes = await httpRequest("GET", `/api/loan/${serverLoan.token}/simulate?price=80000`, testPort);
  assertEq(simRes.status, 200, "Simulate 200");
  assertClose(simRes.body.current_ltv, 50000 / (1.5 * 80000), 0.001, "Simulated LTV");

  // Simulate bad price
  const simBadRes = await httpRequest("GET", `/api/loan/${serverLoan.token}/simulate?price=abc`, testPort);
  assertEq(simBadRes.status, 400, "Simulate bad price 400");

  // Create price alert via API
  const createAlertRes = await httpRequest("POST", `/api/loan/${serverLoan.token}/alerts`, testPort, {
    type: "price",
    threshold: 60000,
    direction: "BELOW",
  });
  assertEq(createAlertRes.status, 201, "Create alert 201");
  assertEq(createAlertRes.body.threshold, 60000, "Alert threshold");
  assertEq(createAlertRes.body.direction, "BELOW", "Alert direction");

  // Create LTV alert via API
  const createLtvAlertRes = await httpRequest("POST", `/api/loan/${serverLoan.token}/alerts`, testPort, {
    type: "ltv",
    threshold: 80,
    direction: "ABOVE",
  });
  assertEq(createLtvAlertRes.status, 201, "Create LTV alert 201");
  assertClose(createLtvAlertRes.body.ltv_threshold, 0.80, 0.001, "LTV alert threshold normalized");

  // Get alerts
  const alertsRes = await httpRequest("GET", `/api/loan/${serverLoan.token}/alerts`, testPort);
  assertEq(alertsRes.status, 200, "Get alerts 200");
  assertEq(alertsRes.body.price_alerts.length, 1, "1 price alert");
  assertEq(alertsRes.body.ltv_alerts.length, 1, "1 LTV alert");

  // Delete alert
  const alertId = alertsRes.body.price_alerts[0].alert_id;
  const deleteRes = await httpRequest("DELETE", `/api/loan/${serverLoan.token}/alerts/${alertId}`, testPort);
  assertEq(deleteRes.status, 200, "Delete alert 200");

  // Verify deleted
  const alertsAfterDel = await httpRequest("GET", `/api/loan/${serverLoan.token}/alerts`, testPort);
  assertEq(alertsAfterDel.body.price_alerts.length, 0, "0 price alerts after delete");

  // Delete non-existent alert
  const deleteNotFound = await httpRequest("DELETE", `/api/loan/${serverLoan.token}/alerts/nonexistent`, testPort);
  assertEq(deleteNotFound.status, 404, "Delete non-existent alert 404");

  // Create alert bad body
  const badAlertRes = await httpRequest("POST", `/api/loan/${serverLoan.token}/alerts`, testPort, {
    type: "price",
  });
  assertEq(badAlertRes.status, 400, "Create alert missing fields 400");

  // Create alert bad type
  const badTypeRes = await httpRequest("POST", `/api/loan/${serverLoan.token}/alerts`, testPort, {
    type: "foo",
    threshold: 60000,
    direction: "BELOW",
  });
  assertEq(badTypeRes.status, 400, "Create alert bad type 400");

  // Dashboard page
  const dashRes = await httpRequest("GET", `/dash/${serverLoan.token}`, testPort);
  assertEq(dashRes.status, 200, "Dashboard 200");
  assert(dashRes.raw.includes("<!DOCTYPE html>"), "Dashboard is HTML");
  assert(dashRes.raw.includes(serverLoan.token), "Dashboard has token injected");

  // Dashboard 404 for bad token
  const dashBadRes = await httpRequest("GET", "/dash/" + "b".repeat(48), testPort);
  assertEq(dashBadRes.status, 404, "Dashboard bad token 404");

  // 404 for unknown route
  const notFoundRes = await httpRequest("GET", "/foo/bar", testPort);
  assertEq(notFoundRes.status, 404, "Unknown route 404");

  // Stop server
  await server.stop();

  // ============================================================
  // 13. Loan with lastPrice from store
  // ============================================================
  section("Store — lastPrice integration");

  const lpStore = new LoanStore();
  const lpLoan = lpStore.createLoan(66666, {
    loan_amount_usd: 50000,
    btc_collateral: 1.0,
  });

  // No price set — snapshot should be null
  assertEq(lpStore.computeSnapshot(lpLoan.token), null, "No price → null snapshot");

  // Set price
  lpStore.setLastPrice({
    price: 100000,
    timestamp: Date.now(),
    sources: ["test"],
    twap_5m: 100000,
    confidence: "HIGH",
    circuit_breaker: false,
  });

  const lpSnapshot = lpStore.computeSnapshot(lpLoan.token);
  assert(lpSnapshot !== null, "Has snapshot after setting price");
  assertClose(lpSnapshot!.current_ltv, 0.5, 0.001, "LTV from store price");

  // ============================================================
  // 14. Edge Cases
  // ============================================================
  section("Edge Cases");

  // Loan with optional fields null
  const minLoan = new LoanStore();
  const minimal = minLoan.createLoan(88888, {
    loan_amount_usd: 10000,
    btc_collateral: 0.5,
  });
  assertEq(minimal.interest_rate, null, "Default interest null");
  assertEq(minimal.end_date, null, "Default end date null");
  assertEq(minimal.lender_name, null, "Default lender null");
  assertEq(minimal.margin_call_ltv, 0.75, "Default margin call 0.75");
  assertEq(minimal.liquidation_ltv, 0.90, "Default liquidation 0.90");

  // Snapshot with no end date → days_remaining null
  minLoan.setLastPrice({
    price: 50000,
    timestamp: Date.now(),
    sources: ["test"],
    twap_5m: 50000,
    confidence: "HIGH",
    circuit_breaker: false,
  });
  const minSnap = minLoan.computeSnapshot(minimal.token);
  assertEq(minSnap!.days_remaining, null, "No end date → null days remaining");

  // Delete loan also deletes its alerts
  const delStore = new LoanStore();
  const delLoan = delStore.createLoan(77777, { loan_amount_usd: 10000, btc_collateral: 0.5 });
  delStore.createPriceAlert(delLoan.token, 50000, "BELOW");
  delStore.createLtvAlert(delLoan.token, 0.80, "ABOVE");
  assertEq(delStore.getPriceAlerts(delLoan.token).length, 1, "Has price alert before delete");
  assertEq(delStore.getLtvAlerts(delLoan.token).length, 1, "Has LTV alert before delete");
  delStore.deleteLoan(delLoan.token);
  assertEq(delStore.getPriceAlerts(delLoan.token).length, 0, "Price alerts gone after delete");
  assertEq(delStore.getLtvAlerts(delLoan.token).length, 0, "LTV alerts gone after delete");

  // Amount parsing with comma/dollar sign
  const fmtStore = new LoanStore();
  const fmtConv = new ConversationManager(fmtStore);
  fmtStore.startConversation(77778);
  const fmtResult = fmtConv.processInput(77778, "$50,000");
  assertEq(fmtResult.value, 50000, "Parses $50,000 correctly");

  // Margin call validation edge: percentage signs
  fmtConv.processInput(77778, "1.5"); // collateral
  const pctResult = fmtConv.processInput(77778, "75%");
  assertClose(pctResult.value as number, 0.75, 0.001, "Parses 75% correctly");

  // ============================================================
  // Summary
  // ============================================================
  console.log("\n" + "=".repeat(50));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failures.length > 0) {
    console.log("\nFailures:");
    for (const f of failures) {
      console.log(`  - ${f}`);
    }
  }
  console.log("=".repeat(50));

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
