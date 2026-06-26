/**
 * api/comments/[[id]].js - GET (list all) / POST (create) when no id;
 * PUT (edit) / DELETE when id is present. Combined into one optional-catch-all
 * route (Vercel's [[id]].js syntax) instead of separate index.js + [id].js
 * files, to stay under the Hobby plan's serverless function count limit.
 * Mirrors CommentRepository.getAll/.add/.update/.remove from js/repositories.js.
 */
const { getClient } = require('../lib/turso');
const { sendJson, genId, readBody } = require('../lib/http');

module.exports = async function handler(req, res) {
  const db = getClient();
  const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;

  if (!id) {
    if (req.method === 'GET') {
      const result = await db.execute('SELECT id, text FROM comments ORDER BY text');
      return sendJson(res, 200, result.rows);
    }

    if (req.method === 'POST') {
      const body = await readBody(req);
      const text = (body.text || '').trim();
      if (!text) return sendJson(res, 400, { error: 'text is required' });

      const newId = genId('cmt');
      await db.execute({ sql: 'INSERT INTO comments (id, text) VALUES (?, ?)', args: [newId, text] });
      return sendJson(res, 201, { id: newId, text });
    }

    res.setHeader('Allow', 'GET, POST');
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  if (req.method === 'PUT') {
    const body = await readBody(req);
    const text = (body.text || '').trim();
    if (!text) return sendJson(res, 400, { error: 'text is required' });

    await db.execute({ sql: 'UPDATE comments SET text = ? WHERE id = ?', args: [text, id] });
    return sendJson(res, 200, { id, text });
  }

  if (req.method === 'DELETE') {
    await db.execute({ sql: 'DELETE FROM comments WHERE id = ?', args: [id] });
    return sendJson(res, 200, { ok: true });
  }

  res.setHeader('Allow', 'PUT, DELETE');
  return sendJson(res, 405, { error: 'Method not allowed' });
};
