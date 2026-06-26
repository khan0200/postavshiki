/**
 * api/inspectors/[id].js - PUT (rename) / DELETE for one inspector.
 * Mirrors InspectorRepository.update() / .remove() from js/repositories.js.
 */
const { getClient } = require('../_lib/turso');
const { sendJson, readBody } = require('../_lib/http');

module.exports = async function handler(req, res) {
  const db = getClient();
  const { id } = req.query;

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
