/**
 * api/suppliers/[[id]].js - GET (list all) / POST (create) when no id;
 * GET (single) / PUT (rename, cascades) / DELETE (remove, cascades) when id
 * is present. Combined into one optional-catch-all route instead of separate
 * index.js + [id].js files, to stay under the Hobby plan's serverless
 * function count limit.
 * Mirrors SupplierRepository.getAll/.getById/.add/.rename/.remove from js/repositories.js.
 */
const { getClient } = require('../_lib/turso');
const { sendJson, genId, readBody } = require('../_lib/http');

module.exports = async function handler(req, res) {
  const db = getClient();
  const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;

  if (!id) {
    if (req.method === 'GET') {
      const result = await db.execute('SELECT id, name, createdAt FROM suppliers ORDER BY name');
      return sendJson(res, 200, result.rows);
    }

    if (req.method === 'POST') {
      const body = await readBody(req);
      const name = (body.name || '').trim();
      if (!name) return sendJson(res, 400, { error: 'name is required' });

      const newId = genId('sup');
      const createdAt = new Date().toISOString();
      await db.execute({
        sql: 'INSERT INTO suppliers (id, name, createdAt) VALUES (?, ?, ?)',
        args: [newId, name, createdAt]
      });
      return sendJson(res, 201, { id: newId, name, createdAt });
    }

    res.setHeader('Allow', 'GET, POST');
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  if (req.method === 'GET') {
    const result = await db.execute({
      sql: 'SELECT id, name, createdAt FROM suppliers WHERE id = ?',
      args: [id]
    });
    if (result.rows.length === 0) return sendJson(res, 404, { error: 'Supplier not found' });
    return sendJson(res, 200, result.rows[0]);
  }

  if (req.method === 'PUT') {
    const body = await readBody(req);
    const name = (body.name || '').trim();
    if (!name) return sendJson(res, 400, { error: 'name is required' });

    // Cascade the new name into denormalized copies on parts + records,
    // batched into a single libSQL batch (one round trip) instead of N
    // sequential UPDATE statements.
    await db.batch([
      { sql: 'UPDATE suppliers SET name = ? WHERE id = ?', args: [name, id] },
      { sql: 'UPDATE parts SET supplierName = ? WHERE supplierId = ?', args: [name, id] },
      { sql: 'UPDATE records SET supplierName = ? WHERE supplierId = ?', args: [name, id] }
    ], 'write');

    return sendJson(res, 200, { id, name });
  }

  if (req.method === 'DELETE') {
    // Cascade-delete all parts belonging to this supplier (historical records
    // are preserved, matching the existing Firestore behavior in
    // SupplierRepository.remove()).
    await db.batch([
      { sql: 'DELETE FROM parts WHERE supplierId = ?', args: [id] },
      { sql: 'DELETE FROM suppliers WHERE id = ?', args: [id] }
    ], 'write');

    return sendJson(res, 200, { ok: true });
  }

  res.setHeader('Allow', 'GET, PUT, DELETE');
  return sendJson(res, 405, { error: 'Method not allowed' });
};
