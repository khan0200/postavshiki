/**
 * api/comments/index.js - GET (list all) / POST (create) comment presets.
 * Mirrors CommentRepository.getAll() / .add() from js/repositories.js.
 */
const { getClient } = require('../_lib/turso');
const { sendJson, genId, readBody } = require('../_lib/http');

module.exports = async function handler(req, res) {
  const db = getClient();

  if (req.method === 'GET') {
    const result = await db.execute('SELECT id, text FROM comments ORDER BY text');
    return sendJson(res, 200, result.rows);
  }

  if (req.method === 'POST') {
    const body = await readBody(req);
    const text = (body.text || '').trim();
    if (!text) return sendJson(res, 400, { error: 'text is required' });

    const id = genId('cmt');
    await db.execute({ sql: 'INSERT INTO comments (id, text) VALUES (?, ?)', args: [id, text] });
    return sendJson(res, 201, { id, text });
  }

  res.setHeader('Allow', 'GET, POST');
  return sendJson(res, 405, { error: 'Method not allowed' });
};
