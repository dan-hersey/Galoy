// ============================================================
// Event Bus — Central pub/sub for inter-service communication
// ============================================================

import EventEmitter from "eventemitter3";
import type { PriceUpdate, SystemEvent } from "./types";

interface EventMap {
  "price:update": (update: PriceUpdate) => void;
  "price:source_tick": (tick: { source: string; price: number; timestamp: number }) => void;
  "system:event": (event: SystemEvent) => void;
  "system:log": (msg: string) => void;
}

class EventBus extends EventEmitter<EventMap> {
  private history: SystemEvent[] = [];
  private maxHistory = 1000;

  emitSystemEvent(event: SystemEvent) {
    this.history.push(event);
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(-this.maxHistory);
    }
    this.emit("system:event", event);
  }

  log(msg: string) {
    this.emit("system:log", msg);
  }

  getHistory(type?: SystemEvent["type"], limit = 50): SystemEvent[] {
    const filtered = type ? this.history.filter((e) => e.type === type) : this.history;
    return filtered.slice(-limit);
  }
}

// Singleton
export const eventBus = new EventBus();
