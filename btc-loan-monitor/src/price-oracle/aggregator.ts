// ============================================================
// Price Aggregator — Median, TWAP, circuit breaker logic
// ============================================================

import type { PriceConfidence, PriceUpdate, PriceOracleConfig } from "../types";

interface PriceSample {
  price: number;
  timestamp: number;
  sources: string[];
}

export class PriceAggregator {
  private samples: PriceSample[] = [];
  private maxSamples = 2000;
  private sourcePrices: Map<string, { price: number; timestamp: number }> = new Map();
  private circuitBreakerActive = false;
  private lastKnownGoodPrice: number = 0;
  private circuitBreakerTriggeredAt: number = 0;
  private config: PriceOracleConfig;

  constructor(config: PriceOracleConfig) {
    this.config = config;
  }

  updateConfig(config: PriceOracleConfig) {
    this.config = config;
  }

  ingestTick(source: string, price: number, timestamp: number) {
    this.sourcePrices.set(source, { price, timestamp });
  }

  computeUpdate(): PriceUpdate | null {
    const now = Date.now();
    const staleThreshold = 30_000;

    const activeSources: { source: string; price: number }[] = [];
    for (const [source, data] of this.sourcePrices) {
      if (now - data.timestamp < staleThreshold) {
        activeSources.push({ source, price: data.price });
      }
    }

    if (activeSources.length === 0) return null;

    // Median price
    const prices = activeSources.map((s) => s.price).sort((a, b) => a - b);
    const medianPrice =
      prices.length % 2 === 1
        ? prices[Math.floor(prices.length / 2)]
        : (prices[Math.floor(prices.length / 2) - 1] + prices[Math.floor(prices.length / 2)]) / 2;

    // Circuit breaker check
    if (this.lastKnownGoodPrice > 0) {
      const pctChange = Math.abs(medianPrice - this.lastKnownGoodPrice) / this.lastKnownGoodPrice;
      if (pctChange > this.config.circuit_breaker_pct / 100) {
        if (!this.circuitBreakerActive) {
          this.circuitBreakerActive = true;
          this.circuitBreakerTriggeredAt = now;
        }
        if (now - this.circuitBreakerTriggeredAt < 60_000) {
          const sample: PriceSample = {
            price: this.lastKnownGoodPrice,
            timestamp: now,
            sources: activeSources.map((s) => s.source),
          };
          this.addSample(sample);
          return {
            price: medianPrice,
            timestamp: now,
            sources: activeSources.map((s) => s.source),
            twap_5m: this.computeTwap(5 * 60 * 1000),
            confidence: this.computeConfidence(activeSources),
            circuit_breaker: true,
          };
        } else {
          this.circuitBreakerActive = false;
        }
      } else {
        this.circuitBreakerActive = false;
      }
    }

    this.lastKnownGoodPrice = medianPrice;
    const sample: PriceSample = {
      price: medianPrice,
      timestamp: now,
      sources: activeSources.map((s) => s.source),
    };
    this.addSample(sample);

    return {
      price: medianPrice,
      timestamp: now,
      sources: activeSources.map((s) => s.source),
      twap_5m: this.computeTwap(5 * 60 * 1000),
      confidence: this.computeConfidence(activeSources),
      circuit_breaker: false,
    };
  }

  private addSample(sample: PriceSample) {
    this.samples.push(sample);
    if (this.samples.length > this.maxSamples) {
      this.samples = this.samples.slice(-this.maxSamples);
    }
  }

  private computeTwap(windowMs: number): number {
    const now = Date.now();
    const cutoff = now - windowMs;
    const windowSamples = this.samples.filter((s) => s.timestamp >= cutoff);

    if (windowSamples.length === 0) return this.lastKnownGoodPrice || 0;
    if (windowSamples.length === 1) return windowSamples[0].price;

    let weightedSum = 0;
    let totalWeight = 0;
    for (let i = 0; i < windowSamples.length; i++) {
      const start = windowSamples[i].timestamp;
      const end = i < windowSamples.length - 1 ? windowSamples[i + 1].timestamp : now;
      const weight = end - start;
      weightedSum += windowSamples[i].price * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : windowSamples[windowSamples.length - 1].price;
  }

  private computeConfidence(sources: { source: string; price: number }[]): PriceConfidence {
    if (sources.length >= 3) {
      const min = Math.min(...sources.map((s) => s.price));
      const max = Math.max(...sources.map((s) => s.price));
      const spread = (max - min) / min;
      if (spread < 0.005) return "HIGH";
      if (spread < 0.01) return "MEDIUM";
      return "LOW";
    }
    if (sources.length === 2) return "MEDIUM";
    return "LOW";
  }

  isCircuitBreakerActive(): boolean { return this.circuitBreakerActive; }

  getSourceCount(): number {
    const now = Date.now();
    let count = 0;
    for (const [, data] of this.sourcePrices) {
      if (now - data.timestamp < 30_000) count++;
    }
    return count;
  }

  getSourceStatus(): { source: string; price: number; stale: boolean; ageMs: number }[] {
    const now = Date.now();
    const result: { source: string; price: number; stale: boolean; ageMs: number }[] = [];
    for (const [source, data] of this.sourcePrices) {
      result.push({
        source,
        price: data.price,
        stale: now - data.timestamp > 30_000,
        ageMs: now - data.timestamp,
      });
    }
    return result;
  }
}
