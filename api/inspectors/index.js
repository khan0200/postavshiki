/**
 * api/inspectors/index.js - GET (list all) / POST (create) inspectors.
 * Mirrors InspectorRepository.getAll() / .add() from js/repositories.js.
 */
const { getClient } = require('../_lib/turso');
const { sendJson, genId, readBody } = require('../_lib/http');

module.exports = async function handler(req, res) {
  const db = getClient();

  if (req.method === 'GET') {
    const result = await db.execute('SELECT id, fullName FROM inspectors ORDER BY fullName');
    return sendJson(res, 200, result.rows);
  }

  if (req.method === 'POST') {
    const body = await readBody(req);
    const fullName = (body.fullName || '').trim();
    if (!fullName) return sendJson(res, 400, { error: 'fullName is required' });

    const id = genId('ins');
    await db.execute({
      sql: 'INSERT INTO inspectors (id, fullName) VALUES (?, ?)',
      args: [id, fullName]
    });
    return sendJson(res, 201, { id, fullName });
  }

  res.setHeader('Allow', 'GET, POST');
  return sendJson(res, 405, { error: 'Method not allowed' });
};
