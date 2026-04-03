import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env manually (no dotenv dependency)
function loadEnv() {
  try {
    const envPath = resolve(process.cwd(), '.env');
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // No .env file, that's fine
  }
}

loadEnv();

export const config = {
  port: parseInt(process.env.PORT || '3402', 10),
  facilitatorPort: parseInt(process.env.FACILITATOR_PORT || '4020', 10),
  facilitatorUrl: process.env.FACILITATOR_URL || 'http://localhost:4020',
  fastKeyfile: process.env.FAST_KEYFILE || 'default',
  fastNetwork: process.env.FAST_NETWORK || 'mainnet',
  pricePerCall: process.env.PRICE_PER_CALL || '$0.01',
  openaiKey: process.env.OPENAI_API_KEY || null,
  anthropicKey: process.env.ANTHROPIC_API_KEY || null,
};
