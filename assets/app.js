/* Lorekeeper v2 front end. Plain JavaScript, no build step. All user data lives in this browser. */
'use strict';

/* ---------- Utilities ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = (u) => (/^https?:\/\//i.test(String(u || '')) ? String(u) : null);
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const fmt = (n) => (n == null || isNaN(n) ? '–' : n >= 10000 ? (n / 1000).toFixed(n >= 100000 ? 0 : 1) + 'k' : Math.round(n).toLocaleString());
const pct = (n) => (n == null || isNaN(n) ? '–' : (n * 100).toFixed(1) + '%');
const ago = (iso) => {
  const s = (Date.now() - new Date(iso)) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

const store = {
  get(k, d) { try { const v = localStorage.getItem('lk2_' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('lk2_' + k, JSON.stringify(v)); } catch { toast('Your browser blocked saving. Changes will not survive a refresh.'); } },
};

const ICON = {
  chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
  left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
  right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>',
};

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

function download(name, rows) {
  const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------- Navigation ---------- */
const VIEWS = ['home', 'brand', 'research', 'remix', 'plan', 'script', 'log', 'how'];
function go(view, push = true) {
  if (!VIEWS.includes(view)) view = 'home';
  $$('.nav button').forEach((b) => (b.dataset.view === view ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current')));
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + view));
  if (push) history.replaceState(null, '', '#' + view);
  ({ home: renderHome, brand: renderPosts, research: renderChips, plan: renderBoard, script: renderScriptView, log: renderLog }[view] || (() => {}))();
  window.scrollTo({ top: 0 });
}
$$('.nav button').forEach((b) => b.addEventListener('click', () => go(b.dataset.view)));
document.addEventListener('click', (e) => { const g = e.target.closest('[data-go]'); if (g) { e.preventDefault(); go(g.dataset.go); } });

/* ---------- Engine status ---------- */
fetch('/api/health').then((r) => r.json()).then((h) => {
  $('#engine').classList.add(h.connected ? 'on' : 'off');
  $('#engineText').textContent = h.connected ? 'Research engine connected' : 'Research engine not connected';
}).catch(() => { $('#engine').classList.add('off'); $('#engineText').textContent = 'Research engine offline'; });

/* ---------- Brand profile ---------- */
const FIELDS = ['handle', 'platform', 'niche', 'audience', 'goals', 'voice', 'pillars', 'avoid', 'inspirations', 'posts'];
const SAMPLE = {
  handle: '@sample.philosophy',
  platform: 'Instagram Reels',
  niche: 'Philosophy and psychology applied to everyday life',
  audience: '18 to 30 year olds interested in self-improvement who are tired of hustle culture and want ideas with substance',
  goals: 'Reach 10k followers with a loyal audience that saves and shares; be known for accurate, thoughtful content',
  voice: 'Calm, direct and grounded. Talking-head to camera. Opens with a thinker or a story, then a modern application. No hype, no yelling.',
  pillars: 'Philosophy; Societal commentary; Personal growth',
  avoid: 'Hustle-culture clichés, misquoted philosophers, pop-psychology claims without evidence, emotional maturity content',
  inspirations: 'Educational talking-head creators in philosophy and self-improvement',
  posts: `topic,format,views,likes,saves,shares,comments
Why Marcus Aurelius wrote to himself every night,talking-head,48200,3100,910,420,88
Seneca on why you're always busy,talking-head,31500,2050,1200,310,64
Nietzsche's amor fati explained,talking-head,22900,1500,640,210,97
The phone in your pocket and Pascal's quiet room,talking-head,12800,760,190,70,31
Why comparison steals your joy (study),talking-head,9400,520,140,60,40
5 Stoic habits for a better morning,listicle,6100,280,60,15,12
My week without social media,vlog,4300,210,25,8,19`,
};

const profileForm = $('#profileForm');
function readProfile() { const p = {}; FIELDS.forEach((f) => (p[f] = $(`[name=${f}]`, profileForm).value)); return p; }
function writeProfile(p) { FIELDS.forEach((f) => ($(`[name=${f}]`, profileForm).value = p?.[f] || '')); }
function profile() { return store.get('profile', {}); }

let saveTimer;
profileForm.addEventListener('input', () => {
  $('#saveState').textContent = 'Saving…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { store.set('profile', readProfile()); $('#saveState').textContent = 'All changes saved'; updateCompleteness(); renderPosts(); }, 350);
});
$('#postsFile').addEventListener('change', async (e) => {
  const file = e.target.files[0]; e.target.value = '';
  if (!file) return;
  if (/\.numbers$/i.test(file.name)) { toast('That is a Numbers file. In Numbers choose File, then Export To, then CSV, and upload that file.'); return; }
  if (/\.(xlsx|xls)$/i.test(file.name)) { toast('That is an Excel file. Choose File, then Save As or Export, pick CSV, and upload that file.'); return; }
  const tidy = tidyExport(await file.text());
  if (!tidy) { toast('Lorekeeper could not find a views, plays or reach column in that file. Check it is a post-level export.'); return; }
  const box = $('[name=posts]', profileForm);
  box.value = tidy.csv;
  box.dispatchEvent(new Event('input', { bubbles: true }));
  toast(tidy.total > tidy.kept ? `Read ${tidy.total} posts. Kept your ${tidy.kept} most recent.` : `Read ${tidy.total} posts from ${file.name}.`);
});
$('#loadSample').onclick = () => { writeProfile(SAMPLE); store.set('profile', SAMPLE); updateCompleteness(); renderPosts(); toast('Sample creator loaded. Replace it with your own details any time.'); };
$('#clearProfile').onclick = () => { if (!confirmInline('#clearProfile', 'Clear everything?')) return; writeProfile({}); store.set('profile', {}); updateCompleteness(); renderPosts(); toast('Profile cleared'); };

// Two-step confirm without a browser dialog: first click arms the button, second click confirms.
function confirmInline(sel, label) {
  const b = $(sel);
  if (b.dataset.armed) { delete b.dataset.armed; b.textContent = b.dataset.label; return true; }
  b.dataset.label = b.textContent; b.dataset.armed = '1'; b.textContent = label;
  setTimeout(() => { if (b.dataset.armed) { delete b.dataset.armed; b.textContent = b.dataset.label; } }, 3000);
  return false;
}

function completeness(p = profile()) {
  const keys = ['handle', 'niche', 'audience', 'voice', 'pillars', 'avoid', 'goals', 'posts'];
  const done = keys.filter((k) => String(p[k] || '').trim().length > 2).length;
  return { done, total: keys.length };
}
function updateCompleteness() {
  const { done, total } = completeness(readProfile());
  $('#completeBar').style.width = `${(done / total) * 100}%`;
  $('#completeText').textContent = `${done} of ${total} sections filled`;
}

