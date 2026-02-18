// ============================================================
// Kraken WebSocket Price Source
// ============================================================

import WebSocket from "ws";
import { eventBus } from "../../events";

export class KrakenSource {
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private lastPrice: number = 0;
  private lastTimestamp: number = 0;
  readonly name = "kraken";

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
      this.ws = new WebSocket("wss://ws.kraken.com");

      this.ws.on("open", () => {
        eventBus.log("[Kraken] Connected");
        this.ws?.send(
          JSON.stringify({
            event: "subscribe",
            pair: ["XBT/USD"],
            subscription: { name: "ticker" },
          })
        );
      });

      this.ws.on("message", (data: WebSocket.Data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (Array.isArray(msg) && msg[2] === "ticker") {
            const ticker = msg[1];
            const price = parseFloat(ticker.c[0]);
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
        eventBus.log("[Kraken] Disconnected, reconnecting in 5s...");
        this.scheduleReconnect();
      });

      this.ws.on("error", (err) => {
        eventBus.log(`[Kraken] Error: ${err.message}`);
        this.ws?.close();
      });
    } catch (err: any) {
      eventBus.log(`[Kraken] Connection failed: ${err.message}`);
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
