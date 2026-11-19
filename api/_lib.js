// Shared helpers: Claude API call with web search, JSON extraction, source checking.

const API_URL = 'https://api.anthropic.com/v1/messages';
export const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-5-5';

// ---- Best-effort rate limit (per server instance) to protect API credit on a public link ----
const hits = new Map();
export function rateLimited(req, limit = Number(process.env.RATE_LIMIT_PER_HOUR || 20)) {
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 3600_000);
  if (recent.length >= limit) return true;
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

export function clip(value, max) {
  return String(value ?? '').slice(0, max).trim();
}

// ---- URL normalisation so "https://www.x.com/a/?utm_source=y" matches "http://x.com/a" ----
export function normalizeUrl(raw) {
  try {
    const u = new URL(String(raw).trim());
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    [...u.searchParams.keys()].forEach((k) => { if (/^utm_|^ref$|^fbclid$|^gclid$/i.test(k)) u.searchParams.delete(k); });
    const path = u.pathname.replace(/\/+$/, '');
    const qs = u.searchParams.toString();
    return `${host}${path}${qs ? '?' + qs : ''}`;
  } catch {
    return null;
  }
}

// ---- Call Claude with the web search tool, handling pause_turn ----
export async function runWithSearch({ system, user, maxSearches = 5, maxTokens = 8000, fetchImpl = fetch }) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('The server is missing its ANTHROPIC_API_KEY environment variable.');

  const allContent = [];
  let usage = { input_tokens: 0, output_tokens: 0, web_search_requests: 0 };

  for (let round = 0; round < 4; round++) {
    const messages = [{ role: 'user', content: user }];
    if (allContent.length) messages.push({ role: 'assistant', content: allContent });

    const res = await fetchImpl(API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        system,
        messages,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: maxSearches }],
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `Claude API error (${res.status})`);

    allContent.push(...(data.content || []));
    usage.input_tokens += data.usage?.input_tokens || 0;
    usage.output_tokens += data.usage?.output_tokens || 0;
    usage.web_search_requests += data.usage?.server_tool_use?.web_search_requests || 0;

    if (data.stop_reason !== 'pause_turn') break;
  }

  return { ...digest(allContent), usage };
}

// ---- Pull out what was actually searched and retrieved, plus the final text ----
export function digest(content) {
  const queries = [];
  const retrieved = new Map(); // normalized url -> {url,title,page_age}
  let text = '';

  for (const block of content) {
    if (block.type === 'server_tool_use' && block.name === 'web_search') {
      if (block.input?.query) queries.push(block.input.query);
    } else if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
      for (const r of block.content) {
        const n = normalizeUrl(r.url);
        if (n && !retrieved.has(n)) retrieved.set(n, { url: r.url, title: r.title, page_age: r.page_age || null });
      }
    } else if (block.type === 'text') {
      text += block.text;
    }
  }
  return { queries, retrieved, text };
}

export function extractJson(text) {
  const tagged = [...text.matchAll(/<result>([\s\S]*?)<\/result>/g)].pop();
  let body = tagged ? tagged[1] : text;
  body = body.replace(/```(?:json)?/g, '').trim();
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('The model did not return structured output. Try again.');
  return JSON.parse(body.slice(start, end + 1));
}

// ---- The safeguard: every cited source must be one the search actually returned ----
export function checkClaims(claims, retrieved) {
  return (Array.isArray(claims) ? claims : []).map((c) => {
    const n = c?.source_url ? normalizeUrl(c.source_url) : null;
    let status;
    if (!c?.source_url) status = 'unsourced';
    else if (n && retrieved.has(n)) status = 'source-retrieved';
    else status = 'source-not-retrieved';
    return { claim: c?.claim || '', source_url: c?.source_url || null, source_title: c?.source_title || null, status };
  });
}

export function sendError(res, status, message) {
  res.status(status).json({ error: message });
}
