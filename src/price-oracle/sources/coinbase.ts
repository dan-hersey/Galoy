// ============================================================
// Coinbase WebSocket Price Source
// ============================================================

import WebSocket from "ws";
import { eventBus } from "../../events";

export class CoinbaseSource {
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private lastPrice: number = 0;
  private lastTimestamp: number = 0;
  readonly name = "coinbase";

  start() {
    this.connect();
  }

  stop() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }
  }

  private connect() {
    try {
      this.ws = new WebSocket("wss://ws-feed.exchange.coinbase.com");

      this.ws.on("open", () => {
        eventBus.log("[Coinbase] Connected");
        this.ws?.send(
          JSON.stringify({
            type: "subscribe",
            product_ids: ["BTC-USD"],
            channels: ["ticker"],
          })
        );
      });

      this.ws.on("message", (data: WebSocket.Data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === "ticker" && msg.product_id === "BTC-USD") {
            const price = parseFloat(msg.price);
            if (price > 0) {
              this.lastPrice = price;
              this.lastTimestamp = Date.now();
              eventBus.emit("price:source_tick", {
                source: this.name,
                price,
                timestamp: this.lastTimestamp,
              });
            }
          }
        } catch {
          // skip
        }
      });

      this.ws.on("close", () => {
        eventBus.log("[Coinbase] Disconnected, reconnecting in 5s...");
        this.scheduleReconnect();
      });

      this.ws.on("error", (err) => {
        eventBus.log(`[Coinbase] Error: ${err.message}`);
        this.ws?.close();
      });
    } catch (err: any) {
      eventBus.log(`[Coinbase] Connection failed: ${err.message}`);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => this.connect(), 5000);
  }

  getLastPrice(): number { return this.lastPrice; }
  getLastTimestamp(): number { return this.lastTimestamp; }
  isStale(maxAgeMs = 30000): boolean { return Date.now() - this.lastTimestamp > maxAgeMs; }
}
