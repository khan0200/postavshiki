/**
 * api/parts/index.js - GET (all, or ?supplierId=X scoped) / POST (create) parts.
 * Mirrors PartRepository.getAll() / .getBySupplier() / .add() from js/repositories.js.
 */
const { getClient } = require('../_lib/turso');
const { sendJson, genId, readBody } = require('../_lib/http');

module.exports = async function handler(req, res) {
  const db = getClient();

  if (req.method === 'GET') {
    const { supplierId } = req.query;
    const result = supplierId
      ? await db.execute({
          sql: 'SELECT id, supplierId, supplierName, detailId, detailName, createdAt FROM parts WHERE supplierId = ?',
          args: [supplierId]
        })
      : await db.execute('SELECT id, supplierId, supplierName, detailId, detailName, createdAt FROM parts');
    return sendJson(res, 200, result.rows);
  }

  if (req.method === 'POST') {
    const body = await readBody(req);
    const { supplierId, supplierName } = body;
    const detailId = (body.detailId || '').trim().toUpperCase();
    const detailName = (body.detailName || '').trim();
    if (!supplierId || !detailId || !detailName) {
      return sendJson(res, 400, { error: 'supplierId, detailId, detailName are required' });
    }

    const id = genId('part');
    const createdAt = new Date().toISOString();
    await db.execute({
      sql: 'INSERT INTO parts (id, supplierId, supplierName, detailId, detailName, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
      args: [id, supplierId, supplierName, detailId, detailName, createdAt]
    });
    return sendJson(res, 201, { id, supplierId, supplierName, detailId, detailName, createdAt });
  }

  res.setHeader('Allow', 'GET, POST');
  return sendJson(res, 405, { error: 'Method not allowed' });
};
