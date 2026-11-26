// Runs both API handlers end to end against the fake streaming Claude API.
// Usage: node dev/test-api.mjs
import assert from 'node:assert/strict';
import { makeMockFetch } from './mock-anthropic.mjs';

process.env.ANTHROPIC_API_KEY = 'test-key';
const log = [];
globalThis.fetch = makeMockFetch({ log });
const { default: ideas } = await import('../api/ideas.js');
const { default: remix } = await import('../api/remix.js');
const { normalizeUrl } = await import('../api/_lib.js');

function fakeRes() {
  const r = { statusCode: 0, headers: {}, chunks: [], setHeader(k, v) { r.headers[k] = v; }, write(c) { r.chunks.push(c); }, end(c) { if (c) r.chunks.push(c); r.ended = true; } };
  r.events = () => r.chunks.join('').trim().split('\n').map((l) => JSON.parse(l));
  return r;
}
const req = (body) => ({ method: 'POST', headers: { 'x-forwarded-for': '1.2.3.4' }, body });

// Ideas: streamed events, pause_turn continuation, source check
const r1 = fakeRes();
await ideas(req({ profile: { niche: 'philosophy' }, count: 2, planned: ['Seneca on anger'] }), r1);
const ev = r1.events();
const types = ev.map((e) => e.type);
console.log('ideas events:', types.join(' > '));
assert.equal(log.length, 2, 'pause_turn should trigger a second request');
assert.equal(log[1].messages[1].role, 'assistant');
assert.ok(!JSON.stringify(log[1].messages[1].content).includes('_json'), 'internal fields must not be sent back');
assert.ok(log[0].messages[0].content.includes('Seneca on anger'), 'planned ideas are passed to the model');
assert.equal(ev.filter((e) => e.type === 'search').length, 2);
const done = ev.find((e) => e.type === 'done').data;
assert.deepEqual(done.ideas[0].claims.map((c) => c.status), ['source-retrieved', 'source-not-retrieved', 'unsourced']);
assert.equal(done.research.sources.length, 4);
assert.equal(done.meta.usage.web_search_requests, 2);
console.log('ideas: pause_turn continued, 2 searches streamed, fake source flagged, unsourced flagged');

// Remix
const r2 = fakeRes();
await remix(req({ profile: { niche: 'philosophy' }, reference: { description: 'A contrarian reel about Nietzsche' } }), r2);
const d2 = r2.events().find((e) => e.type === 'done').data;
assert.equal(d2.claims[0].status, 'source-retrieved');
assert.equal(d2.similarity_risk.level, 'low');
console.log('remix: structure, credit line and source check returned');

// Validation errors are plain JSON, not a stream
const r3 = fakeRes();
await ideas(req({ profile: {} }), r3);
assert.equal(r3.statusCode, 400);
console.log('validation:', JSON.parse(r3.chunks.join('')).error);

// Missing key surfaces as a streamed error
delete process.env.ANTHROPIC_API_KEY;
const r4 = fakeRes();
await ideas(req({ profile: { niche: 'x' } }), r4);
assert.equal(r4.events().at(-1).type, 'error');
console.log('missing key:', r4.events().at(-1).message);

// Same paper, different link: matched by DOI; HTML-escaped search URLs still match
const { checkClaims, doiOf } = await import('../api/_lib.js');
const got = new Map([[normalizeUrl('https://scholar.google.com/scholar_lookup?title=X&amp=&author=A&amp=&doi=10.1073/pnas.1706541114&amp=&pmid=1'), { url: 'https://scholar.google.com/scholar_lookup?title=X&amp=&author=A&amp=&doi=10.1073/pnas.1706541114' }],
  [normalizeUrl('https://www.pnas.org/doi/pdf/10.1073/pnas.1706541114'), { url: 'https://www.pnas.org/doi/pdf/10.1073/pnas.1706541114' }]]);
const checked = checkClaims([
  { claim: 'a', source_url: 'https://scholar.google.com/scholar_lookup?title=X&author=Whillans&doi=10.1073/pnas.1706541114' },
  { claim: 'b', source_url: 'https://doi.org/10.1073/pnas.1706541114' },
  { claim: 'c', source_url: 'https://doi.org/10.1000/made-up-paper' },
], got);
assert.deepEqual(checked.map((c) => c.status), ['source-retrieved', 'source-retrieved', 'source-not-retrieved']);
assert.equal(doiOf('https://www.pnas.org/doi/pdf/10.1073/pnas.1706541114'), '10.1073/pnas.1706541114');
console.log('DOI matching: same paper via a different link accepted, made-up DOI still flagged');

// A cut-off answer keeps the ideas that were finished
const { salvageArray } = await import('../api/_lib.js');
const partial = '<result>{"performance_insights":[{"insight":"a","evidence":"b"}],"ideas":[{"title":"One","hook":"h {x}","claims":[]},{"title":"Two \\" q","claims":[]},{"title":"Thr';
const salv = salvageArray(partial, 'ideas');
assert.deepEqual(salv.map((x) => x.title), ['One', 'Two " q']);
assert.equal(salvageArray(partial, 'performance_insights').length, 1);
console.log('cut-off answer: 2 finished ideas recovered, the unfinished one dropped');

assert.equal(normalizeUrl('https://WWW.Example.com/a/?utm_medium=b&id=2#x'), 'example.com/a?id=2');
console.log('\nAll API tests passed.');
