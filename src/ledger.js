import { writeFileSync, readFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

const DATA_DIR = resolve(process.cwd(), 'data');
const LEDGER_FILE = resolve(DATA_DIR, 'ledger.json');

// In-memory ledger with periodic persistence
class Ledger {
  constructor() {
    this.entries = [];
    this.totalRevenue = 0;
    this.totalCosts = 0;
    this.callCount = 0;
    this.startTime = Date.now();
    this._load();
  }

  _load() {
    try {
      const data = JSON.parse(readFileSync(LEDGER_FILE, 'utf-8'));
      this.entries = data.entries || [];
      this.totalRevenue = data.totalRevenue || 0;
      this.totalCosts = data.totalCosts || 0;
      this.callCount = data.callCount || 0;
      this.startTime = data.startTime || Date.now();
    } catch {
      // Fresh start
    }
  }

  _save() {
    try {
      mkdirSync(DATA_DIR, { recursive: true });
      writeFileSync(LEDGER_FILE, JSON.stringify({
        entries: this.entries.slice(-1000), // Keep last 1000 entries
        totalRevenue: this.totalRevenue,
        totalCosts: this.totalCosts,
        callCount: this.callCount,
        startTime: this.startTime,
      }, null, 2));
    } catch (err) {
      console.error('[Ledger] Save failed:', err.message);
    }
  }

  recordCall({ url, revenue, inferenceCost, summary }) {
    const entry = {
      timestamp: new Date().toISOString(),
      url,
      revenue,
      inferenceCost,
      profit: revenue - inferenceCost,
      summaryLength: summary?.length || 0,
    };

    this.entries.push(entry);
    this.totalRevenue += revenue;
    this.totalCosts += inferenceCost;
    this.callCount++;
    this._save();

    return entry;
  }

  getStats() {
    const uptimeMs = Date.now() - this.startTime;
    const hours = Math.floor(uptimeMs / 3600000);
    const minutes = Math.floor((uptimeMs % 3600000) / 60000);
    const profit = this.totalRevenue - this.totalCosts;
    const margin = this.totalRevenue > 0
      ? ((profit / this.totalRevenue) * 100).toFixed(1)
      : '0.0';

    return {
      entity: 'Minimum Viable Entity',
      uptime: `${hours}h ${minutes}m`,
      uptimeMs,
      calls: this.callCount,
      revenue: round(this.totalRevenue),
      costs: round(this.totalCosts),
      profit: round(profit),
      margin: `${margin}%`,
      avgRevenuePerCall: this.callCount > 0 ? round(this.totalRevenue / this.callCount) : 0,
      avgCostPerCall: this.callCount > 0 ? round(this.totalCosts / this.callCount) : 0,
      avgProfitPerCall: this.callCount > 0 ? round(profit / this.callCount) : 0,
      status: profit > 0 ? 'PROFITABLE' : profit === 0 ? 'BREAK-EVEN' : 'UNPROFITABLE',
      recentCalls: this.entries.slice(-20).reverse(),
    };
  }
}

function round(n) {
  return Math.round(n * 1000000) / 1000000;
}

export const ledger = new Ledger();
