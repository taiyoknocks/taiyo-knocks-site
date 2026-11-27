import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../netlify/lib/blog-core.mjs';

// @netlify/blobs と同じ形の、メモリ上の簡易ストア
function memoryStore() {
  const m = new Map();
  let v = 0;
  return {
    _map: m,
    async get(key, opts = {}) {
      const e = m.get(key);
      if (!e) return null;
      return opts.type === 'json' ? JSON.parse(e.data) : e.data;
    },
    async getWithMetadata(key, opts = {}) {
      const e = m.get(key);
      if (!e) return null;
      const data = opts.type === 'json' ? JSON.parse(e.data) : e.data;
      return { data, etag: e.etag, metadata: e.metadata || {} };
    },
    async set(key, data, opts = {}) {
      return this._write(key, data, opts);
    },
    async setJSON(key, data, opts = {}) {
      return this._write(key, JSON.stringify(data), opts);
    },
    _write(key, data, opts) {
      const cur = m.get(key);
      if (opts.onlyIfNew && cur) return { modified: false };
      if (opts.onlyIfMatch && (!cur || cur.etag !== opts.onlyIfMatch)) return { modified: false };
      const etag = `e${++v}`;
      m.set(key, { data, etag, metadata: opts.metadata });
      return { modified: true, etag };
    },
    async delete(key) {
      m.delete(key);
    },
  };
}

const env = { BLOG_PASSCODE: 'taiyo', BLOG_ADMIN_PASSCODE: 'kantoku' };
const JPEG = 'data:image/jpeg;base64,' + Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]).toString('base64');
const req = (method, path, body) =>
  new Request('https://example.test/api/blog/' + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

test('合言葉の確認', async () => {
  const store = memoryStore();
  assert.equal((await handle(req('POST', 'check', { passcode: 'taiyo' }), { store, env })).status, 200);
  assert.equal((await handle(req('POST', 'check', { passcode: 'x' }), { store, env })).status, 401);
  assert.equal((await handle(req('POST', 'check', { passcode: 'taiyo' }), { store, env: {} })).status, 503);
});

test('投稿 → 一覧と記事と画像が読める → 本人の鍵で削除', async () => {
  const store = memoryStore();
  const body = {
    passcode: 'taiyo',
    author: 43,
    title: '今日のごはん',
    blocks: [
      { type: 'text', text: '今日こんなの食べてきました！' },
      { type: 'image', data: JPEG },
      { type: 'text', text: '\nとてもおいしかった！' },
      { type: 'image', data: JPEG },
      { type: 'text', text: 'またいきたいね〜\n\n監督' },
    ],
  };
  const r = await handle(req('POST', 'create', body), { store, env, now: () => new Date('2026-11-28T03:00:00Z') });
  assert.equal(r.status, 200);
  const { id, deleteKey } = await r.json();
  assert.match(id, /^20261128-120000-[0-9a-f]{4}$/);

  const list = await (await handle(req('GET', 'posts'), { store, env })).json();
  assert.equal(list.posts.length, 1);
  assert.equal(list.posts[0].author.name, 'しみ');
  assert.equal(list.posts[0].thumb, `/api/blog/img/${id}/1`);

  const one = await (await handle(req('GET', 'post?id=' + id), { store, env })).json();
  assert.deepEqual(one.post.blocks.map((b) => b.type), ['text', 'image', 'text', 'image', 'text']);
  assert.equal(one.post.deleteHash, undefined, '削除用のハッシュは外に出さない');

  const img = await handle(req('GET', `img/${id}/2`), { store, env });
  assert.equal(img.status, 200);
  assert.equal(img.headers.get('Content-Type'), 'image/jpeg');

  assert.equal((await handle(req('POST', 'delete', { id, deleteKey: 'wrong' }), { store, env })).status, 403);
  assert.equal((await handle(req('POST', 'delete', { id, deleteKey }), { store, env })).status, 200);
  assert.equal((await (await handle(req('GET', 'posts'), { store, env })).json()).posts.length, 0);
  assert.equal(store._map.has(`img/${id}/1`), false);
});

test('管理用の合言葉で削除できる', async () => {
  const store = memoryStore();
  const r = await handle(req('POST', 'create', { passcode: 'taiyo', author: 11, title: 't', blocks: [{ type: 'text', text: 'a' }] }), { store, env });
  const { id } = await r.json();
  assert.equal((await handle(req('POST', 'delete', { id, adminPasscode: 'kantoku' }), { store, env })).status, 200);
});

test('おかしな投稿は弾く', async () => {
  const store = memoryStore();
  const base = { passcode: 'taiyo', author: 43, title: 't', blocks: [{ type: 'text', text: 'a' }] };
  assert.equal((await handle(req('POST', 'create', { ...base, passcode: 'x' }), { store, env })).status, 401);
  assert.equal((await handle(req('POST', 'create', { ...base, author: 999 }), { store, env })).status, 400);
  assert.equal((await handle(req('POST', 'create', { ...base, title: '' }), { store, env })).status, 400);
  assert.equal((await handle(req('POST', 'create', { ...base, blocks: [{ type: 'image', data: 'data:image/jpeg;base64,AAAA' }] }), { store, env })).status, 400);
  assert.equal((await handle(req('POST', 'create', { ...base, blocks: [{ type: 'text', text: '   ' }] }), { store, env })).status, 400);
  assert.equal((await handle(req('GET', 'post?id=../../x'), { store, env })).status, 404);
});

test('同時に2件投稿しても一覧から消えない', async () => {
  const store = memoryStore();
  const mk = (t) => handle(req('POST', 'create', { passcode: 'taiyo', author: 1, title: t, blocks: [{ type: 'text', text: t }] }), { store, env });
  await Promise.all([mk('a'), mk('b'), mk('c')]);
  const list = await (await handle(req('GET', 'posts'), { store, env })).json();
  assert.equal(list.posts.length, 3);
});
