# The Minimum Viable Autonomous Entity

> Can an AI agent sustain itself economically?

A single-function AI agent that earns money by summarizing URLs. It charges $0.01 per request via [x402 micropayments](https://skill.fast.xyz/) on the [Fast network](https://fast.xyz), pays for its own LLM inference costs, and tracks its P&L in real-time.

**The question:** What's the simplest agent that can break even?

## Architecture

```
                    ┌─────────────────────────────────────────┐
                    │       Minimum Viable Entity (MVE)       │
                    │                                         │
  Customer ──x402──►│  POST /summarize   ──►  LLM API Call   │
  pays $0.01/call   │       │                    │            │
                    │       ▼                    ▼            │
                    │  Revenue: +$0.01    Cost: ~$0.002       │
                    │       │                    │            │
                    │       └────────┬───────────┘            │
                    │                ▼                         │
                    │          P&L Tracker                    │
                    │     (balance, margin, #calls)           │
                    │                │                         │
                    │                ▼                         │
                    │       GET /dashboard                    │
                    │    (real-time financials)               │
                    └─────────────────────────────────────────┘
                              │
                    ┌─────────┴──────────┐
                    │    Facilitator      │
                    │  (verify + settle)  │
                    └────────────────────┘
```

## The Economics

| Item | Amount |
|------|--------|
| Revenue per call | $0.01 (USDC via x402) |
| LLM inference cost | ~$0.001-0.005 per summary |
| **Gross margin** | **~50-90% per call** |

The entity needs ~100 calls to earn $1. With a 70% margin, it nets ~$0.70 per 100 calls. The question isn't *if* it can break even - it's how fast.

## Quick Start

### Prerequisites

- Node.js 18+
- A Fast wallet with some USDC (`~/.fast/keys/default.json`)
- An LLM API key (OpenAI, Anthropic, etc.) or the built-in free summarizer

### 1. Install

```bash
npm install
```

### 2. Configure

```bash
cp .env.example .env
# Edit .env with your wallet and API details
```

### 3. Run

```bash
# Terminal 1: Start the facilitator (payment verification)
npm run facilitator

# Terminal 2: Start the entity
npm start
```

### 4. Test It

```bash
# Use the demo client to pay and get a summary
npm run demo:client
```

Or hit it directly:

```bash
curl http://localhost:3402/summarize \
  -H "Content-Type: application/json" \
  -d '{"url": "https://en.wikipedia.org/wiki/Artificial_intelligence"}'
```

The first request returns `402 Payment Required` with payment details. The demo client handles payment automatically.

### 5. Watch the P&L

Open http://localhost:3402/dashboard in your browser, or:

```bash
curl http://localhost:3402/stats
```

## API

### `POST /summarize` (x402-protected, $0.01)

Request:
```json
{
  "url": "https://example.com/article"
}
```

Response:
```json
{
  "summary": "A concise summary of the article...",
  "url": "https://example.com/article",
  "wordCount": 150,
  "cost": {
    "inference": 0.002,
    "currency": "USD"
  }
}
```

### `GET /stats` (free)

```json
{
  "entity": "Minimum Viable Entity",
  "wallet": "fast15g69d...",
  "uptime": "2h 34m",
  "calls": 47,
  "revenue": 0.47,
  "costs": 0.094,
  "profit": 0.376,
  "margin": "80%",
  "status": "PROFITABLE"
}
```

### `GET /dashboard` (free)

Real-time HTML dashboard showing P&L, call history, and break-even analysis.

## How It Works

1. **Customer** sends a URL to `/summarize`
2. **x402 middleware** returns `402 Payment Required` with Fast payment details
3. **Customer's wallet** pays $0.01 USDC to the entity's Fast wallet
4. **Facilitator** verifies the payment on the Fast network
5. **Entity** fetches the URL, summarizes it (using web scraping + extraction)
6. **P&L tracker** records revenue (+$0.01) and inference cost
7. **Customer** gets their summary

## Philosophy

This is the atomic unit of an autonomous economy. One function. One wallet. One price. Can it survive?

If this works, everything else is just scale.

## Built With

- [Fast Network](https://fast.xyz) - Agent wallet & payments
- [x402 Protocol](https://skill.fast.xyz) - HTTP micropayment standard
- Express.js - HTTP server
- Node.js built-in fetch - Web scraping

## License

MIT
