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

test('日本語の合言葉：全角・半角や前後の空白の違いは通す', async () => {
  const store = memoryStore();
  const jp = { BLOG_PASSCODE: '太陽ノックス2026', BLOG_ADMIN_PASSCODE: 'カントク' };
  const check = async (path, body) => (await handle(req('POST', path, body), { store, env: jp })).status;
  assert.equal(await check('check', { passcode: '太陽ノックス2026' }), 200);
  assert.equal(await check('check', { passcode: ' 太陽ノックス２０２６　' }), 200);
  assert.equal(await check('check', { passcode: '太陽ﾉｯｸｽ2026' }), 200);
  assert.equal(await check('check', { passcode: '太陽ノック2026' }), 401);
  assert.equal(await check('check', { passcode: '' }), 401);
  assert.equal(await check('admin-check', { adminPasscode: 'ｶﾝﾄｸ' }), 200);
  assert.equal(await check('admin-check', { adminPasscode: 'かんとく' }), 401);
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

test('編集：写真を残す・外す・足す、日時はそのまま、古い写真は消える', async () => {
  const store = memoryStore();
  const PNG = 'data:image/png;base64,' + Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9]).toString('base64');
  const created = await handle(
    req('POST', 'create', { passcode: 'taiyo', author: 43, title: '元のタイトル', blocks: [{ type: 'text', text: '最初' }, { type: 'image', data: JPEG }, { type: 'text', text: '真ん中' }, { type: 'image', data: JPEG }] }),
    { store, env, now: () => new Date('2026-11-28T03:00:00Z') }
  );
  const { id, deleteKey } = await created.json();
  const upd = (body, extra = {}) => handle(req('POST', 'update', { id, ...body }), { store, env, now: () => new Date('2026-11-29T03:00:00Z'), ...extra });

  // 1枚目を外して、2枚目を先頭へ、新しい写真を最後に足す
  const r = await upd({ deleteKey, title: '直したタイトル', blocks: [{ type: 'image', keep: 2 }, { type: 'text', text: '書き直した' }, { type: 'image', data: PNG }] });
  assert.equal(r.status, 200);
  const one = (await (await handle(req('GET', 'post?id=' + id), { store, env })).json()).post;
  assert.equal(one.title, '直したタイトル');
  assert.equal(one.date, '2026-11-28T03:00:00.000Z', '投稿日時は変わらない');
  assert.deepEqual(one.blocks.map((b) => b.src || b.text), [`/api/blog/img/${id}/2`, '書き直した', `/api/blog/img/${id}/3`]);
  assert.equal(store._map.has(`img/${id}/1`), false, '外した写真は消える');
  assert.equal(store._map.get(`img/${id}/3`).metadata.contentType, 'image/png');
  const list = (await (await handle(req('GET', 'posts'), { store, env })).json()).posts;
  assert.equal(list[0].title, '直したタイトル');
  assert.equal(list[0].thumb, `/api/blog/img/${id}/2`);
  assert.equal(list[0].date, '2026-11-28T03:00:00.000Z');

  // 権限・おかしな送信
  assert.equal((await upd({ deleteKey: 'wrong', title: 'x', blocks: [{ type: 'text', text: 'x' }] })).status, 403);
  assert.equal((await upd({ deleteKey, title: 'x', blocks: [{ type: 'image', keep: 1 }] })).status, 400, 'もう無い写真は残せない');
  assert.equal((await upd({ deleteKey, title: '', blocks: [{ type: 'text', text: 'x' }] })).status, 400);
  assert.equal((await handle(req('POST', 'create', { passcode: 'taiyo', author: 43, title: 't', blocks: [{ type: 'image', keep: 2 }] }), { store, env })).status, 400, '新規投稿で keep は使えない');
  assert.equal((await handle(req('POST', 'update', { id: '20260101-000000-abcd', deleteKey, title: 'x', blocks: [{ type: 'text', text: 'x' }] }), { store, env })).status, 404);

  // 管理用の合言葉でも編集でき、削除すると全部の写真が消える
  assert.equal((await upd({ adminPasscode: 'kantoku', title: '管理者が直した', blocks: [{ type: 'text', text: 'ok' }] })).status, 200);
  assert.equal(store._map.has(`img/${id}/2`), false);
  assert.equal((await handle(req('POST', 'delete', { id, deleteKey }), { store, env })).status, 200);
  assert.equal([...store._map.keys()].filter((k) => k.startsWith('img/')).length, 0);
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

// ---- コメント ----
async function makePost(store) {
  const r = await handle(req('POST', 'create', { passcode: 'taiyo', author: 43, title: 'テスト', blocks: [{ type: 'text', text: '本文' }] }), { store, env });
  return (await r.json()).id;
}
const at = (iso) => () => new Date(iso);
const comment = (store, body, { ip = '1.1.1.1', now = at('2026-11-28T03:00:00Z') } = {}) =>
  handle(req('POST', 'comment', body), { store, env, ip, now });
const listComments = async (store, id) => (await (await handle(req('GET', 'comments?id=' + id), { store, env })).json()).comments;

test('コメント：書く→古い順に番号つきで出る（送り主の符号は外に出さない）', async () => {
  const store = memoryStore();
  const id = await makePost(store);
  assert.deepEqual(await listComments(store, id), []);
  let r = await comment(store, { id, name: ' やすくん　福岡 ', text: 'ナイスバッティング！\r\n次も期待してます⚾️' });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).no, 1);
  r = await comment(store, { id, name: 'SOMA☆', text: '応援してます' }, { ip: '2.2.2.2', now: at('2026-11-28T03:00:05Z') });
  assert.equal((await r.json()).no, 2);
  const list = await listComments(store, id);
  assert.equal(list.length, 2);
  assert.deepEqual(list[0], { no: 1, name: 'やすくん 福岡', text: 'ナイスバッティング！\n次も期待してます⚾️', date: '2026-11-28T03:00:00.000Z' });
  assert.equal(list[1].name, 'SOMA☆');
  assert.ok(!('ip' in list[0]));
});

