// ============================================================
// Price Oracle Service — Orchestrates sources + aggregator
// ============================================================

import { KrakenSource } from "./sources/kraken";
import { CoinbaseSource } from "./sources/coinbase";
import { BitstampSource } from "./sources/bitstamp";
import { PriceAggregator } from "./aggregator";
import { eventBus } from "../events";
import type { PriceUpdate, PriceOracleConfig } from "../types";

export class PriceOracleService {
  private sources: { name: string; instance: KrakenSource | CoinbaseSource | BitstampSource }[];
  private aggregator: PriceAggregator;
  private pollTimer: NodeJS.Timeout | null = null;
  private config: PriceOracleConfig;
  private lastUpdate: PriceUpdate | null = null;
  private running = false;

  constructor(config: PriceOracleConfig) {
    this.config = config;
    this.aggregator = new PriceAggregator(config);

    this.sources = [
      { name: "kraken", instance: new KrakenSource() },
      { name: "coinbase", instance: new CoinbaseSource() },
      { name: "bitstamp", instance: new BitstampSource() },
    ];

    eventBus.on("price:source_tick", (tick) => {
      this.aggregator.ingestTick(tick.source, tick.price, tick.timestamp);
    });
  }

  start() {
    if (this.running) return;
    this.running = true;
    eventBus.log("Price Oracle starting...");

    for (const source of this.sources) {
      source.instance.start();
    }

    this.pollTimer = setInterval(() => {
      this.tick();
    }, this.config.price_poll_interval_ms);

    eventBus.log(`Price Oracle running — polling every ${this.config.price_poll_interval_ms}ms`);
  }

  stop() {
    this.running = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    for (const source of this.sources) {
      source.instance.stop();
    }
    eventBus.log("Price Oracle stopped");
  }

  private tick() {
    const update = this.aggregator.computeUpdate();
    if (!update) return;

    this.lastUpdate = update;
    eventBus.emit("price:update", update);

    eventBus.emitSystemEvent({
      type: "PRICE_UPDATE",
      timestamp: update.timestamp,
      data: update,
    });

    if (update.circuit_breaker) {
      eventBus.emitSystemEvent({
        type: "CIRCUIT_BREAKER",
        timestamp: update.timestamp,
        data: { price: update.price, confidence: update.confidence, sources: update.sources },
      });
    }

    if (update.sources.length < this.config.min_sources) {
      eventBus.emitSystemEvent({
        type: "SOURCE_DEGRADED",
        timestamp: update.timestamp,
        data: { active_sources: update.sources.length, min_required: this.config.min_sources },
      });
    }
  }

  getLastUpdate(): PriceUpdate | null { return this.lastUpdate; }
  getSourceStatus() { return this.aggregator.getSourceStatus(); }
  isHealthy(): boolean { return this.aggregator.getSourceCount() >= this.config.min_sources; }
}
