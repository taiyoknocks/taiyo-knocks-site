// 太陽ノックス メンバーブログの中身（保存・読み出し・削除）
// Netlify Functions から呼ばれる。store は @netlify/blobs の Store か、テスト用の同じ形のもの。
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import members from '../../site/blog/members.json' with { type: 'json' };

export const LIMITS = {
  titleMax: 60,
  blockTextMax: 5000,
  totalTextMax: 20000,
  imagesMax: 20,
  imageBytesMax: 2 * 1024 * 1024,
  blocksMax: 80,
};

const INDEX_KEY = 'index';

const json = (status, body, extraHeaders = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extraHeaders },
  });

const sha256 = (s) => createHash('sha256').update(s).digest('hex');

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false;
  const ha = Buffer.from(sha256(a), 'hex');
  const hb = Buffer.from(sha256(b), 'hex');
  return timingSafeEqual(ha, hb);
}

// 合言葉の比較。全角・半角の違い（ＡとA、ｱとア）や前後の空白は同じとみなす
const normPass = (s) => String(s || '').normalize('NFKC').replace(/\s+/g, ' ').trim();
function passEqual(input, expected) {
  if (typeof expected !== 'string') return false;
  return safeEqual(normPass(input), normPass(expected));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function makeId(now) {
  // 日本時間の日付＋時刻＋ランダム4桁
  const jst = new Date(now.getTime() + 9 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  const d = `${jst.getUTCFullYear()}${p(jst.getUTCMonth() + 1)}${p(jst.getUTCDate())}`;
  const t = `${p(jst.getUTCHours())}${p(jst.getUTCMinutes())}${p(jst.getUTCSeconds())}`;
  return `${d}-${t}-${randomBytes(2).toString('hex')}`;
}

const ID_RE = /^\d{8}-\d{6}-[0-9a-f]{4}$/;

function decodeImage(dataUrl) {
  if (typeof dataUrl !== 'string') return null;
  const m = /^data:(image\/(jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return null;
  const buf = Buffer.from(m[3], 'base64');
  if (buf.length === 0 || buf.length > LIMITS.imageBytesMax) return null;
  const isJpeg = buf[0] === 0xff && buf[1] === 0xd8;
  const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  const isWebp = buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP';
  if (!(isJpeg || isPng || isWebp)) return null;
  return { buf, contentType: m[1] };
}

async function readIndex(store) {
  const res = await store.getWithMetadata(INDEX_KEY, { type: 'json', consistency: 'strong' });
  if (!res) return { list: [], etag: null };
  return { list: Array.isArray(res.data) ? res.data : [], etag: res.etag || null };
}

// 一覧（index）を安全に書き換える。同時に投稿があっても上書きし合わないよう、ETagで確認してやり直す。
async function updateIndex(store, change) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const { list, etag } = await readIndex(store);
    const next = change(list.slice());
    const opts = etag ? { onlyIfMatch: etag } : { onlyIfNew: true };
    const r = await store.setJSON(INDEX_KEY, next, opts);
    if (r && r.modified !== false) return next;
    await sleep(80 * (attempt + 1));
  }
  throw new Error('index-busy');
}

function findMember(no) {
  return members.find((m) => m.no === no) || null;
}

// keepable: 編集のときだけ渡す。その記事にもともとある写真の番号（そのまま残す写真は { type:'image', keep:番号 } で送られてくる）
function normalizeBlocks(blocks, keepable = null) {
  if (!Array.isArray(blocks) || blocks.length === 0 || blocks.length > LIMITS.blocksMax) return { error: '本文の形が正しくありません' };
  const out = [];
  let totalText = 0;
  let images = 0;
  for (const b of blocks) {
    if (!b || typeof b !== 'object') return { error: '本文の形が正しくありません' };
    if (b.type === 'text') {
      if (typeof b.text !== 'string') return { error: '本文の形が正しくありません' };
      const text = b.text.replace(/\r\n?/g, '\n');
      if (text.length > LIMITS.blockTextMax) return { error: '文章が長すぎます' };
      totalText += text.length;
      if (text.trim() === '') continue;
      out.push({ type: 'text', text });
    } else if (b.type === 'image' && b.keep !== undefined) {
      if (!keepable || !Number.isInteger(b.keep) || !keepable.has(b.keep)) return { error: '前の写真が見つかりません。ページを開き直してください' };
      images += 1;
      out.push({ type: 'image', keep: b.keep });
    } else if (b.type === 'image') {
      const img = decodeImage(b.data);
      if (!img) return { error: '写真の形式が対応していないか、大きすぎます' };
      images += 1;
      out.push({ type: 'image', img });
    } else {
      return { error: '本文の形が正しくありません' };
    }
  }
  if (totalText > LIMITS.totalTextMax) return { error: '文章が長すぎます' };
  if (images > LIMITS.imagesMax) return { error: `写真は${LIMITS.imagesMax}枚までです` };
  if (out.length === 0) return { error: '本文を書いてください' };
  return { blocks: out };
}

function excerptOf(blocks) {
  const t = blocks.filter((b) => b.type === 'text').map((b) => b.text).join(' ').replace(/\s+/g, ' ').trim();
  return t.length > 70 ? t.slice(0, 70) + '…' : t;
}

async function readBody(req) {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

export async function handle(req, { store, env, now = () => new Date() }) {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api\/blog\/?/, '').replace(/\/+$/, '');
  const method = req.method.toUpperCase();

  // ---- 読み出し（誰でも） ----
  if (method === 'GET' && path === 'posts') {
    const { list } = await readIndex(store);
    return json(200, { posts: list }, { 'Cache-Control': 'public, max-age=0, must-revalidate' });
  }

  if (method === 'GET' && path === 'post') {
    const id = url.searchParams.get('id') || '';
    if (!ID_RE.test(id)) return json(404, { error: '記事が見つかりません' });
    const post = await store.get(`post/${id}`, { type: 'json', consistency: 'strong' });
    if (!post) return json(404, { error: '記事が見つかりません' });
    const { deleteHash, ...pub } = post;
    return json(200, { post: pub }, { 'Cache-Control': 'public, max-age=0, must-revalidate' });
  }

  const imgMatch = /^img\/(\d{8}-\d{6}-[0-9a-f]{4})\/(\d{1,3})$/.exec(path);
  if (method === 'GET' && imgMatch) {
    const key = `img/${imgMatch[1]}/${imgMatch[2]}`;
    const res = await store.getWithMetadata(key, { type: 'arrayBuffer' });
    if (!res || !res.data) return new Response('Not found', { status: 404 });
    return new Response(res.data, {
      status: 200,
      headers: {
        'Content-Type': (res.metadata && res.metadata.contentType) || 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  }

  if (method !== 'POST') return json(404, { error: 'not found' });

  const body = await readBody(req);
  if (!body) return json(400, { error: '送信内容を読み取れませんでした' });

  const passcode = env.BLOG_PASSCODE;
  const adminPasscode = env.BLOG_ADMIN_PASSCODE;

  // ---- 合言葉の確認 ----
  if (path === 'check') {
    if (!passcode) return json(503, { error: '合言葉がまだ設定されていません' });
    if (passEqual(body.passcode, passcode)) return json(200, { ok: true });
    await sleep(600);
    return json(401, { error: '合言葉が違います' });
  }

  if (path === 'admin-check') {
    if (!adminPasscode) return json(503, { error: '管理用の合言葉がまだ設定されていません' });
    if (passEqual(body.adminPasscode, adminPasscode)) return json(200, { ok: true });
    await sleep(600);
    return json(401, { error: '管理用の合言葉が違います' });
  }

  // ---- 投稿 ----
  if (path === 'create') {
    if (!passcode) return json(503, { error: '合言葉がまだ設定されていません' });
    if (!passEqual(body.passcode, passcode)) {
      await sleep(600);
      return json(401, { error: '合言葉が違います' });
    }
    const member = findMember(Number(body.author));
    if (!member) return json(400, { error: '名前を選んでください' });
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) return json(400, { error: 'タイトルを書いてください' });
    if (title.length > LIMITS.titleMax) return json(400, { error: `タイトルは${LIMITS.titleMax}文字までです` });
    const norm = normalizeBlocks(body.blocks);
    if (norm.error) return json(400, { error: norm.error });

    const date = now();
    const id = makeId(date);
    const deleteKey = randomBytes(16).toString('hex');
    let n = 0;
    const blocks = [];
    for (const b of norm.blocks) {
      if (b.type === 'image') {
        n += 1;
        await store.set(`img/${id}/${n}`, b.img.buf, { metadata: { contentType: b.img.contentType } });
        blocks.push({ type: 'image', src: `/api/blog/img/${id}/${n}` });
      } else {
        blocks.push(b);
      }
    }
    const author = { no: member.no, name: member.name };
    const thumb = (blocks.find((b) => b.type === 'image') || {}).src || null;
    const post = { id, date: date.toISOString(), title, author, blocks, deleteHash: sha256(deleteKey), images: n };
    await store.setJSON(`post/${id}`, post);
    await updateIndex(store, (list) => {
      const entry = { id, date: post.date, title, author, thumb, excerpt: excerptOf(blocks) };
      return [entry, ...list.filter((e) => e.id !== id)];
    });
    return json(200, { ok: true, id, deleteKey });
  }

  // ---- 編集（書いた本人のスマホの鍵、または管理用の合言葉）。ID・投稿日時はそのまま ----
  if (path === 'update') {
    const id = String(body.id || '');
    if (!ID_RE.test(id)) return json(404, { error: '記事が見つかりません' });
    const post = await store.get(`post/${id}`, { type: 'json', consistency: 'strong' });
    if (!post) return json(404, { error: 'この記事は見つかりませんでした。削除された可能性があります' });
    const byOwner = typeof body.deleteKey === 'string' && body.deleteKey && safeEqual(sha256(body.deleteKey), post.deleteHash);
    const byAdmin = adminPasscode && passEqual(body.adminPasscode, adminPasscode);
    if (!byOwner && !byAdmin) {
      await sleep(600);
      return json(403, { error: 'この記事を編集する権限がありません' });
    }
    const member = body.author === undefined ? findMember(post.author.no) : findMember(Number(body.author));
    if (!member) return json(400, { error: '名前を選んでください' });
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) return json(400, { error: 'タイトルを書いてください' });
    if (title.length > LIMITS.titleMax) return json(400, { error: `タイトルは${LIMITS.titleMax}文字までです` });

    const prefix = `/api/blog/img/${id}/`;
    const existing = new Set(
      (post.blocks || []).filter((b) => b.type === 'image' && typeof b.src === 'string' && b.src.startsWith(prefix)).map((b) => Number(b.src.slice(prefix.length)))
    );
    const norm = normalizeBlocks(body.blocks, existing);
    if (norm.error) return json(400, { error: norm.error });

    // 新しい写真は今までに使った番号の続きから（同じ番号を使い回さない＝古い写真が表示されることがない）
    let n = post.images || 0;
    const used = new Set();
    const blocks = [];
    for (const b of norm.blocks) {
      if (b.type === 'image' && b.keep !== undefined) {
        used.add(b.keep);
        blocks.push({ type: 'image', src: prefix + b.keep });
      } else if (b.type === 'image') {
        n += 1;
        if (n > 999) return json(400, { error: 'この記事はこれ以上写真を入れ替えられません。新しく書き直してください' });
        await store.set(`img/${id}/${n}`, b.img.buf, { metadata: { contentType: b.img.contentType } });
        blocks.push({ type: 'image', src: prefix + n });
      } else {
        blocks.push(b);
      }
    }
    const author = { no: member.no, name: member.name };
    const thumb = (blocks.find((b) => b.type === 'image') || {}).src || null;
    const next = { ...post, title, author, blocks, images: n, updatedAt: now().toISOString() };
    await store.setJSON(`post/${id}`, next);
    await updateIndex(store, (list) =>
      list.map((e) => (e.id === id ? { ...e, title, author, thumb, excerpt: excerptOf(blocks) } : e))
    );
    for (const k of existing) if (!used.has(k)) await store.delete(`img/${id}/${k}`);
    return json(200, { ok: true, id });
  }

  // ---- 削除（書いた本人のスマホの鍵、または管理用の合言葉） ----
  if (path === 'delete') {
    const id = String(body.id || '');
    if (!ID_RE.test(id)) return json(404, { error: '記事が見つかりません' });
    const post = await store.get(`post/${id}`, { type: 'json', consistency: 'strong' });
    if (!post) {
      await updateIndex(store, (list) => list.filter((e) => e.id !== id));
      return json(200, { ok: true, alreadyGone: true });
    }
    const byOwner = typeof body.deleteKey === 'string' && body.deleteKey && safeEqual(sha256(body.deleteKey), post.deleteHash);
    const byAdmin = adminPasscode && passEqual(body.adminPasscode, adminPasscode);
    if (!byOwner && !byAdmin) {
      await sleep(600);
      return json(403, { error: 'この記事を消す権限がありません' });
    }
    await updateIndex(store, (list) => list.filter((e) => e.id !== id));
    for (let i = 1; i <= (post.images || 0); i++) await store.delete(`img/${id}/${i}`);
    await store.delete(`post/${id}`);
    return json(200, { ok: true });
  }

  // ---- 全記事の書き出し（引っ越し用・管理者のみ） ----
  if (path === 'export') {
    if (!adminPasscode || !passEqual(body.adminPasscode, adminPasscode)) {
      await sleep(600);
      return json(401, { error: '管理用の合言葉が違います' });
    }
    const { list } = await readIndex(store);
    const posts = [];
    for (const e of list) {
      const p = await store.get(`post/${e.id}`, { type: 'json', consistency: 'strong' });
      if (p) {
        const { deleteHash, ...pub } = p;
        posts.push(pub);
      }
    }
    return json(200, { exportedAt: now().toISOString(), posts });
  }

  return json(404, { error: 'not found' });
}
