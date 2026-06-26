/**
 * api/parts/[[id]].js - GET (all, or ?supplierId=X) / POST (create, or
 * transfer via ?action=transfer) when no id; PUT (update) / DELETE when id
 * is present. Combined into one optional-catch-all route instead of separate
 * index.js + [id].js + transfer.js files, to stay under the Hobby plan's
 * serverless function count limit.
 * Mirrors PartRepository.getAll/.getBySupplier/.add/.update/.remove/.transfer
 * from js/repositories.js.
 */
const { getClient } = require('../_lib/turso');
const { sendJson, genId, readBody } = require('../_lib/http');

module.exports = async function handler(req, res) {
  const db = getClient();
  const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;

  if (!id) {
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

      if (req.query.action === 'transfer') {
        const { partId, targetSupplierId, targetSupplierName } = body;
        if (!partId || !targetSupplierId || !targetSupplierName) {
          return sendJson(res, 400, { error: 'partId, targetSupplierId, and targetSupplierName are required' });
        }
        await db.execute({
          sql: 'UPDATE parts SET supplierId = ?, supplierName = ? WHERE id = ?',
          args: [targetSupplierId, targetSupplierName, partId]
        });
        return sendJson(res, 200, { id: partId, supplierId: targetSupplierId, supplierName: targetSupplierName });
      }

      const { supplierId, supplierName } = body;
      const detailId = (body.detailId || '').trim().toUpperCase();
      const detailName = (body.detailName || '').trim();
      if (!supplierId || !detailId || !detailName) {
        return sendJson(res, 400, { error: 'supplierId, detailId, detailName are required' });
      }

      const newId = genId('part');
      const createdAt = new Date().toISOString();
      await db.execute({
        sql: 'INSERT INTO parts (id, supplierId, supplierName, detailId, detailName, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
        args: [newId, supplierId, supplierName, detailId, detailName, createdAt]
      });
      return sendJson(res, 201, { id: newId, supplierId, supplierName, detailId, detailName, createdAt });
    }

    res.setHeader('Allow', 'GET, POST');
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

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