/* ---------- Post data: parse locally, no AI ---------- */
// Full CSV parser: handles quoted fields containing commas, quotes and line breaks (multi-line captions).
function parseCSV(text) {
  const src = String(text || '').replace(/^\uFEFF/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] || '';
  const delim = (firstLine.match(/\t/g) || []).length > (firstLine.match(/,/g) || []).length ? '\t' : ',';
  const rows = []; let row = []; let cur = ''; let q = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) { if (c === '"' && src[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; continue; }
    if (c === '"') q = true;
    else if (c === delim) { row.push(cur.trim()); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && src[i + 1] === '\n') i++; row.push(cur.trim()); cur = ''; if (row.some((x) => x)) rows.push(row); row = []; }
    else cur += c;
  }
  row.push(cur.trim()); if (row.some((x) => x)) rows.push(row);
  return rows;
}
// Column finders, in priority order. ID, link and account columns are never used as the title.
const COLS = {
  title: [/^(description|caption)$/i, /description|caption/i, /title|topic/i, /^post$/i],
  format: [/post type|media type|^format$|^type$/i, /format|type/i],
  date: [/publish time|published|posted|^date$/i, /date|time/i],
  views: [/^views?$|plays/i, /view/i, /reach/i, /impression/i],
  likes: [/^likes?$/i, /like/i], saves: [/^saves?$/i, /save/i], shares: [/^shares?$/i, /share/i], comments: [/^comments?$/i, /comment/i],
};
const NEVER_TITLE = /\bid\b|link|url|permalink|account|username|duration/i;
function findColumns(header) {
  const idx = {}; const used = new Set();
  for (const [key, patterns] of Object.entries(COLS)) {
    for (const re of patterns) {
      const i = header.findIndex((h, j) => !used.has(j) && re.test(h) && !(key === 'title' && NEVER_TITLE.test(h)) && !(key !== 'date' && /time/i.test(h) && /publish/i.test(h)));
      if (i !== -1) { idx[key] = i; used.add(i); break; }
    }
  }
  return idx;
}
function toNum(v) { const s = String(v ?? '').trim(); if (!s || /^(-|–|n\/a)$/i.test(s)) return null; const n = parseFloat(s.replace(/[^0-9.]/g, '')); return isNaN(n) ? null : /k$/i.test(s) ? n * 1000 : /m$/i.test(s) ? n * 1e6 : n; }
function parsePosts(text) {
  const rows = parseCSV(text);
  if (rows.length < 2) return [];
  const headerAt = rows.findIndex((r) => r.some((h) => /view|play|reach|impression/i.test(h)));
  if (headerAt === -1) return [];
  const idx = findColumns(rows[headerAt]);
  if (idx.views == null) return [];
  return rows.slice(headerAt + 1).map((r) => {
    const raw = (idx.title != null ? r[idx.title] : '') || '(untitled)';
    const p = { title: raw.replace(/\s+/g, ' ').trim(), format: idx.format != null ? r[idx.format] || '' : '', date: idx.date != null ? r[idx.date] || '' : '' };
    ['views', 'likes', 'saves', 'shares', 'comments'].forEach((k) => (p[k] = idx[k] != null ? toNum(r[idx[k]]) : null));
    p.saveRate = p.views && p.saves != null ? p.saves / p.views : null;
    return p;
  }).filter((p) => p.views != null);
}
// Turns any analytics export into a short, clean table: the parts that matter, trimmed captions, newest first.
function tidyExport(text, limit = 40) {
  const posts = parsePosts(text);
  if (!posts.length) return null;
  const sorted = posts.some((p) => p.date && !isNaN(Date.parse(p.date))) ? [...posts].sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0)) : posts;
  const cut = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
  const cell = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const hasDate = sorted.some((p) => p.date);
  const head = ['topic', 'format', ...(hasDate ? ['date'] : []), 'views', 'likes', 'saves', 'shares', 'comments'];
  const lines = sorted.slice(0, limit).map((p) => [cut(p.title, 110), p.format, ...(hasDate ? [String(p.date).split(/[ T]/)[0]] : []), p.views, p.likes ?? '', p.saves ?? '', p.shares ?? '', p.comments ?? ''].map(cell).join(','));
  return { csv: [head.join(','), ...lines].join('\n'), total: posts.length, kept: Math.min(limit, posts.length) };
}
function median(a) { const s = a.filter((x) => x != null).sort((x, y) => x - y); if (!s.length) return null; const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
function postStats(posts) {
  if (!posts.length) return null;
  const byViews = [...posts].sort((a, b) => b.views - a.views);
  const withRate = posts.filter((p) => p.saveRate != null);
  const bySave = [...withRate].sort((a, b) => b.saveRate - a.saveRate);
  const formats = {};
  posts.forEach((p) => { if (p.format) (formats[p.format.toLowerCase()] ||= []).push(p.views); });
  const fmtRank = Object.entries(formats).map(([f, v]) => [f, median(v), v.length]).sort((a, b) => b[1] - a[1]);
  return { n: posts.length, medianViews: median(posts.map((p) => p.views)), top: byViews[0], bestSave: bySave[0], medianSave: median(withRate.map((p) => p.saveRate)), bestFormat: fmtRank[0], formats: fmtRank };
}
function renderPosts() {
  const posts = parsePosts($('[name=posts]', profileForm).value);
  const box = $('#postsPreview');
  $('#postsCount').textContent = posts.length ? `${posts.length} posts read` : '';
  if (!posts.length) {
    box.innerHTML = `<p class="subtle" style="margin-top:10px">${$('[name=posts]', profileForm).value.trim() ? 'Lorekeeper could not find a views column. Add a header row that includes “views”. Your text is still sent to the AI as written.' : 'No post data yet. Ideas will still work, but they get much sharper with it.'}</p>`;
    return;
  }
  const max = Math.max(...posts.map((p) => p.views));
  const rows = [...posts].sort((a, b) => b.views - a.views).map((p) => `<tr>
    <td class="title-cell">${esc(p.title)}${p.format || p.date ? `<div class="subtle">${esc([p.format, String(p.date || '').split(/[ T]/)[0]].filter(Boolean).join(', '))}</div>` : ''}</td>
    <td><div class="bar"><span style="width:${(p.views / max) * 100}%"></span></div></td>
    <td class="num">${fmt(p.views)}</td><td class="num">${pct(p.saveRate)}</td></tr>`).join('');
  box.innerHTML = `<table class="posts-table"><thead><tr><th>Post</th><th></th><th style="text-align:right">Views</th><th style="text-align:right">Save rate</th></tr></thead><tbody>${rows}</tbody></table>`;
}

/* ---------- Studio (home) ---------- */
function renderHome() {
  const p = profile();
  const plan = store.get('plan', []);
  const runs = store.get('runs', []);
  const posts = parsePosts(p.posts);
  const steps = [
    { done: !!(p.niche && p.voice), title: 'Describe your brand', desc: 'Niche, voice, pillars and boundaries', go: 'brand', cta: 'Open Brand' },
    { done: posts.length > 0, title: 'Add your post data', desc: 'Paste your analytics so ideas build on what works', go: 'brand', cta: 'Add data' },
    { done: runs.length > 0, title: 'Run your first research', desc: 'Watch Lorekeeper search your niche live', go: 'research', cta: 'Research' },
    { done: plan.length > 0, title: 'Keep the ideas you like', desc: 'Kept ideas become your content plan', go: plan.length ? 'plan' : 'research', cta: plan.length ? 'Open plan' : 'Review ideas' },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  $('#setupProgress').textContent = doneCount === 4 ? 'All set' : `${doneCount} of 4 done`;
  $('#steps').innerHTML = steps.map((s) => `<li class="${s.done ? 'done' : ''}"><div><div class="step-title">${s.title}</div><div class="step-desc">${s.desc}</div></div>
    <button class="btn ${s.done ? 'quiet' : 'secondary'} sm" data-go="${s.go}">${s.done ? 'Revisit' : s.cta}</button></li>`).join('');
  $('#homeExtra').innerHTML = p.niche ? '' : '<p class="subtle" style="margin-top:14px">Just exploring? <button class="btn quiet sm" id="homeSample">Use a sample creator</button></p>';
  $('#homeSample')?.addEventListener('click', () => { writeProfile(SAMPLE); store.set('profile', SAMPLE); updateCompleteness(); renderHome(); toast('Sample creator loaded'); });
  $('#homeLead').textContent = p.handle ? `Welcome back, ${p.handle}. Here is where your page and your plan stand.` : 'Tell Lorekeeper who you are as a creator, and it will research your niche and turn what it finds into ideas you can trust.';

  const st = postStats(posts);
  $('#glancePanel').innerHTML = st
    ? `<div class="panel-head"><h2>Your page at a glance</h2><span class="subtle">from ${st.n} posts</span></div>
      <div class="glance">
        <div><div class="num">${fmt(st.medianViews)}</div><div class="lbl">Median views</div></div>
        <div><div class="num">${pct(st.medianSave)}</div><div class="lbl">Median save rate</div></div>
        ${st.bestFormat ? `<div class="wide"><div class="num">${esc(st.bestFormat[0])}</div><div class="lbl">Strongest format: median ${fmt(st.bestFormat[1])} views across ${st.bestFormat[2]} posts</div></div>` : ''}
        <div class="wide"><div class="num">${esc(st.bestSave?.title || st.top.title)}</div><div class="lbl">Most saved per view (${pct(st.bestSave?.saveRate)}): the kind of post your audience wants to keep</div></div>
      </div>`
    : `<div class="empty" style="padding:4px 0"><h3>Your page at a glance</h3><p>Paste your post data on the Brand page to see your median views, save rate and strongest format here.</p><button class="btn secondary sm" data-go="brand">Add post data</button></div>`;

  const stageCounts = ['Shortlisted', 'Scripting', 'Filmed', 'Posted'].map((s) => plan.filter((x) => x.stage === s).length);
  const last = runs[0];
  $('#recentPanel').innerHTML = `<div class="panel-head"><h2>Pipeline</h2><button class="btn quiet sm" data-go="plan">Open plan</button></div>
    <div class="glance">${['Shortlisted', 'Scripting', 'Filmed', 'Posted'].map((s, i) => `<div><div class="num">${stageCounts[i]}</div><div class="lbl">${s}</div></div>`).join('')}</div>
    <p class="subtle" style="margin-top:12px">${last ? `Last research ${ago(last.at)}: ${last.data.ideas.length} ideas${last.focus ? ` on “${esc(last.focus)}”` : ''}. <a href="#research" data-go="research">View</a>` : 'No research yet.'}</p>`;
}

/* ---------- Streaming client ---------- */
async function stream(path, body, onEvent) {
  const res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const type = res.headers.get('content-type') || '';
  if (!res.ok || !type.includes('ndjson')) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `The server returned an error (${res.status}).`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = ''; let final = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line) continue;
      const ev = JSON.parse(line);
      if (ev.type === 'error') throw new Error(ev.message);
      if (ev.type === 'done') final = ev.data; else onEvent(ev);
    }
  }
  if (!final) throw new Error('The connection closed before the research finished. Run it again.');
  return final;
}

