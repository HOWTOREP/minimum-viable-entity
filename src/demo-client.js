/**
 * Demo client - pays the entity to summarize a URL.
 * 
 * Uses the x402 client to automatically handle the 402 payment flow.
 * Demonstrates the full cycle: request -> pay -> get summary.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { x402Pay } from '@fastxyz/x402-client';
import { config } from './config.js';

// Load wallet from keyfile
const keyfilePath = resolve(process.env.HOME || '~', '.fast', 'keys', `${config.fastKeyfile}.json`);
let wallet;

try {
  const keyData = JSON.parse(readFileSync(keyfilePath, 'utf-8'));
  wallet = {
    type: 'fast',
    privateKey: keyData.privateKey,
    publicKey: keyData.publicKey,
    address: keyData.address,
  };
} catch (err) {
  console.error(`Failed to load wallet from ${keyfilePath}:`, err.message);
  process.exit(1);
}

const ENTITY_URL = `http://localhost:${config.port}`;
const TEST_URLS = [
  'https://en.wikipedia.org/wiki/Autonomous_agent',
  'https://en.wikipedia.org/wiki/Micropayment',
  'https://en.wikipedia.org/wiki/HTTP_402',
];

async function summarizeUrl(url) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Requesting summary of: ${url}`);
  console.log(`Paying ${config.pricePerCall} USDC via x402...`);
  console.log('='.repeat(60));

  try {
    const result = await x402Pay({
      url: `${ENTITY_URL}/summarize`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
      wallet,
      verbose: true,
    });

    if (result.success) {
      const data = typeof result.body === 'string' ? JSON.parse(result.body) : result.body;
      console.log(`\nSummary (${data.wordCount} words, ${data.processingTimeMs}ms):`);
      console.log('-'.repeat(40));
      console.log(data.summary);
      console.log('-'.repeat(40));
      console.log(`Method: ${data.method}`);
      console.log(`Inference cost: $${data.cost?.inference || 0}`);
      console.log(`Entity status: ${data.entity?.status} (call #${data.entity?.callNumber})`);
      console.log(`Entity total profit: $${data.entity?.totalProfit}`);
    } else {
      console.error(`Request failed with status ${result.statusCode}`);
      console.error('Body:', result.body);
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║     MINIMUM VIABLE ENTITY - DEMO CLIENT             ║');
  console.log('║     Paying for AI summaries with micropayments      ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log(`║  Entity:  ${ENTITY_URL.padEnd(42)}║`);
  console.log(`║  Wallet:  ${wallet.address.slice(0, 42)}║`);
  console.log(`║  Price:   ${config.pricePerCall} per summary                         ║`);
  console.log('╚══════════════════════════════════════════════════════╝');

  // Use CLI arg or default test URLs
  const urls = process.argv.slice(2);
  if (urls.length > 0) {
    for (const url of urls) {
      await summarizeUrl(url);
    }
  } else {
    console.log('\nNo URL provided, using test URLs...');
    const url = TEST_URLS[Math.floor(Math.random() * TEST_URLS.length)];
    await summarizeUrl(url);
  }

  // Show entity stats after
  console.log('\n\nEntity P&L after our call:');
  try {
    const statsRes = await fetch(`${ENTITY_URL}/stats`);
    const stats = await statsRes.json();
    console.log(`  Calls:    ${stats.calls}`);
    console.log(`  Revenue:  $${stats.revenue}`);
    console.log(`  Costs:    $${stats.costs}`);
    console.log(`  Profit:   $${stats.profit}`);
    console.log(`  Margin:   ${stats.margin}`);
    console.log(`  Status:   ${stats.status}`);
  } catch {
    console.log('  (Could not fetch stats)');
  }
}

main().catch(console.error);
