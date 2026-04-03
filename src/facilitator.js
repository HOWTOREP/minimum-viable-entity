/**
 * x402 Facilitator - verifies and settles payments for the entity.
 * Runs as a separate service on FACILITATOR_PORT.
 */

import express from 'express';
import { createFacilitatorServer } from '@fastxyz/x402-facilitator';
import { config } from './config.js';

const app = express();
app.use(express.json());

// The facilitator verifies Fast payments and settles EVM payments.
// For Fast-only, no EVM key is needed (Fast settlement is on-chain).
const facilitatorConfig = {};

// Only add EVM key if present (for EVM settlement)
if (process.env.FACILITATOR_EVM_KEY) {
  facilitatorConfig.evmPrivateKey = process.env.FACILITATOR_EVM_KEY;
}

app.use(createFacilitatorServer(facilitatorConfig));

app.listen(config.facilitatorPort, () => {
  console.log(`\n  ┌────────────────────────────────────────────┐`);
  console.log(`  │         x402 FACILITATOR RUNNING            │`);
  console.log(`  │                                            │`);
  console.log(`  │  Port: ${config.facilitatorPort}                              │`);
  console.log(`  │  Networks: fast-mainnet, fast-testnet      │`);
  console.log(`  │  Role: verify & settle payments            │`);
  console.log(`  │                                            │`);
  console.log(`  │  GET  /supported  - list networks          │`);
  console.log(`  │  POST /verify     - verify payment         │`);
  console.log(`  │  POST /settle     - settle payment         │`);
  console.log(`  └────────────────────────────────────────────┘\n`);
});