/* ---------- Research trail (live) ---------- */
function Trail(el, title) {
  let items = []; let t0 = 0; let timer = null; let searches = 0; let sources = 0;
  const hostsHtml = (list) => `<div class="trail-hosts">${list.slice(0, 6).map((s) => { const u = safeUrl(s.url); return u ? `<a href="${esc(u)}" target="_blank" rel="noopener" title="${esc(s.title)}">${esc(s.host || hostOf(u))}</a>` : ''; }).join('')}${list.length > 6 ? `<span>+${list.length - 6} more</span>` : ''}</div>`;
  function draw(live) {
    const secs = t0 ? Math.round((Date.now() - t0) / 1000) : 0;
    el.innerHTML = `<h3>${title}</h3><div class="trail-sub">${live ? 'Live: every search Lorekeeper makes appears here' : items.length ? 'What Lorekeeper searched and read for this result' : 'Every search appears here as it happens'}</div>
      ${items.length ? `<ol class="trail-list" aria-live="polite">${items.map((it, i) => `<li class="trail-item ${it.kind} ${live && i === items.length - 1 ? 'live' : ''}">
        <div class="trail-kind">${it.label}</div>${it.query ? `<div class="trail-query">${esc(it.query)}</div>` : ''}${it.sources ? hostsHtml(it.sources) : ''}</li>`).join('')}</ol>`
        : '<p class="trail-empty">When you run research, you will see each search Lorekeeper makes and every source it reads, so you know exactly where an idea came from.</p>'}
      ${items.length ? `<div class="trail-foot"><span>${searches} ${searches === 1 ? 'search' : 'searches'}, ${sources} sources</span><span>${secs ? secs + 's' : ''}</span></div>` : ''}`;
  }
  return {
    start() { items = []; searches = 0; sources = 0; t0 = Date.now(); clearInterval(timer); timer = setInterval(() => draw(true), 1000); draw(true); },
    event(ev) {
      if (ev.type === 'stage') items.push({ kind: 'stage', label: ev.label });
      else if (ev.type === 'search') { searches++; items.push({ kind: 'search', label: `Search ${searches}`, query: ev.query }); }
      else if (ev.type === 'sources') {
        sources += ev.items.length;
        const last = [...items].reverse().find((x) => x.kind === 'search' && !x.sources);
        if (last) last.sources = ev.items; else items.push({ kind: 'search', label: 'Sources', sources: ev.items });
      } else if (ev.type === 'writing') items.push({ kind: 'writing', label: 'Writing up ideas from what it found' });
      draw(true);
    },
    stop() { clearInterval(timer); draw(false); },
    restore(research) {
      clearInterval(timer); t0 = 0;
      const per = Math.max(1, Math.ceil(research.sources.length / Math.max(1, research.queries.length)));
      items = research.queries.map((q, i) => ({ kind: 'search', label: `Search ${i + 1}`, query: q, sources: research.sources.slice(i * per, i * per + per) }));
      searches = research.queries.length; sources = research.sources.length; draw(false);
    },
    empty() { items = []; clearInterval(timer); draw(false); },
  };
}
const ideasTrail = Trail($('#ideasTrail'), 'Research trail');
const remixTrail = Trail($('#remixTrail'), 'Research trail');

/* ---------- Claims ---------- */
const BADGE = { 'source-retrieved': ['ok', 'Found in search'], 'source-not-retrieved': ['bad', 'Not found in search'], unsourced: ['warn', 'No source'] };
function claimsHtml(claims) {
  if (!claims?.length) return '<span class="subtle">No factual claims in this idea.</span>';
  return claims.map((c) => {
    const [cls, label] = BADGE[c.status] || BADGE.unsourced;
    const u = safeUrl(c.source_url);
    return `<div class="claim"><span class="badge ${cls}">${label}</span><div>${esc(c.claim)}${u ? `<a class="src" href="${esc(u)}" target="_blank" rel="noopener">${esc(c.source_title || hostOf(u))}</a>` : ''}</div></div>`;
  }).join('');
}
function claimSummary(claims) {
  const c = { 'source-retrieved': 0, 'source-not-retrieved': 0, unsourced: 0 };
  (claims || []).forEach((x) => (c[x.status] = (c[x.status] || 0) + 1));
  return Object.entries(c).filter(([, n]) => n).map(([k, n]) => `<span class="badge ${BADGE[k][0]}">${n} ${BADGE[k][1].toLowerCase()}</span>`).join('');
}

