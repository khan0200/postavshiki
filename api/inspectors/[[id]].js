/**
 * api/inspectors/[[id]].js - GET (list all) / POST (create) when no id;
 * PUT (rename) / DELETE when id is present. Combined into one optional-catch-all
 * route instead of separate index.js + [id].js files, to stay under the Hobby
 * plan's serverless function count limit.
 * Mirrors InspectorRepository.getAll/.add/.update/.remove from js/repositories.js.
 */
const { getClient } = require('../_lib/turso');
const { sendJson, genId, readBody } = require('../_lib/http');

module.exports = async function handler(req, res) {
  const db = getClient();
  const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;

  if (!id) {
    if (req.method === 'GET') {
      const result = await db.execute('SELECT id, fullName FROM inspectors ORDER BY fullName');
      return sendJson(res, 200, result.rows);
    }

    if (req.method === 'POST') {
      const body = await readBody(req);
      const fullName = (body.fullName || '').trim();
      if (!fullName) return sendJson(res, 400, { error: 'fullName is required' });

      const newId = genId('ins');
      await db.execute({ sql: 'INSERT INTO inspectors (id, fullName) VALUES (?, ?)', args: [newId, fullName] });
      return sendJson(res, 201, { id: newId, fullName });
    }

    res.setHeader('Allow', 'GET, POST');
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  if (req.method === 'PUT') {
    const body = await readBody(req);
    const fullName = (body.fullName || '').trim();
    if (!fullName) return sendJson(res, 400, { error: 'fullName is required' });

    await db.execute({ sql: 'UPDATE inspectors SET fullName = ? WHERE id = ?', args: [fullName, id] });
    return sendJson(res, 200, { id, fullName });
  }

  if (req.method === 'DELETE') {
    await db.execute({ sql: 'DELETE FROM inspectors WHERE id = ?', args: [id] });
    return sendJson(res, 200, { ok: true });
  }

  res.setHeader('Allow', 'PUT, DELETE');
  return sendJson(res, 405, { error: 'Method not allowed' });
};
