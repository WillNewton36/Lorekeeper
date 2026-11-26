// Shared server code: Claude API call with live web search (streamed), JSON extraction, source checking.

const API_URL = 'https://api.anthropic.com/v1/messages';
export const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-5-5';

// ---------- Best-effort rate limit (per server instance) to protect API credit on a public link ----------
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

// ---------- URL normalisation so "https://www.x.com/a/?utm_source=y" matches "http://x.com/a" ----------
export function normalizeUrl(raw) {
  try {
    const u = new URL(String(raw).trim().replace(/&amp;/g, '&'));
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    [...new Set(u.searchParams.keys())].forEach((k) => { if (!k || /^amp$|^utm_|^ref$|^fbclid$|^gclid$/i.test(k)) u.searchParams.delete(k); });
    const path = u.pathname.replace(/\/+$/, '');
    const qs = u.searchParams.toString();
    return `${host}${path}${qs ? '?' + qs : ''}`;
  } catch {
    return null;
  }
}

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

// ---------- Read Anthropic's server-sent events ----------
async function* readSSE(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let cut;
    while ((cut = buffer.indexOf('\n\n')) !== -1) {
      const chunk = buffer.slice(0, cut);
      buffer = buffer.slice(cut + 2);
      const data = chunk.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).join('');
      if (data) { try { yield JSON.parse(data); } catch { /* ignore malformed keep-alives */ } }
    }
  }
}

// One streamed request. Rebuilds the content blocks and reports searches and sources as they happen.
async function streamOnce({ key, system, messages, maxSearches, maxTokens, onEvent, fetchImpl }) {
  const res = await fetchImpl(API_URL, {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      stream: true,
      system,
      messages,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: maxSearches }],
    }),
  });
  if (!res.ok) {
    let msg = `Claude API error (${res.status})`;
    try { msg = (await res.json())?.error?.message || msg; } catch {}
    throw new Error(msg);
  }

  const blocks = [];
  const usage = { input_tokens: 0, output_tokens: 0 };
  let stopReason = null;
  let announcedWriting = false;

  for await (const ev of readSSE(res.body)) {
    switch (ev.type) {
      case 'message_start':
        usage.input_tokens += ev.message?.usage?.input_tokens || 0;
        break;
      case 'content_block_start': {
        const b = { ...ev.content_block };
        if (b.type === 'server_tool_use') b._json = '';
        if (b.type === 'text') {
          b.text = b.text || '';
          if (!announcedWriting) { announcedWriting = true; onEvent({ type: 'writing' }); }
        }
        blocks[ev.index] = b;
        if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) {
          onEvent({ type: 'sources', items: b.content.map((r) => ({ url: r.url, title: r.title, host: hostOf(r.url) })) });
        }
        break;
      }
      case 'content_block_delta': {
        const b = blocks[ev.index];
        if (!b) break;
        const d = ev.delta || {};
        if (d.type === 'text_delta') b.text += d.text;
        else if (d.type === 'input_json_delta') b._json += d.partial_json;
        else if (d.type === 'citations_delta') (b.citations ||= []).push(d.citation);
        break;
      }
      case 'content_block_stop': {
        const b = blocks[ev.index];
        if (b?.type === 'server_tool_use') {
          try { b.input = b._json ? JSON.parse(b._json) : b.input || {}; } catch { b.input = b.input || {}; }
          delete b._json;
          if (b.name === 'web_search' && b.input?.query) onEvent({ type: 'search', query: b.input.query });
        }
        break;
      }
      case 'message_delta':
        stopReason = ev.delta?.stop_reason ?? stopReason;
        usage.output_tokens = ev.usage?.output_tokens ?? usage.output_tokens;
        break;
      case 'error':
        throw new Error(ev.error?.message || 'Claude API stream error');
      default:
        break;
    }
  }
  return { blocks: blocks.filter(Boolean), stopReason, usage };
}

