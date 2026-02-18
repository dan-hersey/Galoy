// ============================================================
// Conversation Manager — State machine for /newloan flow
// ============================================================

import { ConversationStep } from "../types";
import type { LoanStore } from "../store";

interface StepConfig {
  prompt: string;
  validate: (input: string) => string | null;  // returns error message or null
  extract: (input: string) => any;
  nextStep: ConversationStep;
  field: string;
  optional?: boolean;
  skipPrompt?: string;
}

const STEP_CONFIG: Record<string, StepConfig> = {
  [ConversationStep.AWAITING_AMOUNT]: {
    prompt: "What is your *loan amount* in USD?\n\nExample: `50000`",
    validate: (input) => {
      const n = parseFloat(input.replace(/[,$]/g, ""));
      if (isNaN(n) || n <= 0) return "Please enter a valid positive number for the loan amount.";
      if (n > 100_000_000) return "Loan amount seems too high. Please enter a realistic amount.";
      return null;
    },
    extract: (input) => parseFloat(input.replace(/[,$]/g, "")),
    nextStep: ConversationStep.AWAITING_COLLATERAL,
    field: "loan_amount_usd",
  },
  [ConversationStep.AWAITING_COLLATERAL]: {
    prompt: "How much *BTC collateral* backs this loan?\n\nExample: `1.5`",
    validate: (input) => {
      const n = parseFloat(input);
      if (isNaN(n) || n <= 0) return "Please enter a valid positive number for BTC collateral.";
      if (n > 100_000) return "Collateral amount seems too high. Please enter a realistic amount.";
      return null;
    },
    extract: (input) => parseFloat(input),
    nextStep: ConversationStep.AWAITING_MARGIN_CALL,
    field: "btc_collateral",
  },
  [ConversationStep.AWAITING_MARGIN_CALL]: {
    prompt: "At what *LTV %* does a margin call happen?\n\nExample: `75` for 75%",
    validate: (input) => {
      const n = parseFloat(input.replace(/%/g, ""));
      if (isNaN(n) || n <= 0 || n > 100) return "Please enter a percentage between 1 and 100.";
      return null;
    },
    extract: (input) => parseFloat(input.replace(/%/g, "")) / 100,
    nextStep: ConversationStep.AWAITING_LIQUIDATION,
    field: "margin_call_ltv",
  },
  [ConversationStep.AWAITING_LIQUIDATION]: {
    prompt: "At what *LTV %* does liquidation happen?\n\nExample: `90` for 90%",
    validate: (input) => {
      const n = parseFloat(input.replace(/%/g, ""));
      if (isNaN(n) || n <= 0 || n > 100) return "Please enter a percentage between 1 and 100.";
      return null;
    },
    extract: (input) => parseFloat(input.replace(/%/g, "")) / 100,
    nextStep: ConversationStep.AWAITING_INTEREST,
    field: "liquidation_ltv",
  },
  [ConversationStep.AWAITING_INTEREST]: {
    prompt: "What's the *annual interest rate %*? (optional)\n\nExample: `12.5` for 12.5%\nType `skip` to skip.",
    validate: (input) => {
      if (input.toLowerCase() === "skip") return null;
      const n = parseFloat(input.replace(/%/g, ""));
      if (isNaN(n) || n < 0 || n > 200) return "Please enter a percentage between 0 and 200, or type `skip`.";
      return null;
    },
    extract: (input) => input.toLowerCase() === "skip" ? null : parseFloat(input.replace(/%/g, "")),
    nextStep: ConversationStep.AWAITING_END_DATE,
    field: "interest_rate",
    optional: true,
    skipPrompt: "skip",
  },
  [ConversationStep.AWAITING_END_DATE]: {
    prompt: "When does the loan *end*? (optional)\n\nFormat: `YYYY-MM-DD`\nExample: `2025-12-31`\nType `skip` to skip.",
    validate: (input) => {
      if (input.toLowerCase() === "skip") return null;
      const match = input.match(/^\d{4}-\d{2}-\d{2}$/);
      if (!match) return "Please use YYYY-MM-DD format, or type `skip`.";
      const d = new Date(input);
      if (isNaN(d.getTime())) return "Invalid date. Please use YYYY-MM-DD format.";
      return null;
    },
    extract: (input) => input.toLowerCase() === "skip" ? null : input.trim(),
    nextStep: ConversationStep.AWAITING_LENDER,
    field: "end_date",
    optional: true,
    skipPrompt: "skip",
  },
  [ConversationStep.AWAITING_LENDER]: {
    prompt: "Who is the *lender*? (optional)\n\nExample: `BlockFi`, `Nexo`, `Ledn`\nType `skip` to skip.",
    validate: () => null,
    extract: (input) => input.toLowerCase() === "skip" ? null : input.trim(),
    nextStep: ConversationStep.CONFIRM,
    field: "lender_name",
    optional: true,
    skipPrompt: "skip",
  },
};

export class ConversationManager {
  private store: LoanStore;

  constructor(store: LoanStore) {
    this.store = store;
  }

  getStepConfig(step: ConversationStep): StepConfig | null {
    return STEP_CONFIG[step] || null;
  }

  getPromptForStep(step: ConversationStep): string | null {
    const config = STEP_CONFIG[step];
    return config ? config.prompt : null;
  }

  processInput(chatId: number, input: string): { nextStep: ConversationStep; error?: string; field?: string; value?: any } {
    const ctx = this.store.getConversation(chatId);
    if (!ctx) return { nextStep: ConversationStep.IDLE, error: "No active conversation." };

    const stepConfig = STEP_CONFIG[ctx.step];
    if (!stepConfig) return { nextStep: ConversationStep.IDLE, error: "Invalid conversation state." };

    // Validate
    const validationError = stepConfig.validate(input);
    if (validationError) {
      return { nextStep: ctx.step, error: validationError };
    }

    // Extract value
    const value = stepConfig.extract(input);

    // Update conversation
    const partialUpdate: any = { [stepConfig.field]: value };
    this.store.updateConversation(chatId, stepConfig.nextStep, partialUpdate);

    return {
      nextStep: stepConfig.nextStep,
      field: stepConfig.field,
      value,
    };
  }

  buildConfirmationMessage(chatId: number): string | null {
    const ctx = this.store.getConversation(chatId);
    if (!ctx) return null;

    const p = ctx.partial;
    const lines: string[] = [
      "Please confirm your loan details:\n",
      `*Loan Amount:* $${(p.loan_amount_usd || 0).toLocaleString()}`,
      `*BTC Collateral:* ${p.btc_collateral || 0} BTC`,
      `*Margin Call LTV:* ${((p.margin_call_ltv || 0) * 100).toFixed(1)}%`,
      `*Liquidation LTV:* ${((p.liquidation_ltv || 0) * 100).toFixed(1)}%`,
    ];

    if (p.interest_rate != null) {
      lines.push(`*Interest Rate:* ${p.interest_rate}%`);
    }
    if (p.end_date) {
      lines.push(`*End Date:* ${p.end_date}`);
    }
    if (p.lender_name) {
      lines.push(`*Lender:* ${p.lender_name}`);
    }

    lines.push("", "Type `yes` to confirm, or `cancel` to start over.");
    return lines.join("\n");
  }

  confirmAndCreateLoan(chatId: number, host: string): { token: string; dashboardUrl: string } | null {
    const ctx = this.store.getConversation(chatId);
    if (!ctx) return null;

    const loan = this.store.createLoan(chatId, ctx.partial);
    this.store.clearConversation(chatId);

    return {
      token: loan.token,
      dashboardUrl: `${host}/dash/${loan.token}`,
    };
  }
}
