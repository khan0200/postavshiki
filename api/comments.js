/**
 * api/comments.js - GET (all) / POST (create) when no ?id is given;
 * PUT (edit) / DELETE for ?id=X. Single flat file (id read from query
 * string, not a dynamic [id] URL segment) - Vercel's optional catch-all
 * [[id]].js syntax was not being recognized as a route by this project's
 * build, so every dynamic api/ route was switched to plain files with ?id=
 * instead.
 * Mirrors CommentRepository.getAll/.add/.update/.remove from js/repositories.js.
 */
const { getClient } = require('./lib/turso');
const { sendJson, genId, readBody } = require('./lib/http');

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
