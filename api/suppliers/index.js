/**
 * api/suppliers/index.js - GET (list all) / POST (create) suppliers.
 * Mirrors SupplierRepository.getAll() / .add() from js/repositories.js.
 */
const { getClient } = require('../_lib/turso');
const { sendJson, genId, readBody } = require('../_lib/http');

module.exports = async function handler(req, res) {
  const db = getClient();

  if (req.method === 'GET') {
    const result = await db.execute('SELECT id, name, createdAt FROM suppliers ORDER BY name');
    return sendJson(res, 200, result.rows);
  }

  if (req.method === 'POST') {
    const body = await readBody(req);
    const name = (body.name || '').trim();
    if (!name) return sendJson(res, 400, { error: 'name is required' });

    const id = genId('sup');
    const createdAt = new Date().toISOString();
    await db.execute({
      sql: 'INSERT INTO suppliers (id, name, createdAt) VALUES (?, ?, ?)',
      args: [id, name, createdAt]
    });
    return sendJson(res, 201, { id, name, createdAt });
  }

  res.setHeader('Allow', 'GET, POST');
  return sendJson(res, 405, { error: 'Method not allowed' });
};
