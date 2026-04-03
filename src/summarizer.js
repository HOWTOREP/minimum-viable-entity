/**
 * Summarizer - fetches a URL and produces a summary.
 * 
 * Uses a built-in extractive approach (free, no API key needed).
 * If OPENAI_API_KEY or ANTHROPIC_API_KEY is set, uses that for better quality.
 */

import { config } from './config.js';

// Estimated cost per summary (in USD)
const EXTRACTIVE_COST = 0.0;   // Free - just text extraction
const LLM_COST_ESTIMATE = 0.003; // ~$0.003 per summary with GPT-4o-mini or Claude Haiku

/**
 * Fetch a URL and extract readable text content
 */
async function fetchContent(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'MinimumViableEntity/1.0 (autonomous-agent; +https://github.com/Pi-Squared-Inc/minimum-viable-entity)',
        'Accept': 'text/html,application/xhtml+xml,text/plain,*/*',
      },
      redirect: 'follow',
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    
    const contentType = res.headers.get('content-type') || '';
    const text = await res.text();

    // Strip HTML tags if needed
    if (contentType.includes('html')) {
      return stripHtml(text);
    }
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Basic HTML to text - strips tags, scripts, styles, and normalizes whitespace
 */
function stripHtml(html) {
  return html
    // Remove scripts and styles
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    // Convert block elements to newlines
    .replace(/<\/(p|div|h[1-6]|li|tr|br|blockquote)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    // Strip remaining tags
    .replace(/<[^>]+>/g, ' ')
    // Decode common entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Normalize whitespace
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n/g, '\n\n')
    .trim();
}

/**
 * Extractive summarizer - picks the most important sentences.
 * Free, no API key, decent quality for the price (zero).
 */
function extractiveSummarize(text, maxSentences = 5) {
  // Split into sentences
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 30 && s.length < 500);

  if (sentences.length === 0) {
    return text.slice(0, 500) + (text.length > 500 ? '...' : '');
  }

  // Score sentences by: length, position, keyword density
  const wordFreq = {};
  const allWords = text.toLowerCase().split(/\W+/).filter(w => w.length > 3);
  for (const w of allWords) {
    wordFreq[w] = (wordFreq[w] || 0) + 1;
  }

  const scored = sentences.map((sentence, idx) => {
    const words = sentence.toLowerCase().split(/\W+/).filter(w => w.length > 3);
    const keywordScore = words.reduce((sum, w) => sum + (wordFreq[w] || 0), 0) / (words.length || 1);
    const positionScore = idx < 3 ? 2 : idx < 10 ? 1.5 : 1; // Early sentences get a boost
    const lengthScore = Math.min(sentence.length / 100, 2); // Longer sentences slightly preferred

    return {
      sentence,
      score: keywordScore * positionScore * lengthScore,
      idx,
    };
  });

  // Pick top N sentences, maintain original order
  const top = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSentences)
    .sort((a, b) => a.idx - b.idx);

  return top.map(t => t.sentence).join(' ');
}

/**
 * LLM-powered summarizer (optional, costs money)
 */
async function llmSummarize(text) {
  const truncated = text.slice(0, 8000); // Keep input short to minimize cost

  if (config.openaiKey) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Summarize the following text in 3-5 concise sentences. Focus on the key points.' },
          { role: 'user', content: truncated },
        ],
        max_tokens: 300,
        temperature: 0.3,
      }),
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content || extractiveSummarize(text);
  }

  if (config.anthropicKey) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 300,
        messages: [
          { role: 'user', content: `Summarize the following text in 3-5 concise sentences. Focus on the key points.\n\n${truncated}` },
        ],
      }),
    });
    const data = await res.json();
    return data.content?.[0]?.text || extractiveSummarize(text);
  }

  // Fallback to extractive
  return extractiveSummarize(text);
}

/**
 * Main summarize function - returns summary + cost tracking
 */
export async function summarize(url) {
  const startTime = Date.now();
  const content = await fetchContent(url);
  const wordCount = content.split(/\s+/).length;

  const useLLM = !!(config.openaiKey || config.anthropicKey);
  const summary = useLLM
    ? await llmSummarize(content)
    : extractiveSummarize(content);

  const inferenceCost = useLLM ? LLM_COST_ESTIMATE : EXTRACTIVE_COST;
  const elapsed = Date.now() - startTime;

  return {
    summary,
    url,
    wordCount,
    processingTimeMs: elapsed,
    method: useLLM ? 'llm' : 'extractive',
    cost: {
      inference: inferenceCost,
      currency: 'USD',
    },
  };
}
