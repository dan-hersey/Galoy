// ============================================================
// Loan Store — In-memory storage with JSON file persistence
// ============================================================

import crypto from "crypto";
import fs from "fs";
import nodePath from "path";
import type {
  SelfServiceLoan,
  PriceAlert,
  LtvAlert,
  ConversationContext,
  ConversationStep,
  LoanSnapshot,
  StressTest,
  RiskTier,
  PriceUpdate,
} from "./types";
import { ConversationStep as CS } from "./types";

interface PersistentData {
  loans: [string, SelfServiceLoan][];
  chatToToken: [number, string][];
  priceAlerts: [string, PriceAlert][];
  ltvAlerts: [string, LtvAlert][];
}

export class LoanStore {
  private loans: Map<string, SelfServiceLoan> = new Map();
  private chatToToken: Map<number, string> = new Map();
  private priceAlerts: Map<string, PriceAlert> = new Map();
  private ltvAlerts: Map<string, LtvAlert> = new Map();
  private conversations: Map<number, ConversationContext> = new Map();
  private lastPrice: PriceUpdate | null = null;

  // Persistence
  private dataFile: string | null = null;
  private saveTimer: NodeJS.Timeout | null = null;

  constructor(dataDir?: string | null) {
    // If dataDir is explicitly null, skip persistence (for tests)
    if (dataDir === null) return;

    // If dataDir is provided or DATA_DIR env is set, enable persistence
    const dir = dataDir || process.env.DATA_DIR || "";
    if (dir) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      this.dataFile = nodePath.join(dir, "loans.json");
      this.loadFromDisk();
    }
  }

  // ── Persistence ──────────────────────────────────────────

  private loadFromDisk() {
    if (!this.dataFile) return;
    try {
      if (fs.existsSync(this.dataFile)) {
        const raw = fs.readFileSync(this.dataFile, "utf-8");
        const data: PersistentData = JSON.parse(raw);
        this.loans = new Map(data.loans || []);
        this.chatToToken = new Map(data.chatToToken || []);
        this.priceAlerts = new Map(data.priceAlerts || []);
        this.ltvAlerts = new Map(data.ltvAlerts || []);
        console.log(`[Store] Loaded ${this.loans.size} loans, ${this.priceAlerts.size} price alerts, ${this.ltvAlerts.size} LTV alerts`);
      }
    } catch (err: any) {
      console.error(`[Store] Failed to load data: ${err.message}`);
    }
  }

  private scheduleSave() {
    if (!this.dataFile) return;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    // Debounce: save at most every 500ms
    this.saveTimer = setTimeout(() => this.saveToDisk(), 500);
  }

  private saveToDisk() {
    if (!this.dataFile) return;
    try {
      const data: PersistentData = {
        loans: Array.from(this.loans.entries()),
        chatToToken: Array.from(this.chatToToken.entries()),
        priceAlerts: Array.from(this.priceAlerts.entries()),
        ltvAlerts: Array.from(this.ltvAlerts.entries()),
      };
      fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2));
    } catch (err: any) {
      console.error(`[Store] Failed to save data: ${err.message}`);
    }
  }

  // Force immediate save (for shutdown)
  flush() {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    this.saveToDisk();
  }

  // ── Loan CRUD ────────────────────────────────────────────

  createLoan(chatId: number, partial: Partial<SelfServiceLoan>): SelfServiceLoan {
    const token = crypto.randomBytes(24).toString("hex");
    const now = Date.now();
    const loan: SelfServiceLoan = {
      token,
      loan_amount_usd: partial.loan_amount_usd || 0,
      btc_collateral: partial.btc_collateral || 0,
      margin_call_ltv: partial.margin_call_ltv || 0.75,
      liquidation_ltv: partial.liquidation_ltv || 0.90,
      interest_rate: partial.interest_rate ?? null,
      end_date: partial.end_date ?? null,
      lender_name: partial.lender_name ?? null,
      chat_id: chatId,
      created_at: now,
      updated_at: now,
    };
    this.loans.set(token, loan);
    this.chatToToken.set(chatId, token);
    this.scheduleSave();
    return loan;
  }

  getLoan(token: string): SelfServiceLoan | null {
    return this.loans.get(token) || null;
  }

  getLoanByChatId(chatId: number): SelfServiceLoan | null {
    const token = this.chatToToken.get(chatId);
    if (!token) return null;
    return this.loans.get(token) || null;
  }

  getAllLoans(): SelfServiceLoan[] {
    return Array.from(this.loans.values());
  }

  updateLoan(token: string, updates: Partial<SelfServiceLoan>): SelfServiceLoan | null {
    const loan = this.loans.get(token);
    if (!loan) return null;
    Object.assign(loan, updates, { updated_at: Date.now() });
    this.scheduleSave();
    return loan;
  }

  deleteLoan(token: string): boolean {
    const loan = this.loans.get(token);
    if (!loan) return false;
    this.chatToToken.delete(loan.chat_id);
    for (const [id, alert] of this.priceAlerts) {
      if (alert.token === token) this.priceAlerts.delete(id);
    }
    for (const [id, alert] of this.ltvAlerts) {
      if (alert.token === token) this.ltvAlerts.delete(id);
    }
    this.loans.delete(token);
    this.scheduleSave();
    return true;
  }

  // ── Price Alerts ─────────────────────────────────────────

  createPriceAlert(token: string, threshold: number, direction: "ABOVE" | "BELOW"): PriceAlert {
    const alert: PriceAlert = {
      alert_id: crypto.randomBytes(8).toString("hex"),
      token,
      threshold,
      direction,
      triggered: false,
      created_at: Date.now(),
      triggered_at: null,
    };
    this.priceAlerts.set(alert.alert_id, alert);
    this.scheduleSave();
    return alert;
  }

  getPriceAlerts(token: string): PriceAlert[] {
    return Array.from(this.priceAlerts.values()).filter((a) => a.token === token);
  }

  getPriceAlert(alertId: string): PriceAlert | null {
    return this.priceAlerts.get(alertId) || null;
  }

  deletePriceAlert(alertId: string): boolean {
    const result = this.priceAlerts.delete(alertId);
    if (result) this.scheduleSave();
    return result;
  }

  getAllPriceAlerts(): PriceAlert[] {
    return Array.from(this.priceAlerts.values());
  }

  // ── LTV Alerts ───────────────────────────────────────────

  createLtvAlert(token: string, ltvThreshold: number, direction: "ABOVE" | "BELOW"): LtvAlert {
    const alert: LtvAlert = {
      alert_id: crypto.randomBytes(8).toString("hex"),
      token,
      ltv_threshold: ltvThreshold,
      direction,
      triggered: false,
      created_at: Date.now(),
      triggered_at: null,
    };
    this.ltvAlerts.set(alert.alert_id, alert);
    this.scheduleSave();
    return alert;
  }

  getLtvAlerts(token: string): LtvAlert[] {
    return Array.from(this.ltvAlerts.values()).filter((a) => a.token === token);
  }

  getLtvAlert(alertId: string): LtvAlert | null {
    return this.ltvAlerts.get(alertId) || null;
  }

  deleteLtvAlert(alertId: string): boolean {
    const result = this.ltvAlerts.delete(alertId);
    if (result) this.scheduleSave();
    return result;
  }

  getAllLtvAlerts(): LtvAlert[] {
    return Array.from(this.ltvAlerts.values());
  }

  // ── Conversation Context ─────────────────────────────────

  startConversation(chatId: number): ConversationContext {
    const ctx: ConversationContext = {
      chat_id: chatId,
      step: CS.AWAITING_AMOUNT,
      partial: {},
      started_at: Date.now(),
      last_activity: Date.now(),
    };
    this.conversations.set(chatId, ctx);
    return ctx;
  }

  getConversation(chatId: number): ConversationContext | null {
    return this.conversations.get(chatId) || null;
  }

  updateConversation(chatId: number, step: ConversationStep, partial: Partial<SelfServiceLoan>): ConversationContext | null {
    const ctx = this.conversations.get(chatId);
    if (!ctx) return null;
    ctx.step = step;
    Object.assign(ctx.partial, partial);
    ctx.last_activity = Date.now();
    return ctx;
  }

  clearConversation(chatId: number): boolean {
    return this.conversations.delete(chatId);
  }

  getActiveConversations(): ConversationContext[] {
    return Array.from(this.conversations.values());
  }

  cleanStaleConversations(): number {
    const timeout = 30 * 60 * 1000;
    const now = Date.now();
    let cleaned = 0;
    for (const [chatId, ctx] of this.conversations) {
      if (now - ctx.last_activity > timeout) {
        this.conversations.delete(chatId);
        cleaned++;
      }
    }
    return cleaned;
  }

  // ── Price State ──────────────────────────────────────────

  setLastPrice(update: PriceUpdate) {
    this.lastPrice = update;
  }

  getLastPrice(): PriceUpdate | null {
    return this.lastPrice;
  }

  // ── Loan Snapshot Computation ────────────────────────────

  computeSnapshot(token: string, btcPrice?: number): LoanSnapshot | null {
    const loan = this.loans.get(token);
    if (!loan) return null;

    const price = btcPrice ?? this.lastPrice?.price ?? 0;
    if (price <= 0) return null;

    const collateralUsd = loan.btc_collateral * price;
    const currentLtv = loan.loan_amount_usd / collateralUsd;
    const marginCallPrice = loan.loan_amount_usd / (loan.btc_collateral * loan.margin_call_ltv);
    const liquidationPrice = loan.loan_amount_usd / (loan.btc_collateral * loan.liquidation_ltv);
    const tier = this.classifyTier(currentLtv, loan.margin_call_ltv, loan.liquidation_ltv);

    const stressTest: StressTest = {
      "5pct_drop": this.stressAt(loan, price * 0.95),
      "10pct_drop": this.stressAt(loan, price * 0.90),
      "20pct_drop": this.stressAt(loan, price * 0.80),
      "30pct_drop": this.stressAt(loan, price * 0.70),
    };

    let daysRemaining: number | null = null;
    if (loan.end_date) {
      const endTs = new Date(loan.end_date).getTime();
      daysRemaining = Math.max(0, Math.ceil((endTs - Date.now()) / (24 * 60 * 60 * 1000)));
    }

    return {
      token,
      btc_price: price,
      collateral_usd: collateralUsd,
      current_ltv: currentLtv,
      margin_call_price: marginCallPrice,
      liquidation_price: liquidationPrice,
      stress_test: stressTest,
      risk_tier: tier,
      days_remaining: daysRemaining,
    };
  }

  private stressAt(loan: SelfServiceLoan, price: number): { price: number; ltv: number; tier: RiskTier } {
    const collateral = loan.btc_collateral * price;
    const ltv = loan.loan_amount_usd / collateral;
    return { price, ltv, tier: this.classifyTier(ltv, loan.margin_call_ltv, loan.liquidation_ltv) };
  }

  classifyTier(ltv: number, marginCallLtv: number, liquidationLtv: number): RiskTier {
    if (ltv >= liquidationLtv) return "LIQUIDATION";
    if (ltv >= marginCallLtv) return "RED";
    const yellowThreshold = marginCallLtv * 0.8;
    if (ltv >= yellowThreshold) return "ORANGE";
    const greenThreshold = marginCallLtv * 0.6;
    if (ltv >= greenThreshold) return "YELLOW";
    return "GREEN";
  }
}
