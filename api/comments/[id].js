/**
 * api/comments/[id].js - PUT (edit text) / DELETE for one comment preset.
 * Mirrors CommentRepository.update() / .remove() from js/repositories.js.
 */
const { getClient } = require('../_lib/turso');
const { sendJson, readBody } = require('../_lib/http');

module.exports = async function handler(req, res) {
  const db = getClient();
  const { id } = req.query;

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
