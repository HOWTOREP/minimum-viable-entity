/**
 * The Minimum Viable Autonomous Entity
 * 
 * An AI agent that sustains itself economically.
 * One function (summarize URLs), one wallet, one price ($0.01).
 * 
 * Can it break even?
 */

import express from 'express';
import cors from 'cors';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { FastProvider, FastWallet } from '@fastxyz/sdk';
import { paymentMiddleware } from '@fastxyz/x402-server';
import { config } from './config.js';
import { ledger } from './ledger.js';
import { summarize } from './summarizer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  // Initialize Fast wallet
  console.log('[MVE] Initializing Fast wallet...');
  const provider = new FastProvider({ network: config.fastNetwork });
  const wallet = await FastWallet.fromKeyfile({ key: config.fastKeyfile }, provider);
  const walletAddress = wallet.address;

  // Check initial balance
  let initialBalance;
  try {
    const bal = await wallet.balance('USDC');
    initialBalance = bal.amount;
    console.log(`[MVE] Wallet: ${walletAddress}`);
    console.log(`[MVE] Initial USDC balance: ${initialBalance}`);
  } catch (err) {
    console.log(`[MVE] Wallet: ${walletAddress}`);
    console.log(`[MVE] Could not fetch balance: ${err.message}`);
    initialBalance = 'unknown';
  }

  const app = express();
  app.use(cors());
  app.use(express.json());

  // --- x402 Payment Middleware ---
  // Protects /summarize with $0.01 micropayment
  app.use(paymentMiddleware(
    {
      fast: walletAddress,
    },
    {
      'POST /summarize': {
        price: config.pricePerCall,
        network: config.fastNetwork === 'mainnet' ? 'fast-mainnet' : 'fast-testnet',
        description: 'Summarize a URL - AI-powered text extraction and summarization',
      },
    },
    { url: config.facilitatorUrl },
  ));

  // --- Core Endpoint: Summarize ---
  app.post('/summarize', async (req, res) => {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'Missing "url" field in request body' });
    }

    try {
      console.log(`[MVE] Summarizing: ${url}`);
      const result = await summarize(url);

      // Record in P&L ledger
      const revenue = 0.01; // $0.01 per call
      const entry = ledger.recordCall({
        url,
        revenue,
        inferenceCost: result.cost.inference,
        summary: result.summary,
      });

      console.log(`[MVE] Call #${ledger.callCount} | Revenue: +$${revenue} | Cost: -$${result.cost.inference} | Profit: $${entry.profit.toFixed(6)}`);

      res.json({
        summary: result.summary,
        url: result.url,
        wordCount: result.wordCount,
        processingTimeMs: result.processingTimeMs,
        method: result.method,
        cost: result.cost,
        entity: {
          callNumber: ledger.callCount,
          totalProfit: ledger.getStats().profit,
          status: ledger.getStats().status,
        },
      });
    } catch (err) {
      console.error(`[MVE] Error summarizing ${url}:`, err.message);
      res.status(500).json({ error: 'Failed to summarize URL', details: err.message });
    }
  });

  // --- Stats Endpoint (free) ---
  app.get('/stats', async (req, res) => {
    const stats = ledger.getStats();

    // Fetch current wallet balance
    try {
      const bal = await wallet.balance('USDC');
      stats.wallet = walletAddress;
      stats.walletBalance = bal.amount;
    } catch {
      stats.wallet = walletAddress;
      stats.walletBalance = 'unavailable';
    }

    stats.initialBalance = initialBalance;
    res.json(stats);
  });

  // --- Dashboard (free) ---
  app.get('/dashboard', (req, res) => {
    try {
      const html = readFileSync(resolve(__dirname, '..', 'public', 'dashboard.html'), 'utf-8');
      res.type('html').send(html);
    } catch {
      res.type('html').send('<html><body><h1>Dashboard not found</h1><p>Check /stats for JSON data.</p></body></html>');
    }
  });

  // --- Health check ---
  app.get('/health', (req, res) => {
    res.json({ status: 'alive', entity: 'Minimum Viable Entity', wallet: walletAddress });
  });

  // --- Root ---
  app.get('/', (req, res) => {
    res.json({
      name: 'Minimum Viable Autonomous Entity',
      description: 'An AI agent that sustains itself economically via x402 micropayments',
      endpoints: {
        'POST /summarize': 'Summarize a URL ($0.01 via x402)',
        'GET /stats': 'P&L and performance stats (free)',
        'GET /dashboard': 'Real-time dashboard (free)',
        'GET /health': 'Health check (free)',
      },
      wallet: walletAddress,
      price: config.pricePerCall,
      source: 'https://github.com/Pi-Squared-Inc/minimum-viable-entity',
    });
  });

  app.listen(config.port, () => {
    console.log('');
    console.log('  ┌──────────────────────────────────────────────────┐');
    console.log('  │     MINIMUM VIABLE AUTONOMOUS ENTITY             │');
    console.log('  │     "Can an AI agent sustain itself?"            │');
    console.log('  │                                                  │');
    console.log(`  │  Server:     http://localhost:${config.port}               │`);
    console.log(`  │  Dashboard:  http://localhost:${config.port}/dashboard      │`);
    console.log(`  │  Wallet:     ${walletAddress.slice(0, 20)}...  │`);
    console.log(`  │  Price:      ${config.pricePerCall} per summary                │`);
    console.log(`  │  Network:    ${config.fastNetwork.padEnd(8)}                          │`);
    console.log('  │                                                  │');
    console.log('  │  Endpoints:                                      │');
    console.log('  │  POST /summarize  - summarize a URL (paid)       │');
    console.log('  │  GET  /stats      - P&L stats (free)             │');
    console.log('  │  GET  /dashboard  - live dashboard (free)        │');
    console.log('  └──────────────────────────────────────────────────┘');
    console.log('');
  });
}

main().catch(err => {
  console.error('[MVE] Fatal error:', err);
  process.exit(1);
});