test('コメント：おかしなものは弾く', async () => {
  const store = memoryStore();
  const id = await makePost(store);
  assert.equal((await comment(store, { id, name: '', text: 'a' })).status, 400);
  assert.equal((await comment(store, { id, name: 'a', text: '   \n ' })).status, 400);
  assert.equal((await comment(store, { id, name: 'あ'.repeat(21), text: 'a' })).status, 400);
  assert.equal((await comment(store, { id, name: 'a', text: 'あ'.repeat(1001) })).status, 400);
  assert.equal((await comment(store, { id, name: 'a', text: '見てね https://example.com' })).status, 400);
  assert.equal((await comment(store, { id, name: 'a', text: 'ｗｗｗ．ｅｘａｍｐｌｅ．ｃｏｍ' })).status, 400);
  assert.equal((await comment(store, { id, name: 'a', text: 'a', tk_hp: 'bot' })).status, 400);
  assert.equal((await comment(store, { id: '20261128-000000-ffff', name: 'a', text: 'a' })).status, 404);
  assert.equal((await comment(store, { id: '../x', name: 'a', text: 'a' })).status, 404);
  // 「11.23の試合」のような普通の文はURL扱いしない
  assert.equal((await comment(store, { id, name: 'a', text: '11.23の試合すごかった！3ラン最高' })).status, 200);
  assert.equal((await listComments(store, id)).length, 1);
});

test('コメント：連投よけ（同じ人は30秒あける・10分で5件まで・同じ内容は2回送れない）', async () => {
  const store = memoryStore();
  const id = await makePost(store);
  const t0 = Date.parse('2026-11-28T03:00:00Z');
  const t = (s) => at(new Date(t0 + s * 1000).toISOString());
  assert.equal((await comment(store, { id, name: 'a', text: '1' }, { now: t(0) })).status, 200);
  assert.equal((await comment(store, { id, name: 'a', text: '2' }, { now: t(10) })).status, 429);
  assert.equal((await comment(store, { id, name: 'b', text: '2' }, { ip: '9.9.9.9', now: t(10) })).status, 200); // 別の人はOK
  assert.equal((await comment(store, { id, name: 'b', text: '2' }, { ip: '8.8.8.8', now: t(12) })).status, 409); // 直前と同じ内容
  for (let i = 1; i <= 4; i++) assert.equal((await comment(store, { id, name: 'a', text: 'x' + i }, { now: t(i * 31) })).status, 200);
  assert.equal((await comment(store, { id, name: 'a', text: 'x5' }, { now: t(5 * 31) })).status, 429);
  assert.equal((await comment(store, { id, name: 'a', text: 'x6' }, { now: t(11 * 60) })).status, 200);
});

test('コメント：消せるのは管理用の合言葉だけ。番号はつめない。記事を消すとコメントも消える', async () => {
  const store = memoryStore();
  const id = await makePost(store);
  await comment(store, { id, name: 'a', text: '1' }, { ip: '1.1.1.1' });
  await comment(store, { id, name: 'b', text: '2' }, { ip: '2.2.2.2' });
  assert.equal((await handle(req('POST', 'comment-delete', { id, no: 1, adminPasscode: 'x' }), { store, env })).status, 401);
  assert.equal((await handle(req('POST', 'comment-delete', { id, no: 1 }), { store, env })).status, 401);
  const all = await (await handle(req('POST', 'admin-comments', { adminPasscode: 'kantoku' }), { store, env })).json();
  assert.equal(all.comments.length, 2);
  assert.equal(all.comments[0].postTitle, 'テスト');
  assert.equal((await handle(req('POST', 'comment-delete', { id, no: 1, adminPasscode: 'kantoku' }), { store, env })).status, 200);
  let list = await listComments(store, id);
  assert.deepEqual(list.map((c) => c.no), [2]);
  const r = await comment(store, { id, name: 'c', text: '3' }, { ip: '3.3.3.3' });
  assert.equal((await r.json()).no, 3);
  const exp = await (await handle(req('POST', 'export', { adminPasscode: 'kantoku' }), { store, env })).json();
  assert.equal(exp.posts[0].comments.length, 2);
  assert.ok(!('ip' in exp.posts[0].comments[0]));
  assert.equal((await handle(req('POST', 'delete', { id, adminPasscode: 'kantoku' }), { store, env })).status, 200);
  assert.ok(!store._map.has('comments/' + id));
});

test('コメント：同時に送られても消えない', async () => {
  const store = memoryStore();
  const id = await makePost(store);
  await Promise.all(['1', '2', '3', '4'].map((n) => comment(store, { id, name: n, text: n }, { ip: n })));
  const list = await listComments(store, id);
  assert.equal(list.length, 4);
  assert.deepEqual(list.map((c) => c.no).sort(), [1, 2, 3, 4]);
});
