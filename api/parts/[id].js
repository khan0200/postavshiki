/**
 * api/parts/[id].js - PUT (update detailId/detailName) / DELETE for one part.
 * Mirrors PartRepository.update() / .remove() from js/repositories.js.
 */
const { getClient } = require('../_lib/turso');
const { sendJson, readBody } = require('../_lib/http');

module.exports = async function handler(req, res) {
  const db = getClient();
  const { id } = req.query;

  if (req.method === 'PUT') {
    const body = await readBody(req);
    const detailId = (body.detailId || '').trim().toUpperCase();
    const detailName = (body.detailName || '').trim();
    if (!detailId || !detailName) return sendJson(res, 400, { error: 'detailId and detailName are required' });

    await db.execute({
      sql: 'UPDATE parts SET detailId = ?, detailName = ? WHERE id = ?',
      args: [detailId, detailName, id]
    });
    return sendJson(res, 200, { id, detailId, detailName });
  }

  if (req.method === 'DELETE') {
    await db.execute({ sql: 'DELETE FROM parts WHERE id = ?', args: [id] });
    return sendJson(res, 200, { ok: true });
  }

  res.setHeader('Allow', 'PUT, DELETE');
  return sendJson(res, 405, { error: 'Method not allowed' });
};