/* ---------- Decisions ---------- */
// The log is append-only: bringing an idea back adds a 'restored' entry rather than erasing the rejection.
function latestFor(key, log = store.get('log', [])) { return log.filter((x) => x.key === key).at(-1); }
function decisionFor(key) { const d = latestFor(key); return d && d.decision !== 'restored' ? d : undefined; }
function snapshot(idea) { const { title, hook, angle, pillar, format, effort, outline, claims, attribution } = idea; return { title, hook, angle, pillar, format, effort, outline, claims, attribution }; }
function findIdea(key) {
  const entry = store.get('log', []).find((x) => x.key === key && x.idea);
  if (entry) return { idea: entry.idea, kind: entry.kind };
  for (const r of store.get('runs', [])) { const i = (r.data.ideas || []).findIndex((_, j) => `${r.id}-${j}` === key); if (i !== -1) return { idea: r.data.ideas[i], kind: 'research' }; }
  for (const r of store.get('remixes', [])) if (`remix-${r.id}` === key) { const d = r.data; return { idea: { ...d.original_idea, claims: d.claims, attribution: d.attribution, pillar: 'Remix', format: d.structure?.format }, kind: 'remix' }; }
  return null;
}
function restoreIdea(key) {
  const d = decisionFor(key);
  if (!d || d.decision !== 'reject') return;
  const log = store.get('log', []);
  log.push({ key, title: d.title, decision: 'restored', reason: '', kind: d.kind, at: new Date().toISOString() });
  store.set('log', log);
  toast('Brought back. Keep it or reject it again; your earlier reason stays in Decisions.');
}
function decide(key, idea, decision, reason, kind) {
  const log = store.get('log', []);
  if (decisionFor(key)) return;
  log.push({ key, title: idea.title, decision, reason, kind, at: new Date().toISOString(), idea: snapshot(idea) });
  store.set('log', log);
  if (decision === 'keep') {
    const plan = store.get('plan', []);
    plan.push({ id: uid(), key, title: idea.title, hook: idea.hook, angle: idea.angle || '', pillar: idea.pillar || (kind === 'remix' ? 'Remix' : ''), format: idea.format || '', effort: idea.effort || '', outline: idea.outline || [], claims: idea.claims || [], attribution: idea.attribution || '', stage: 'Shortlisted', date: '', notes: '', addedAt: new Date().toISOString() });
    store.set('plan', plan);
    updatePlanCount();
    toast('Kept. Added to your content plan.');
  } else toast('Rejected. Your reason is in Decisions.');
}
function actionsHtml(key) {
  const d = decisionFor(key);
  if (d) return `<span class="decision-note ${d.decision === 'keep' ? 'kept' : 'rejected'}">${d.decision === 'keep' ? '✓ Kept, in your plan' : '✕ Rejected'}${d.reason ? ` <small>“${esc(d.reason)}”</small>` : ''}</span>${d.decision === 'reject' ? '<span class="spacer"></span><button class="btn secondary sm" data-act="restore">Bring back</button>' : ''}`;
  return `<button class="btn sm" data-act="keep">${ICON.plus} Keep</button>
    <button class="btn secondary sm" data-act="reject-open">Reject</button>
    <span class="spacer"></span>
    <button class="btn quiet sm" data-act="copy">${ICON.copy} Copy</button>
    <div class="reject-form"><input type="text" placeholder="Why are you rejecting it? (helps you spot patterns later)" aria-label="Reason for rejecting" /><button class="btn danger sm" data-act="reject">Reject idea</button></div>`;
}
function ideaText(d) {
  return [d.title, '', `Hook: ${d.hook}`, d.angle ? `Angle: ${d.angle}` : '', '', 'Outline:', ...(d.outline || []).map((x, i) => `${i + 1}. ${x}`), '', 'Sources:', ...(d.claims || []).map((c) => `- ${c.claim}${c.source_url ? ` (${c.source_url})` : ' (no source)'}`), d.attribution ? `\nCredit: ${d.attribution}` : ''].filter((x) => x !== '').join('\n');
}
function wireIdea(el, idea, kind) {
  const key = el.dataset.key;
  el.addEventListener('click', async (e) => {
    const top = e.target.closest('.idea-top');
    if (top) { const open = el.dataset.open !== 'true'; el.dataset.open = open; top.setAttribute('aria-expanded', open); return; }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    if (act === 'keep') { decide(key, idea, 'keep', $('.reject-form input', el)?.value.trim() || '', kind); refreshIdea(el); }
    if (act === 'reject-open') { $('.reject-form', el).classList.add('open'); $('.reject-form input', el).focus(); }
    if (act === 'reject') { decide(key, idea, 'reject', $('.reject-form input', el).value.trim(), kind); refreshIdea(el); }
    if (act === 'restore') { restoreIdea(key); refreshIdea(el); }
    if (act === 'copy') { try { await navigator.clipboard.writeText(ideaText(idea)); toast('Idea copied'); } catch { toast('Copy failed. Select the text instead.'); } }
  });
  $('.reject-form input', el)?.addEventListener('keydown', (e) => { if (e.key === 'Enter') $('[data-act=reject]', el).click(); });
}
function refreshIdea(el) {
  const d = decisionFor(el.dataset.key);
  el.classList.toggle('kept', d?.decision === 'keep');
  el.classList.toggle('rejected', d?.decision === 'reject');
  $('.idea-actions', el).innerHTML = actionsHtml(el.dataset.key);
}

/* ---------- Research ideas ---------- */
let ideaCount = 5;
$$('#countPicker button').forEach((b) => b.addEventListener('click', () => { ideaCount = +b.dataset.n; $$('#countPicker button').forEach((x) => x.setAttribute('aria-pressed', x === b)); }));
function renderChips() {
  const pillars = String(profile().pillars || '').split(/[;\n]/).map((s) => s.trim()).filter(Boolean).slice(0, 6);
  $('#focusChips').innerHTML = pillars.length ? `<span class="subtle" style="align-self:center;margin-right:2px">Focus on a pillar:</span>${pillars.map((p) => `<button class="chip" type="button">${esc(p)}</button>`).join('')}` : '';
  $$('#focusChips .chip').forEach((c) => c.addEventListener('click', () => { $('#focus').value = c.textContent; $('#focus').focus(); }));
}
function ideaHtml(d, key) {
  return `<article class="idea" data-key="${esc(key)}" data-open="false">
    <button class="idea-top" aria-expanded="false">
      <div class="idea-meta">${d.pillar ? `<span class="tag pillar">${esc(d.pillar)}</span>` : ''}${d.format ? `<span class="tag">${esc(d.format)}</span>` : ''}${d.effort ? `<span class="tag">${esc(d.effort)} effort</span>` : ''}</div>
      <div class="idea-title">${esc(d.title)}</div>
      <div class="idea-hook">“${esc(d.hook)}”</div>
      <div class="idea-checks">${claimSummary(d.claims)}<span class="expand-hint">Details ${ICON.chevron}</span></div>
    </button>
    <div class="idea-body">
      ${d.angle ? `<div class="idea-section"><h4>Angle</h4><div>${esc(d.angle)}</div></div>` : ''}
      ${d.outline?.length ? `<div class="idea-section"><h4>Outline</h4><ol>${d.outline.map((x) => `<li>${esc(x)}</li>`).join('')}</ol></div>` : ''}
      ${d.why_it_fits ? `<div class="idea-section"><h4>Why it fits you</h4><div>${esc(d.why_it_fits)}</div></div>` : ''}
      <div class="idea-section"><h4>Claims and sources</h4><div>${claimsHtml(d.claims)}</div></div>
      ${d.accuracy_risk ? `<div class="idea-section"><h4>Accuracy risk</h4><div class="risk-box">${esc(d.accuracy_risk)}</div></div>` : ''}
      ${d.craft_tip ? `<div class="idea-section"><h4>Craft tip</h4><div>${esc(d.craft_tip)}</div></div>` : ''}
    </div>
    <div class="idea-actions">${actionsHtml(key)}</div>
  </article>`;
}
function renderRun(run) {
  const runs = store.get('runs', []);
  const d = run.data;
  const history = runs.length > 1 ? `<label class="history subtle">Showing <select id="runPicker">${runs.map((r) => `<option value="${r.id}" ${r.id === run.id ? 'selected' : ''}>${esc(ago(r.at))}${r.focus ? `: ${esc(r.focus.slice(0, 40))}` : ''}</option>`).join('')}</select></label>` : `<span class="subtle">Researched ${ago(run.at)}</span>`;
  const insights = (d.performance_insights || []).map((x) => `<li><strong>${esc(x.insight)}</strong><span>${esc(x.evidence)}</span></li>`).join('');
  $('#ideasOut').innerHTML = `
    <div class="row" style="margin:22px 0 12px"><h2 style="font-size:var(--t-xl)">${d.ideas.length} ideas</h2><span class="spacer"></span>${history}</div>
    ${d.meta?.truncated ? `<div class="error-box" style="background:var(--bronze-wash);color:#5e3f17"><strong>Showing ${d.ideas.length} of ${d.meta.requested} ideas.</strong>The answer ran long and was cut off, so Lorekeeper kept every idea that was finished in full. Run again for more.</div>` : ''}
    ${insights ? `<div class="panel panel-pad"><h3 style="font-size:var(--t-lg);margin-bottom:12px">What is working on your page</h3><ul class="insights">${insights}</ul></div>` : ''}
    <div class="ideas">${d.ideas.map((idea, i) => ideaHtml(idea, `${run.id}-${i}`)).join('')}</div>`;
  $$('#ideasOut .idea').forEach((el, i) => { wireIdea(el, d.ideas[i], 'research'); refreshIdea(el); });
  $('#runPicker')?.addEventListener('change', (e) => { const r = store.get('runs', []).find((x) => x.id === e.target.value); if (r) { renderRun(r); ideasTrail.restore(r.data.research); } });
}
$('#runIdeas').onclick = async () => {
  const p = profile();
  $('#ideasError').innerHTML = '';
  if (!String(p.niche || '').trim()) { $('#ideasError').innerHTML = '<div class="error-box"><strong>Add your niche first.</strong>Lorekeeper needs to know what to research. <a href="#brand" data-go="brand">Open Brand</a> or use a sample creator.</div>'; return; }
  const btn = $('#runIdeas'); btn.disabled = true; btn.textContent = 'Researching…';
  ideasTrail.start();
  const focus = $('#focus').value.trim();
  const planned = store.get('plan', []).map((x) => x.title);
  try {
    const data = await stream('/api/ideas', { profile: p, focus, count: ideaCount, planned }, (ev) => ideasTrail.event(ev));
    const run = { id: uid(), at: new Date().toISOString(), focus, data };
    store.set('runs', [run, ...store.get('runs', [])].slice(0, 8));
    ideasTrail.stop();
    renderRun(run);
    toast(data.meta?.truncated ? `${data.ideas.length} ideas ready (the answer was cut off; finished ideas kept)` : `${data.ideas.length} ideas ready`);
  } catch (err) {
    ideasTrail.stop();
    $('#ideasError').innerHTML = `<div class="error-box"><strong>The research did not finish.</strong>${esc(err.message)}</div>`;
  } finally { btn.disabled = false; btn.textContent = 'Research and pitch ideas'; }
};

