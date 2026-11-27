// メンバーブログの窓口（/api/blog/...）
import { getStore } from '@netlify/blobs';
import { handle } from '../lib/blog-core.mjs';

export default async (req) => {
  const store = getStore({ name: 'tk-blog', consistency: 'strong' });
  try {
    return await handle(req, { store, env: process.env });
  } catch (err) {
    console.error('[blog]', err);
    return new Response(JSON.stringify({ error: 'うまく処理できませんでした。少し待ってからもう一度試してください' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
};

export const config = {
  path: '/api/blog/*',
};
