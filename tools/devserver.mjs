import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
// メンバーブログを手元で試すためのサーバー（本番のデータには触らない）。使い方: node tools/devserver.mjs → http://localhost:8787
// 合言葉はテスト用の taiyo（管理用は kantoku）。データはメモリ上だけで、止めると消える。
const ROOT = new URL('../site/', import.meta.url).pathname;
const { handle } = await import('../netlify/lib/blog-core.mjs');
const m = new Map(); let v = 0;
const store = {
  async get(k, o = {}) { const e = m.get(k); if (!e) return null; return o.type === 'json' ? JSON.parse(e.data) : e.data; },
  async getWithMetadata(k, o = {}) { const e = m.get(k); if (!e) return null; return { data: o.type === 'json' ? JSON.parse(e.data) : (o.type === 'arrayBuffer' ? e.data : e.data), etag: e.etag, metadata: e.metadata || {} }; },
  async set(k, d, o = {}) { return this.w(k, d, o); }, async setJSON(k, d, o = {}) { return this.w(k, JSON.stringify(d), o); },
  w(k, d, o) { const c = m.get(k); if (o.onlyIfNew && c) return { modified: false }; if (o.onlyIfMatch && (!c || c.etag !== o.onlyIfMatch)) return { modified: false }; m.set(k, { data: d, etag: 'e' + (++v), metadata: o.metadata }); return { modified: true }; },
  async delete(k) { m.delete(k); },
};
const env = { BLOG_PASSCODE: 'taiyo', BLOG_ADMIN_PASSCODE: 'kantoku' };
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png' };
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:8787');
  if (url.pathname.startsWith('/api/blog/')) {
    const chunks = []; for await (const c of req) chunks.push(c);
    const r = await handle(new Request(url, { method: req.method, headers: req.headers, body: ['GET','HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks) }), { store, env, ip: req.headers['x-test-ip'] || req.socket.remoteAddress || '', now: req.headers['x-test-now'] ? () => new Date(req.headers['x-test-now']) : undefined });
    res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer())); return;
  }
  let p = normalize(decodeURIComponent(url.pathname)); if (p.endsWith('/')) p += 'index.html';
  try { const b = await readFile(join(ROOT, p)); res.writeHead(200, { 'Content-Type': types[extname(p)] || 'application/octet-stream' }); res.end(b); }
  catch { res.writeHead(404); res.end('nf'); }
}).listen(8787, () => console.log('listening'));
