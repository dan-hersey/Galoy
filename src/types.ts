// ============================================================
// BTC Loan Monitor — Core Types
// ============================================================

// --- Conversation State Machine ---
export enum ConversationStep {
  IDLE = "IDLE",
  AWAITING_AMOUNT = "AWAITING_AMOUNT",
  AWAITING_COLLATERAL = "AWAITING_COLLATERAL",
  AWAITING_MARGIN_CALL = "AWAITING_MARGIN_CALL",
  AWAITING_LIQUIDATION = "AWAITING_LIQUIDATION",
  AWAITING_INTEREST = "AWAITING_INTEREST",
  AWAITING_END_DATE = "AWAITING_END_DATE",
  AWAITING_LENDER = "AWAITING_LENDER",
  CONFIRM = "CONFIRM",
}

// --- Self-Service Loan ---
export interface SelfServiceLoan {
  token: string;                   // magic link token (48 hex chars)
  loan_amount_usd: number;
  btc_collateral: number;
  margin_call_ltv: number;         // e.g. 0.75
  liquidation_ltv: number;         // e.g. 0.90
  interest_rate: number | null;    // annual %, optional
  end_date: string | null;         // ISO date string, optional
  lender_name: string | null;      // optional
  chat_id: number;                 // Telegram chat ID
  created_at: number;
  updated_at: number;
}

// --- Computed Loan Snapshot ---
export interface LoanSnapshot {
  token: string;
  btc_price: number;
  collateral_usd: number;
  current_ltv: number;
  margin_call_price: number;
  liquidation_price: number;
  stress_test: StressTest;
  risk_tier: RiskTier;
  days_remaining: number | null;
}

export interface StressTest {
  "5pct_drop": { price: number; ltv: number; tier: RiskTier };
  "10pct_drop": { price: number; ltv: number; tier: RiskTier };
  "20pct_drop": { price: number; ltv: number; tier: RiskTier };
  "30pct_drop": { price: number; ltv: number; tier: RiskTier };
}

export type RiskTier = "GREEN" | "YELLOW" | "ORANGE" | "RED" | "LIQUIDATION";

// --- Price Oracle ---
export type PriceConfidence = "HIGH" | "MEDIUM" | "LOW";

export interface PriceUpdate {
  price: number;
  timestamp: number;
  sources: string[];
  twap_5m: number;
  confidence: PriceConfidence;
  circuit_breaker: boolean;
}

// --- Alerts ---
export interface PriceAlert {
  alert_id: string;
  token: string;                   // loan token
  threshold: number;               // BTC price
  direction: "ABOVE" | "BELOW";
  triggered: boolean;
  created_at: number;
  triggered_at: number | null;
}

export interface LtvAlert {
  alert_id: string;
  token: string;                   // loan token
  ltv_threshold: number;           // e.g. 0.80
  direction: "ABOVE" | "BELOW";
  triggered: boolean;
  created_at: number;
  triggered_at: number | null;
}

// --- Conversation Context ---
export interface ConversationContext {
  chat_id: number;
  step: ConversationStep;
  partial: Partial<SelfServiceLoan>;
  started_at: number;
  last_activity: number;
}

// --- Events ---
export interface SystemEvent {
  type: "PRICE_UPDATE" | "CIRCUIT_BREAKER" | "SOURCE_DEGRADED" | "ALERT_TRIGGERED";
  timestamp: number;
  data: any;
}

// --- Config ---
export interface PriceOracleConfig {
  twap_window_seconds: number;
  circuit_breaker_pct: number;
  min_sources: number;
  price_poll_interval_ms: number;
}