/* ---------- Remix ---------- */
function renderRemix(run) {
  const d = run.data; const s = d.structure || {}; const o = d.original_idea || {}; const r = d.similarity_risk || {};
  const lvl = String(r.level || '').toLowerCase();
  const idea = { ...o, claims: d.claims, attribution: d.attribution, pillar: 'Remix', format: s.format };
  const key = `remix-${run.id}`;
  $('#remixOut').innerHTML = `
    <div class="remix-grid">
      <div class="panel panel-pad"><h3 style="font-size:var(--t-lg);margin-bottom:12px">Structure you can borrow</h3>
        <dl class="kv"><dt>Hook pattern</dt><dd>${esc(s.hook_pattern)}</dd><dt>Format</dt><dd>${esc(s.format)}</dd><dt>Pacing</dt><dd>${esc(s.pacing)}</dd><dt>Framing device</dt><dd>${esc(s.framing_device)}</dd><dt>Why it works</dt><dd>${esc(s.why_it_works)}</dd></dl></div>
      <div class="panel panel-pad"><h3 style="font-size:var(--t-lg);margin-bottom:6px">Belongs to ${esc(d.reference?.creator || 'the creator')}</h3><p class="subtle">Leave these out of your version.</p><ul class="dont" style="padding-left:18px;margin:8px 0 0">${(d.do_not_copy || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
    </div>
    <div class="ideas">
      <article class="idea" data-key="${esc(key)}" data-open="true">
        <button class="idea-top" aria-expanded="true">
          <div class="idea-meta"><span class="tag pillar">Your original idea</span><span class="badge ${lvl === 'low' ? 'ok' : lvl === 'high' ? 'bad' : 'warn'}">${esc(r.level || 'unknown')} similarity</span></div>
          <div class="idea-title">${esc(o.title)}</div>
          <div class="idea-hook">“${esc(o.hook)}”</div>
          <div class="idea-checks">${claimSummary(d.claims)}<span class="expand-hint">Details ${ICON.chevron}</span></div>
        </button>
        <div class="idea-body">
          <div class="idea-section"><h4>Angle</h4><div>${esc(o.angle)}</div></div>
          <div class="idea-section"><h4>Outline</h4><ol>${(o.outline || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ol></div>
          <div class="idea-section"><h4>How it differs</h4><div>${esc(o.how_it_differs)}</div></div>
          <div class="idea-section"><h4>Similarity check</h4><div>${esc(r.reason)}</div></div>
          <div class="idea-section"><h4>Credit line</h4><div class="credit">${esc(d.attribution)}</div></div>
          <div class="idea-section"><h4>Claims and sources</h4><div>${claimsHtml(d.claims)}</div></div>
        </div>
        <div class="idea-actions">${actionsHtml(key)}</div>
      </article>
    </div>`;
  const el = $('#remixOut .idea'); wireIdea(el, idea, 'remix'); refreshIdea(el);
}
$('#runRemix').onclick = async () => {
  const reference = { creator: $('#refCreator').value, link: $('#refLink').value, description: $('#refDesc').value, liked: $('#refLiked').value };
  $('#remixError').innerHTML = '';
  if (!reference.description.trim()) { $('#remixError').innerHTML = '<div class="error-box"><strong>Describe the post first.</strong>Lorekeeper does not watch videos or scrape accounts, so it only knows what you write about the post.</div>'; return; }
  const btn = $('#runRemix'); btn.disabled = true; btn.textContent = 'Breaking it down…';
  remixTrail.start();
  try {
    const data = await stream('/api/remix', { profile: profile(), reference }, (ev) => remixTrail.event(ev));
    const run = { id: uid(), at: new Date().toISOString(), data, reference };
    store.set('remixes', [run, ...store.get('remixes', [])].slice(0, 8));
    remixTrail.stop(); renderRemix(run);
  } catch (err) {
    remixTrail.stop();
    $('#remixError').innerHTML = `<div class="error-box"><strong>The remix did not finish.</strong>${esc(err.message)}</div>`;
  } finally { btn.disabled = false; btn.textContent = 'Break it down and remix'; }
};

