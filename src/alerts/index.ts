// ============================================================
// Alert Engine — Price + LTV crossing detection
// ============================================================

import { eventBus } from "../events";
import type { LoanStore } from "../store";
import type { PriceUpdate } from "../types";

export class AlertEngine {
  private store: LoanStore;
  private sendNotification: (chatId: number, text: string) => Promise<void>;
  private previousPrice: number = 0;
  private previousLtvs: Map<string, number> = new Map(); // token → previous LTV

  constructor(
    store: LoanStore,
    sendNotification: (chatId: number, text: string) => Promise<void>,
  ) {
    this.store = store;
    this.sendNotification = sendNotification;
  }

  start() {
    eventBus.on("price:update", (update) => this.onPriceUpdate(update));
    console.log("[AlertEngine] Listening for price updates");
  }

  private async onPriceUpdate(update: PriceUpdate): Promise<void> {
    const currentPrice = update.price;
    this.store.setLastPrice(update);

    // Check all price alerts
    await this.checkPriceAlerts(currentPrice);

    // Check all LTV alerts
    await this.checkLtvAlerts(currentPrice);

    this.previousPrice = currentPrice;
  }

  private async checkPriceAlerts(currentPrice: number): Promise<void> {
    const alerts = this.store.getAllPriceAlerts();

    for (const alert of alerts) {
      if (alert.triggered) continue;

      const loan = this.store.getLoan(alert.token);
      if (!loan) continue;

      let crossed = false;

      if (alert.direction === "BELOW") {
        // Trigger when price crosses below threshold
        if (this.previousPrice > 0 && this.previousPrice >= alert.threshold && currentPrice < alert.threshold) {
          crossed = true;
        }
        // Also trigger if this is first check and already below
        if (this.previousPrice === 0 && currentPrice < alert.threshold) {
          crossed = true;
        }
      } else {
        // ABOVE
        if (this.previousPrice > 0 && this.previousPrice <= alert.threshold && currentPrice > alert.threshold) {
          crossed = true;
        }
        if (this.previousPrice === 0 && currentPrice > alert.threshold) {
          crossed = true;
        }
      }

      if (crossed) {
        alert.triggered = true;
        alert.triggered_at = Date.now();

        await this.sendNotification(loan.chat_id, [
          `\u{1F514} *Price Alert Triggered!*`,
          "",
          `BTC is now *${alert.direction === "BELOW" ? "below" : "above"}* $${alert.threshold.toLocaleString()}`,
          `Current price: *$${currentPrice.toLocaleString()}*`,
          "",
          "Use /status to check your loan.",
        ].join("\n"));

        eventBus.emitSystemEvent({
          type: "ALERT_TRIGGERED",
          timestamp: Date.now(),
          data: { type: "price", alert_id: alert.alert_id, price: currentPrice, threshold: alert.threshold },
        });
      }
    }
  }

  private async checkLtvAlerts(currentPrice: number): Promise<void> {
    const alerts = this.store.getAllLtvAlerts();

    for (const alert of alerts) {
      if (alert.triggered) continue;

      const loan = this.store.getLoan(alert.token);
      if (!loan) continue;

      const collateralUsd = loan.btc_collateral * currentPrice;
      if (collateralUsd <= 0) continue;

      const currentLtv = loan.loan_amount_usd / collateralUsd;
      const previousLtv = this.previousLtvs.get(alert.token) ?? 0;

      let crossed = false;

      if (alert.direction === "ABOVE") {
        if (previousLtv > 0 && previousLtv <= alert.ltv_threshold && currentLtv > alert.ltv_threshold) {
          crossed = true;
        }
        if (previousLtv === 0 && currentLtv > alert.ltv_threshold) {
          crossed = true;
        }
      } else {
        // BELOW
        if (previousLtv > 0 && previousLtv >= alert.ltv_threshold && currentLtv < alert.ltv_threshold) {
          crossed = true;
        }
        if (previousLtv === 0 && currentLtv < alert.ltv_threshold) {
          crossed = true;
        }
      }

      if (crossed) {
        alert.triggered = true;
        alert.triggered_at = Date.now();

        await this.sendNotification(loan.chat_id, [
          `\u{1F514} *LTV Alert Triggered!*`,
          "",
          `Your LTV is now *${alert.direction === "ABOVE" ? "above" : "below"}* ${(alert.ltv_threshold * 100).toFixed(1)}%`,
          `Current LTV: *${(currentLtv * 100).toFixed(1)}%*`,
          `BTC Price: *$${currentPrice.toLocaleString()}*`,
          "",
          "Use /status to check your loan.",
        ].join("\n"));

        eventBus.emitSystemEvent({
          type: "ALERT_TRIGGERED",
          timestamp: Date.now(),
          data: { type: "ltv", alert_id: alert.alert_id, ltv: currentLtv, threshold: alert.ltv_threshold },
        });
      }
    }

    // Update previous LTVs for all loans
    for (const loan of this.store.getAllLoans()) {
      const collateralUsd = loan.btc_collateral * currentPrice;
      if (collateralUsd > 0) {
        this.previousLtvs.set(loan.token, loan.loan_amount_usd / collateralUsd);
      }
    }
  }

  // For testing — manually trigger a price check
  async processPrice(price: number): Promise<void> {
    await this.onPriceUpdate({
      price,
      timestamp: Date.now(),
      sources: ["test"],
      twap_5m: price,
      confidence: "HIGH",
      circuit_breaker: false,
    });
  }
}
