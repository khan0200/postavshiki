/**
 * api/parts/transfer.js - POST: move a part to a different supplier.
 * Mirrors PartRepository.transfer() from js/repositories.js.
 *
 * Lives at this flat path (not api/parts/[id]/transfer.js) because Vercel's
 * file-based router doesn't allow api/parts/[id] to exist simultaneously as
 * both a file (api/parts/[id].js) and a directory - that collision was
 * silently breaking the entire api/ build. partId travels in the request
 * body instead of the URL path.
 */
const { getClient } = require('../_lib/turso');
const { sendJson, readBody } = require('../_lib/http');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const db = getClient();
  const body = await readBody(req);
  const { partId, targetSupplierId, targetSupplierName } = body;
  if (!partId || !targetSupplierId || !targetSupplierName) {
    return sendJson(res, 400, { error: 'partId, targetSupplierId, and targetSupplierName are required' });
  }

  await db.execute({
    sql: 'UPDATE parts SET supplierId = ?, supplierName = ? WHERE id = ?',
    args: [targetSupplierId, targetSupplierName, partId]
  });

  return sendJson(res, 200, { id: partId, supplierId: targetSupplierId, supplierName: targetSupplierName });
};
