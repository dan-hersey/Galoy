// ============================================================
// HTTP Server + WebSocket — Dashboard serving + REST API
// ============================================================

import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import type { LoanStore } from "../store";
import { eventBus } from "../events";
import { DASHBOARD_HTML } from "../dashboard";
import type { PriceUpdate } from "../types";

export class DashboardServer {
  private server: http.Server;
  private wss: WebSocketServer;
  private store: LoanStore;
  private port: number;
  private wsClients: Set<WebSocket> = new Set();

  constructor(store: LoanStore, port = 3000) {
    this.store = store;
    this.port = port;

    this.server = http.createServer((req, res) => this.handleRequest(req, res));
    this.wss = new WebSocketServer({ server: this.server });

    this.wss.on("connection", (ws) => {
      this.wsClients.add(ws);
      ws.on("close", () => this.wsClients.delete(ws));
      ws.on("error", () => this.wsClients.delete(ws));

      // Send current price immediately
      const lastPrice = this.store.getLastPrice();
      if (lastPrice) {
        ws.send(JSON.stringify({ type: "price", data: lastPrice }));
      }
    });

    // Broadcast price updates to all connected dashboards
    eventBus.on("price:update", (update: PriceUpdate) => {
      const msg = JSON.stringify({ type: "price", data: update });
      for (const ws of this.wsClients) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(msg);
        }
      }
    });
  }

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(this.port, () => {
        console.log(`[Server] Listening on http://localhost:${this.port}`);
        resolve();
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      for (const ws of this.wsClients) {
        ws.close();
      }
      this.wss.close();
      this.server.close(() => resolve());
    });
  }

  getServer(): http.Server { return this.server; }

  // ── Request Router ───────────────────────────────────────

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    const url = new URL(req.url || "/", `http://localhost:${this.port}`);
    const path = url.pathname;
    const method = req.method?.toUpperCase() || "GET";

    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      // Dashboard page
      const dashMatch = path.match(/^\/dash\/([a-f0-9]{48})$/);
      if (dashMatch && method === "GET") {
        return this.serveDashboard(res, dashMatch[1]);
      }

      // API: Loan snapshot
      const loanMatch = path.match(/^\/api\/loan\/([a-f0-9]{48})$/);
      if (loanMatch && method === "GET") {
        return this.apiLoanSnapshot(res, loanMatch[1]);
      }

      // API: Simulate
      const simMatch = path.match(/^\/api\/loan\/([a-f0-9]{48})\/simulate$/);
      if (simMatch && method === "GET") {
        const priceParam = url.searchParams.get("price");
        return this.apiSimulate(res, simMatch[1], priceParam);
      }

      // API: Alerts
      const alertsMatch = path.match(/^\/api\/loan\/([a-f0-9]{48})\/alerts$/);
      if (alertsMatch) {
        if (method === "GET") return this.apiGetAlerts(res, alertsMatch[1]);
        if (method === "POST") return this.apiCreateAlert(req, res, alertsMatch[1]);
      }

      // API: Delete alert
      const deleteAlertMatch = path.match(/^\/api\/loan\/([a-f0-9]{48})\/alerts\/([a-f0-9]+)$/);
      if (deleteAlertMatch && method === "DELETE") {
        return this.apiDeleteAlert(res, deleteAlertMatch[1], deleteAlertMatch[2]);
      }

      // API: Price
      if (path === "/api/price" && method === "GET") {
        return this.apiPrice(res);
      }

      // Health check
      if (path === "/health" && method === "GET") {
        return this.json(res, 200, { status: "ok", timestamp: Date.now() });
      }

      // 404
      this.json(res, 404, { error: "Not found", path });
    } catch (err: any) {
      console.error(`[Server] Error: ${err.message}`);
      this.json(res, 500, { error: "Internal server error" });
    }
  }

  // ── Dashboard ────────────────────────────────────────────

  private serveDashboard(res: http.ServerResponse, token: string) {
    // Always serve the dashboard HTML — let the React app handle missing loans
    // with a proper error state rather than returning raw JSON 404
    const tokenScript = `<script>window.__TOKEN__ = "${token}";</script>`;
    const html = DASHBOARD_HTML.replace("</head>", `${tokenScript}\n</head>`);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  }

  // ── API Endpoints ────────────────────────────────────────

  private apiLoanSnapshot(res: http.ServerResponse, token: string) {
    const loan = this.store.getLoan(token);
    if (!loan) return this.json(res, 404, { error: "Loan not found" });

    const snapshot = this.store.computeSnapshot(token);
    if (!snapshot) return this.json(res, 503, { error: "Price feed unavailable" });

    this.json(res, 200, {
      ...snapshot,
      loan_amount_usd: loan.loan_amount_usd,
      btc_collateral: loan.btc_collateral,
      margin_call_ltv: loan.margin_call_ltv,
      liquidation_ltv: loan.liquidation_ltv,
      interest_rate: loan.interest_rate,
      end_date: loan.end_date,
      lender_name: loan.lender_name,
      created_at: loan.created_at,
    });
  }

  private apiSimulate(res: http.ServerResponse, token: string, priceParam: string | null) {
    const loan = this.store.getLoan(token);
    if (!loan) return this.json(res, 404, { error: "Loan not found" });

    const price = parseFloat(priceParam || "");
    if (isNaN(price) || price <= 0) {
      return this.json(res, 400, { error: "Invalid price parameter" });
    }

    const snapshot = this.store.computeSnapshot(token, price);
    if (!snapshot) return this.json(res, 503, { error: "Unable to compute" });

    this.json(res, 200, snapshot);
  }

  private apiGetAlerts(res: http.ServerResponse, token: string) {
    const loan = this.store.getLoan(token);
    if (!loan) return this.json(res, 404, { error: "Loan not found" });

    const priceAlerts = this.store.getPriceAlerts(token);
    const ltvAlerts = this.store.getLtvAlerts(token);

    this.json(res, 200, { price_alerts: priceAlerts, ltv_alerts: ltvAlerts });
  }

  private apiCreateAlert(req: http.IncomingMessage, res: http.ServerResponse, token: string) {
    const loan = this.store.getLoan(token);
    if (!loan) return this.json(res, 404, { error: "Loan not found" });

    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const data = JSON.parse(body);
        const { type, threshold, direction } = data;

        if (!threshold || !direction || (direction !== "ABOVE" && direction !== "BELOW")) {
          return this.json(res, 400, { error: "Invalid alert parameters" });
        }

        if (type === "price") {
          const alert = this.store.createPriceAlert(token, threshold, direction);
          return this.json(res, 201, alert);
        }

        if (type === "ltv") {
          const ltvVal = threshold > 1 ? threshold / 100 : threshold;
          const alert = this.store.createLtvAlert(token, ltvVal, direction);
          return this.json(res, 201, alert);
        }

        this.json(res, 400, { error: "Type must be 'price' or 'ltv'" });
      } catch {
        this.json(res, 400, { error: "Invalid JSON body" });
      }
    });
  }

  private apiDeleteAlert(res: http.ServerResponse, token: string, alertId: string) {
    const loan = this.store.getLoan(token);
    if (!loan) return this.json(res, 404, { error: "Loan not found" });

    const deletedPrice = this.store.deletePriceAlert(alertId);
    const deletedLtv = this.store.deleteLtvAlert(alertId);

    if (deletedPrice || deletedLtv) {
      this.json(res, 200, { deleted: true });
    } else {
      this.json(res, 404, { error: "Alert not found" });
    }
  }

  private apiPrice(res: http.ServerResponse) {
    const lastPrice = this.store.getLastPrice();
    if (!lastPrice) return this.json(res, 503, { error: "Price feed unavailable" });
    this.json(res, 200, lastPrice);
  }

  // ── Helpers ──────────────────────────────────────────────

  private json(res: http.ServerResponse, status: number, data: any) {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  }
}