// ---------- Call Claude with web search; continues automatically if a long search turn pauses ----------
export async function runWithSearch({ system, user, maxSearches = 5, maxTokens = 8000, onEvent = () => {}, fetchImpl = fetch }) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('The research engine is not connected: the server is missing its ANTHROPIC_API_KEY setting.');

  const all = [];
  const usage = { input_tokens: 0, output_tokens: 0 };
  let stopReason = null;
  for (let round = 0; round < 4; round++) {
    const messages = [{ role: 'user', content: user }];
    if (all.length) messages.push({ role: 'assistant', content: all });
    const r = await streamOnce({ key, system, messages, maxSearches, maxTokens, onEvent, fetchImpl });
    all.push(...r.blocks);
    usage.input_tokens += r.usage.input_tokens;
    usage.output_tokens += r.usage.output_tokens;
    stopReason = r.stopReason;
    if (r.stopReason !== 'pause_turn') break;
  }
  const d = digest(all);
  return { ...d, stopReason, usage: { ...usage, web_search_requests: d.queries.length } };
}

// ---------- What was actually searched and retrieved, plus the final text ----------
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
        if (n && !retrieved.has(n)) retrieved.set(n, { url: r.url, title: r.title, host: hostOf(r.url), page_age: r.page_age || null });
      }
    } else if (block.type === 'text') {
      text += block.text;
    }
  }
  return { queries, retrieved, text };
}

// Recover every complete {...} object from a JSON array that was cut off part-way.
export function salvageArray(text, key) {
  const start = text.indexOf(`"${key}"`);
  if (start === -1) return [];
  const open = text.indexOf('[', start);
  if (open === -1) return [];
  const items = []; let depth = 0; let inStr = false; let esc = false; let objStart = -1;
  for (let i = open + 1; i < text.length; i++) {
    const c = text[i];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === '{') { if (depth === 0) objStart = i; depth++; }
    else if (c === '}') { depth--; if (depth === 0 && objStart !== -1) { try { items.push(JSON.parse(text.slice(objStart, i + 1))); } catch {} objStart = -1; } }
    else if (c === ']' && depth === 0) break;
  }
  return items;
}

export function extractJson(text) {
  const tagged = [...text.matchAll(/<result>([\s\S]*?)<\/result>/g)].pop();
  let body = tagged ? tagged[1] : text;
  body = body.replace(/```(?:json)?/g, '').trim();
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('The research finished but the answer came back in the wrong format. Run it again.');
  return JSON.parse(body.slice(start, end + 1));
}

// A DOI is a paper's permanent identifier; the same paper can appear under many URLs.
export function doiOf(raw) {
  const m = decodeURIComponent(String(raw || '').replace(/&amp;/g, '&')).match(/10\.\d{4,9}\/[^\s&?#"'<>]+/i);
  return m ? m[0].replace(/\.(pdf|full|abstract)$/i, '').replace(/\/(full|pdf|abstract)$/i, '').toLowerCase() : null;
}

// ---------- The safeguard: every cited source must be one the search actually returned ----------
// Match 1: the same URL (ignoring tracking parameters and formatting). Match 2: the same paper by DOI.
export function checkClaims(claims, retrieved) {
  const dois = new Set([...retrieved.values()].map((r) => doiOf(r.url)).filter(Boolean));
  return (Array.isArray(claims) ? claims : []).map((c) => {
    const n = c?.source_url ? normalizeUrl(c.source_url) : null;
    const doi = c?.source_url ? doiOf(c.source_url) : null;
    let status;
    if (!c?.source_url) status = 'unsourced';
    else if ((n && retrieved.has(n)) || (doi && dois.has(doi))) status = 'source-retrieved';
    else status = 'source-not-retrieved';
    return { claim: c?.claim || '', source_url: c?.source_url || null, source_title: c?.source_title || null, status };
  });
}

// ---------- Streaming response to the browser: one JSON object per line ----------
export function openStream(res) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');
  return (obj) => res.write(JSON.stringify(obj) + '\n');
}

export function sendError(res, status, message) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ error: message }));
}

export async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  let raw = '';
  for await (const c of req) raw += c;
  try { return JSON.parse(raw || '{}'); } catch { return {}; }
}

// ---------- A plain (non-streaming, no tools) Claude call, used by the script studio ----------
export async function runPlain({ system, user, maxTokens = 4000, fetchImpl = fetch }) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('The research engine is not connected: the server is missing its ANTHROPIC_API_KEY setting.');
  const res = await fetchImpl(API_URL, {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `Claude API error (${res.status})`);
  const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  return { text, stopReason: data.stop_reason, usage: { input_tokens: data.usage?.input_tokens || 0, output_tokens: data.usage?.output_tokens || 0 } };
}