/* ---------- Content plan board ---------- */
const STAGES = ['Shortlisted', 'Scripting', 'Filmed', 'Posted'];
function updatePlanCount() { $('#navPlanCount').textContent = store.get('plan', []).filter((x) => x.stage !== 'Posted').length; }
function savePlanItem(id, patch) { const plan = store.get('plan', []); const it = plan.find((x) => x.id === id); if (it) Object.assign(it, patch); store.set('plan', plan); return plan; }
function renderBoard() {
  const plan = store.get('plan', []);
  if (!plan.length) {
    $('#board').innerHTML = `<div class="panel empty" style="grid-column:1/-1"><h3>Your plan is empty</h3><p>Keep an idea from Research or Remix and it appears here, ready to script.</p><button class="btn" data-go="research">Research ideas</button></div>`;
    return;
  }
  $('#board').innerHTML = STAGES.map((stage, si) => {
    const items = plan.filter((x) => x.stage === stage).sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
    return `<div class="column" data-stage="${stage}"><div class="column-head"><h3>${stage}</h3><span class="n">${items.length}</span></div>
      ${items.length ? items.map((it) => `<div class="plan-card" draggable="true" data-id="${it.id}">
        <h4>${esc(it.title)}</h4>${it.hook ? `<div class="hook">“${esc(it.hook)}”</div>` : ''}
        <div class="meta">${it.pillar ? `<span class="tag pillar">${esc(it.pillar)}</span>` : ''}${it.effort ? `<span class="tag">${esc(it.effort)} effort</span>` : ''}${claimSummary(it.claims)}</div>
        <details><summary>Outline, sources and notes</summary>
          ${it.outline?.length ? `<ol style="padding-left:18px;margin:8px 0">${it.outline.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}
          <div style="margin:8px 0">${claimsHtml(it.claims)}</div>
          ${it.attribution ? `<p class="subtle">Credit: ${esc(it.attribution)}</p>` : ''}
          <textarea data-notes placeholder="Script notes">${esc(it.notes)}</textarea>
        </details>
        <button class="btn secondary sm script-btn" data-script>${it.script ? `Open script (${wordCount(it.script)} words)` : 'Write script'}</button>
        <div class="card-foot">
          <input type="date" value="${esc(it.date)}" data-date aria-label="Planned date" />
          <span class="spacer"></span>
          <button class="icon-btn" data-move="-1" ${si === 0 ? 'disabled' : ''} aria-label="Move back">${ICON.left}</button>
          <button class="icon-btn" data-move="1" ${si === STAGES.length - 1 ? 'disabled' : ''} aria-label="Move forward">${ICON.right}</button>
          <button class="icon-btn" data-remove aria-label="Remove from plan">${ICON.trash}</button>
        </div></div>`).join('') : '<div class="column-empty">Drag ideas here</div>'}
    </div>`;
  }).join('');
}
const board = $('#board');
board.addEventListener('click', (e) => {
  const card = e.target.closest('.plan-card'); if (!card) return;
  const id = card.dataset.id;
  const mv = e.target.closest('[data-move]');
  if (mv) { const it = store.get('plan', []).find((x) => x.id === id); const ni = STAGES.indexOf(it.stage) + +mv.dataset.move; savePlanItem(id, { stage: STAGES[ni] }); renderBoard(); updatePlanCount(); toast(`Moved to ${STAGES[ni]}`); }
  if (e.target.closest('[data-script]')) { openScript(id); return; }
  if (e.target.closest('[data-remove]')) { store.set('plan', store.get('plan', []).filter((x) => x.id !== id)); renderBoard(); updatePlanCount(); toast('Removed from plan. The decision stays in your log.'); }
});
board.addEventListener('change', (e) => { const card = e.target.closest('.plan-card'); if (card && e.target.matches('[data-date]')) { savePlanItem(card.dataset.id, { date: e.target.value }); renderBoard(); } });
board.addEventListener('input', (e) => { const card = e.target.closest('.plan-card'); if (card && e.target.matches('[data-notes]')) savePlanItem(card.dataset.id, { notes: e.target.value }); });
board.addEventListener('dragstart', (e) => { const c = e.target.closest('.plan-card'); if (!c) return; e.dataTransfer.setData('text/plain', c.dataset.id); c.classList.add('dragging'); });
board.addEventListener('dragend', (e) => e.target.closest('.plan-card')?.classList.remove('dragging'));
board.addEventListener('dragover', (e) => { const col = e.target.closest('.column'); if (col) { e.preventDefault(); $$('.column', board).forEach((c) => c.classList.toggle('drop', c === col)); } });
board.addEventListener('dragleave', (e) => { if (!board.contains(e.relatedTarget)) $$('.column', board).forEach((c) => c.classList.remove('drop')); });
board.addEventListener('drop', (e) => { const col = e.target.closest('.column'); if (!col) return; e.preventDefault(); savePlanItem(e.dataTransfer.getData('text/plain'), { stage: col.dataset.stage }); renderBoard(); updatePlanCount(); });
$('#exportPlan').onclick = () => download('lorekeeper-content-plan.csv', [['stage', 'planned date', 'title', 'hook', 'pillar', 'outline', 'sources', 'credit', 'notes'],
  ...store.get('plan', []).map((x) => [x.stage, x.date, x.title, x.hook, x.pillar, (x.outline || []).join(' | '), (x.claims || []).map((c) => c.source_url || 'no source').join(' | '), x.attribution, x.notes])]);


/* ---------- Scripts ---------- */
const WPS = 2.5; // average speaking pace: about 150 words a minute
const LEN_RANGE = { '30-45': [30, 45], '45-60': [45, 60], '60-90': [60, 90] };
let currentScriptId = null;
let scriptMode = 'draft';
let scriptStyle = 'voice';

function planItem(id) { return store.get('plan', []).find((x) => x.id === id); }
function openScript(id) {
  currentScriptId = id;
  const it = planItem(id);
  if (it && it.stage === 'Shortlisted') { savePlanItem(id, { stage: 'Scripting' }); updatePlanCount(); }
  go('script');
}
function renderScriptView() {
  const it = currentScriptId && planItem(currentScriptId);
  $('#scriptStudio').hidden = !it;
  $('#scriptPicker').hidden = !!it;
  if (!it) return renderScriptPicker();
  $('#scriptLead').textContent = it.title;
  const st = it.scriptSettings || {};
  scriptMode = st.mode || 'draft'; scriptStyle = st.style || 'voice';
  $('#lengthPick').value = st.length || '45-60';
  $('#styleCreator').value = st.creator || ''; $('#styleDesc').value = st.creatorDesc || '';
  $('#scriptText').value = it.script || '';
  $('#coachOut').innerHTML = it.coach ? coachHtml(it.coach) : '';
  $('#scriptError').innerHTML = '';
  syncScriptControls(); renderIdeaPanel(it); renderChecks(); renderVersions();
}
function renderScriptPicker() {
  $('#scriptLead').textContent = 'Turn an idea from your plan into a script. Let Lorekeeper draft it for you to refine, or write it yourself and get coached.';
  const plan = store.get('plan', []);
  if (!plan.length) { $('#scriptPicker').innerHTML = '<div class="panel empty"><h3>No ideas to script yet</h3><p>Keep an idea from Research or Remix, then write its script here.</p><button class="btn" data-go="research">Research ideas</button></div>'; return; }
  const sorted = [...plan].sort((a, b) => (b.script ? 1 : 0) - (a.script ? 1 : 0));
  $('#scriptPicker').innerHTML = `<div class="script-list">${sorted.map((it) => `<button class="script-card" data-open="${it.id}">
    <div class="idea-meta"><span class="tag ${it.script ? 'pillar' : ''}">${it.script ? `Script, ${wordCount(it.script)} words` : 'No script yet'}</span><span class="tag">${esc(it.stage)}</span></div>
    <h3>${esc(it.title)}</h3><p>${esc(it.script ? it.script.split('\n')[0] : it.hook)}</p></button>`).join('')}</div>`;
  $$('#scriptPicker [data-open]').forEach((b) => b.addEventListener('click', () => openScript(b.dataset.open)));
}
$('#scriptBack').onclick = () => { currentScriptId = null; renderScriptView(); };

function syncScriptControls() {
  $$('#modePicker button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.mode === scriptMode));
  $$('#stylePicker button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.style === scriptStyle));
  $('#creatorFields').hidden = scriptStyle !== 'creator';
  $('#draftActions').hidden = scriptMode !== 'draft';
  $('#coachActions').hidden = scriptMode !== 'coach';
  const has = $('#scriptText').value.trim().length > 0;
  $('#genDraft').textContent = has ? 'Write a fresh draft' : 'Write first draft';
  $('#refineBox').style.display = has ? '' : 'none';
  $('#modeHint').textContent = scriptMode === 'draft'
    ? 'Lorekeeper writes a first draft using only this idea’s checked sources. Edit it directly, or use the refine buttons.'
    : 'You write every word. Lorekeeper reads your draft and tells you what to fix, without rewriting it.';
  $('#scriptText').placeholder = scriptMode === 'draft' ? 'Your draft appears here. You can edit it directly at any time.' : 'Write your script here. When you have a draft, ask for feedback.';
}
function saveSettings() {
  if (!currentScriptId) return;
  savePlanItem(currentScriptId, { scriptSettings: { mode: scriptMode, style: scriptStyle, length: $('#lengthPick').value, creator: $('#styleCreator').value, creatorDesc: $('#styleDesc').value } });
}
$$('#modePicker button').forEach((b) => b.addEventListener('click', () => { scriptMode = b.dataset.mode; saveSettings(); syncScriptControls(); }));
$$('#stylePicker button').forEach((b) => b.addEventListener('click', () => { scriptStyle = b.dataset.style; saveSettings(); syncScriptControls(); }));
['#lengthPick', '#styleCreator', '#styleDesc'].forEach((sel) => $(sel).addEventListener('change', () => { saveSettings(); renderChecks(); }));

// Typing autosaves; a "You edited" version is recorded once you pause.
let scriptTimer; let editTimer;
$('#scriptText').addEventListener('input', () => {
  if (!currentScriptId) return;
  $('#scriptSave').textContent = 'Saving…';
  clearTimeout(scriptTimer); clearTimeout(editTimer);
  scriptTimer = setTimeout(() => { savePlanItem(currentScriptId, { script: $('#scriptText').value }); $('#scriptSave').textContent = 'Saved'; renderChecks(); syncScriptControls(); }, 400);
  editTimer = setTimeout(() => addVersion('You', 'Your edits', $('#scriptText').value), 4000);
});
$('#scriptCopy').onclick = async () => { try { await navigator.clipboard.writeText($('#scriptText').value); toast('Script copied'); } catch { toast('Copy failed. Select the text instead.'); } };

function addVersion(who, label, text) {
  const it = planItem(currentScriptId); if (!it || !text.trim()) return;
  const versions = it.versions || [];
  if (versions[0]?.text === text) return;
  if (who === 'You' && versions[0]?.who === 'You' && Date.now() - new Date(versions[0].at) < 120000) versions.shift(); // merge rapid edits
  versions.unshift({ who, label, text, at: new Date().toISOString() });
  savePlanItem(currentScriptId, { versions: versions.slice(0, 30) });
  renderVersions();
}
function renderVersions() {
  const it = planItem(currentScriptId); const v = it?.versions || [];
  const cur = $('#scriptText').value;
  $('#scriptVersions').innerHTML = `<h3 style="font-size:var(--t-lg);margin-bottom:8px">Versions</h3>${v.length ? v.map((x, i) => `<div class="version ${x.text === cur ? 'current' : ''}">
      <div style="flex:1"><span class="who">${esc(x.who === 'You' ? 'You' : 'Lorekeeper')}</span>: ${esc(x.label)}<div class="when">${ago(x.at)}, ${wordCount(x.text)} words</div></div>
      ${x.text === cur ? '<span class="subtle">Current</span>' : `<button class="btn quiet sm" data-restore="${i}">Restore</button>`}</div>`).join('') : '<p class="subtle">Every draft, refinement and your own edits are saved here, labelled by who wrote them.</p>'}`;
  $$('#scriptVersions [data-restore]').forEach((b) => b.addEventListener('click', () => {
    const x = v[+b.dataset.restore]; $('#scriptText').value = x.text; savePlanItem(currentScriptId, { script: x.text });
    addVersion('You', `Restored “${x.label}”`, x.text); renderChecks(); syncScriptControls(); toast('Version restored');
  }));
}

function renderIdeaPanel(it) {
  $('#scriptIdea').innerHTML = `<h3 style="font-size:var(--t-lg);margin-bottom:6px">The idea</h3>
    <div class="idea-hook" style="font-size:16px;margin-top:0">“${esc(it.hook)}”</div>
    ${it.outline?.length ? `<ol style="padding-left:18px;margin:10px 0;font-size:var(--t-sm)">${it.outline.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}
    <div class="k" style="font-size:var(--t-sm);font-weight:600;color:var(--ink-3);margin:12px 0 6px">Facts you can use</div>
    <div style="font-size:var(--t-sm)">${claimsHtml(it.claims)}</div>
    ${it.attribution ? `<p class="subtle" style="margin-top:10px">Credit: ${esc(it.attribution)}</p>` : ''}`;
}

/* Instant checks, computed in the browser: no AI involved. */
function wordCount(t) { return (String(t || '').match(/[A-Za-z0-9’'-]+/g) || []).length; }
function figuresIn(t) { return [...new Set((String(t || '').match(/\b\d[\d,.]*%?|\b(?:19|20)\d{2}\b/g) || []).map((x) => x.replace(/[.,]$/, '')))]; }
function renderChecks() {
  const it = planItem(currentScriptId); if (!it) return;
  const text = $('#scriptText').value;
  const words = wordCount(text); const secs = Math.round(words / WPS);
  const [lo, hi] = LEN_RANGE[$('#lengthPick').value] || [45, 60];
  const firstLine = (text.trim().split(/\n|(?<=[.?!])\s/)[0] || '').trim();
  const hookWords = wordCount(firstLine);
  const sourceText = (it.claims || []).filter((c) => c.status === 'source-retrieved').map((c) => c.claim).join(' ') + ' ' + (it.hook || '') + ' ' + (it.outline || []).join(' ');
  const figs = figuresIn(text).filter((f) => !sourceText.includes(f) && !sourceText.includes(f.replace(/,/g, '')));
  const checks = (text.match(/\[CHECK:[^\]]*\]/gi) || []);
  const timeOk = secs >= lo && secs <= hi;
  const row = (cls, label, title, body) => `<div class="check"><span class="badge ${cls}">${label}</span><div><b>${title}</b>${body}</div></div>`;
  $('#scriptChecks').innerHTML = `<h3 style="font-size:var(--t-lg);margin-bottom:4px">Checks</h3><p class="subtle" style="margin-bottom:6px">Instant, worked out from the text. No AI.</p>
    ${!words ? '<p class="subtle">Checks appear once there is a script.</p>' : [
      row(timeOk ? 'ok' : 'warn', timeOk ? 'On target' : secs < lo ? 'Short' : 'Long', `About ${secs} seconds`, `<span class="subtle">${words} words at a normal speaking pace. Target ${lo}–${hi}s.</span>`),
      row(hookWords <= 15 ? 'ok' : 'warn', hookWords <= 15 ? 'Tight' : 'Long', `Hook: ${hookWords} words`, `<span class="subtle">${hookWords <= 15 ? 'Short enough to land in the first two seconds.' : 'Aim for 15 words or fewer so it lands before people scroll.'}</span>`),
      row(figs.length ? 'bad' : 'ok', figs.length ? 'Check' : 'Clear', figs.length ? `${figs.length} ${figs.length === 1 ? 'figure' : 'figures'} not in your sources` : 'Figures match your sources', figs.length ? `<span class="subtle">${figs.map(esc).join(', ')}. Confirm each one before you film, or cut it.</span>` : '<span class="subtle">Every number and year in the script appears in the idea’s checked claims.</span>'),
      checks.length ? row('warn', 'To do', `${checks.length} ${checks.length === 1 ? 'fact' : 'facts'} marked to verify`, `<span class="subtle">${checks.map(esc).join(' ')}</span>`) : '',
    ].join('')}`;
}

async function scriptCall(body, btn, busy) {
  $('#scriptError').innerHTML = '';
  const it = planItem(currentScriptId);
  const label = btn.textContent; btn.disabled = true; btn.textContent = busy;
  try {
    const res = await fetch('/api/script', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
      ...body, profile: profile(), length: $('#lengthPick').value,
      style: scriptStyle === 'creator' ? { type: 'creator', creator: $('#styleCreator').value, description: $('#styleDesc').value } : { type: 'voice' },
      idea: { title: it.title, hook: it.hook, angle: it.angle, outline: it.outline, claims: it.claims },
    }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) throw new Error(data.error || `The server returned an error (${res.status}).`);
    return data;
  } catch (err) {
    $('#scriptError').innerHTML = `<div class="error-box"><strong>That did not finish.</strong>${esc(err.message)}</div>`;
    return null;
  } finally { btn.disabled = false; btn.textContent = label; }
}
function applyScript(text, who, label) {
  $('#scriptText').value = text; savePlanItem(currentScriptId, { script: text });
  addVersion(who, label, text); renderChecks(); syncScriptControls();
}
$('#genDraft').onclick = async () => {
  if (scriptStyle === 'creator' && !$('#styleDesc').value.trim()) { $('#scriptError').innerHTML = '<div class="error-box"><strong>Describe the creator’s style first.</strong>Lorekeeper does not watch their videos, so it only knows what you write about how they structure them.</div>'; return; }
  const cur = $('#scriptText').value; if (cur.trim()) addVersion('You', 'Before new draft', cur);
  const d = await scriptCall({ mode: 'draft' }, $('#genDraft'), 'Writing…');
  if (!d) return;
  const credit = d.style_credit ? `\n\n[Credit: ${d.style_credit}]` : '';
  applyScript(d.script + credit, 'Lorekeeper', scriptStyle === 'creator' ? `First draft, inspired by ${$('#styleCreator').value || 'a creator'}` : 'First draft in your voice');
  if (d.notes?.length) $('#coachOut').innerHTML = `<div class="panel panel-pad"><h3 style="font-size:var(--t-lg);margin-bottom:8px">Notes on this draft</h3><ul style="margin:0;padding-left:18px" class="muted">${d.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></div>`;
  toast('Draft ready. Edit it directly or refine it.');
};
async function refine(instruction, label) {
  const cur = $('#scriptText').value; addVersion('You', 'Before refining', cur);
  const btn = $('#refineGo');
  const d = await scriptCall({ mode: 'refine', script: cur, instruction }, btn, 'Refining…');
  if (!d) return;
  applyScript(d.script, 'Lorekeeper', label);
  $('#coachOut').innerHTML = `<div class="panel panel-pad"><h3 style="font-size:var(--t-lg);margin-bottom:6px">What changed</h3><p class="muted">${esc(d.change_summary)}</p></div>`;
  toast('Refined. Restore the earlier version any time.');
}
$$('#refineBox [data-refine]').forEach((b) => b.addEventListener('click', () => refine(b.dataset.refine, b.textContent)));
$('#refineGo').onclick = () => { const v = $('#refineCustom').value.trim(); if (!v) { $('#refineCustom').focus(); return; } refine(v, `“${v.slice(0, 40)}”`); $('#refineCustom').value = ''; };
$('#refineCustom').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#refineGo').click(); });

function coachHtml(c) {
  return `<div class="panel panel-pad"><div class="panel-head"><h3 style="font-size:var(--t-lg)">Coaching notes</h3><span class="subtle">${c.at ? ago(c.at) : ''}</span></div>
    <p>${esc(c.overall)}</p>
    ${c.hook ? `<p style="margin-top:10px"><b>Hook.</b> ${esc(c.hook)}</p>` : ''}
    ${c.strengths?.length ? `<div style="margin-top:12px">${c.strengths.map((x) => `<div class="claim" style="margin-top:6px"><span class="badge ok">Works</span><span>${esc(x)}</span></div>`).join('')}</div>` : ''}
    ${c.unsupported_claims?.length ? `<div style="margin-top:12px">${c.unsupported_claims.map((x) => `<div class="claim" style="margin-top:6px"><span class="badge bad">Unsupported</span><span><q>${esc(x.line)}</q> ${esc(x.problem)}</span></div>`).join('')}</div>` : ''}
    ${c.lines?.length ? `<div style="margin-top:14px">${c.lines.map((x) => `<div class="coach-line"><q>${esc(x.line)}</q><div class="muted" style="margin-top:4px">${esc(x.issue)}</div><div style="margin-top:4px"><b>Try:</b> ${esc(x.direction)}</div></div>`).join('')}</div>` : ''}</div>`;
}
$('#getCoach').onclick = async () => {
  const cur = $('#scriptText').value;
  if (!cur.trim()) { $('#scriptError').innerHTML = '<div class="error-box"><strong>Write some of your script first.</strong>In Coach mode you write; Lorekeeper reads it and gives feedback.</div>'; return; }
  addVersion('You', 'Sent for coaching', cur);
  const d = await scriptCall({ mode: 'coach', script: cur }, $('#getCoach'), 'Reading your draft…');
  if (!d) return;
  const coach = { ...d, at: new Date().toISOString() }; delete coach.meta;
  savePlanItem(currentScriptId, { coach });
  $('#coachOut').innerHTML = coachHtml(coach);
  toast('Feedback ready');
};

/* ---------- Decision log ---------- */
let logFilter = 'all';
$$('#logFilter button').forEach((b) => b.addEventListener('click', () => { logFilter = b.dataset.f; $$('#logFilter button').forEach((x) => x.setAttribute('aria-pressed', x === b)); renderLog(); }));
function renderLog() {
  const log = store.get('log', []);
  if (!log.length) { $('#logOut').innerHTML = '<div class="empty" style="padding:8px 0"><h3>No decisions yet</h3><p>Keep or reject ideas and each choice is recorded here with your reason.</p></div>'; return; }
  const keys = [...new Set(log.map((x) => x.key))];
  const now = keys.map((k) => latestFor(k, log).decision);
  const kept = now.filter((d) => d === 'keep').length, rejected = now.filter((d) => d === 'reject').length, open = now.filter((d) => d === 'restored').length;
  const shown = log.filter((x) => logFilter === 'all' || x.decision === logFilter).slice().reverse();
  const BADGES = { keep: '<span class="badge ok">Kept</span>', reject: '<span class="badge bad">Rejected</span>', restored: '<span class="badge warn">Brought back</span>' };
  const action = (x) => {
    if (latestFor(x.key, log) !== x) return '';
    if (x.decision === 'reject') return `<button class="btn secondary sm" data-restore="${esc(x.key)}">Bring back</button>`;
    if (x.decision === 'restored' && findIdea(x.key)) return `<button class="btn sm" data-keep="${esc(x.key)}">Keep</button>`;
    return '';
  };
  $('#logOut').innerHTML = `<p class="muted" style="margin-bottom:12px">${kept} kept, ${rejected} rejected${open ? ` and ${open} brought back for another look` : ''}, from ${keys.length} ${keys.length === 1 ? 'idea' : 'ideas'} reviewed.</p>
    <table class="log-table"><thead><tr><th>When</th><th>Idea</th><th>From</th><th>Decision</th><th>Your reason</th><th></th></tr></thead><tbody>
    ${shown.map((x) => `<tr><td>${esc(new Date(x.at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }))}</td><td>${esc(x.title)}</td><td>${x.kind === 'remix' ? 'Remix' : 'Research'}</td><td>${BADGES[x.decision] || ''}</td><td>${x.decision === 'restored' ? '<span class="subtle">Undecided again</span>' : esc(x.reason) || '<span class="subtle">No reason given</span>'}</td><td style="text-align:right">${action(x)}</td></tr>`).join('')}</tbody></table>`;
}
$('#logOut').addEventListener('click', (e) => {
  const r = e.target.closest('[data-restore]');
  if (r) { restoreIdea(r.dataset.restore); renderLog(); refreshAllIdeas(); return; }
  const k = e.target.closest('[data-keep]');
  if (k) { const f = findIdea(k.dataset.keep); if (f) { decide(k.dataset.keep, f.idea, 'keep', '', f.kind); renderLog(); refreshAllIdeas(); } }
});
function refreshAllIdeas() { $$('.idea[data-key]').forEach(refreshIdea); }
$('#exportLog').onclick = () => download('lorekeeper-decisions.csv', [['when', 'idea', 'from', 'decision', 'reason'], ...store.get('log', []).map((x) => [x.at, x.title, x.kind, x.decision, x.reason])]);
$('#clearLog').onclick = () => { if (!confirmInline('#clearLog', 'Click again to clear')) return; store.set('log', []); renderLog(); toast('Decision log cleared'); };

/* ---------- Boot ---------- */
writeProfile(profile());
updateCompleteness();
updatePlanCount();
const lastRun = store.get('runs', [])[0];
if (lastRun) { renderRun(lastRun); ideasTrail.restore(lastRun.data.research); } else ideasTrail.empty();
const lastRemix = store.get('remixes', [])[0];
if (lastRemix) { renderRemix(lastRemix); remixTrail.restore(lastRemix.data.research); Object.entries({ refCreator: 'creator', refLink: 'link', refDesc: 'description', refLiked: 'liked' }).forEach(([id, k]) => ($('#' + id).value = lastRemix.reference?.[k] || '')); } else remixTrail.empty();
go(location.hash.slice(1) || 'home', false);
