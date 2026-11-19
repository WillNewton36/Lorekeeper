// Local preview: serves the app and runs the real API code against the fake streaming Claude API.
// Usage: node dev/server.mjs  then open http://localhost:4321
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeMockFetch } from './mock-anthropic.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.env.ANTHROPIC_API_KEY = 'mock';
globalThis.fetch = makeMockFetch({ delay: Number(process.env.MOCK_DELAY ?? 350) });
const handlers = {
  '/api/ideas': (await import('../api/ideas.js')).default,
  '/api/remix': (await import('../api/remix.js')).default,
  '/api/health': (await import('../api/health.js')).default,
};
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' };

http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];
  if (handlers[url]) { req.headers['x-forwarded-for'] ||= 'local'; return handlers[url](req, res); }
  const file = path.join(root, url === '/' ? 'index.html' : url);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.statusCode = 404; return res.end('Not found'); }
  res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
}).listen(4321, () => console.log('Lorekeeper preview on http://localhost:4321'));
