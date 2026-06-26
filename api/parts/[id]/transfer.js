/**
 * api/parts/[id]/transfer.js - POST: move a part to a different supplier.
 * Mirrors PartRepository.transfer() from js/repositories.js.
 */
const { getClient } = require('../../_lib/turso');
const { sendJson, readBody } = require('../../_lib/http');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const db = getClient();
  const { id } = req.query;
  const body = await readBody(req);
  const { targetSupplierId, targetSupplierName } = body;
  if (!targetSupplierId || !targetSupplierName) {
    return sendJson(res, 400, { error: 'targetSupplierId and targetSupplierName are required' });
  }

  await db.execute({
    sql: 'UPDATE parts SET supplierId = ?, supplierName = ? WHERE id = ?',
    args: [targetSupplierId, targetSupplierName, id]
  });

  return sendJson(res, 200, { id, supplierId: targetSupplierId, supplierName: targetSupplierName });
};
