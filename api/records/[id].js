/**
 * api/records/[id].js - PUT (update) / DELETE for one receiving record.
 * Mirrors ReceivingRepository.update() / .remove() from js/repositories.js.
 */
const { getClient } = require('../_lib/turso');
const { sendJson, readBody } = require('../_lib/http');

async function recordYear(db, dateStr) {
  if (!dateStr) return;
  const yr = new Date(dateStr).getFullYear();
  if (isNaN(yr)) return;
  await db.execute({ sql: 'INSERT OR IGNORE INTO meta_years (year) VALUES (?)', args: [yr] });
}

module.exports = async function handler(req, res) {
  const db = getClient();
  const { id } = req.query;

  if (req.method === 'PUT') {
    const body = await readBody(req);
    const required = ['date', 'fn', 'supplierId', 'supplierName', 'detailId', 'detailName', 'inspectorId', 'inspectorName'];
    for (const field of required) {
      if (!body[field]) return sendJson(res, 400, { error: `${field} is required` });
    }

    const updatedAt = new Date().toISOString();
    const updatedRecord = {
      id,
      date: body.date,
      fn: String(body.fn).trim(),
      supplierId: body.supplierId,
      supplierName: body.supplierName,
      detailId: body.detailId,
      detailName: body.detailName,
      quantity: Number(body.quantity),
      checkedQuantity: Number(body.checkedQuantity),
      returnedQuantity: Number(body.returnedQuantity),
      inspectorId: body.inspectorId,
      inspectorName: body.inspectorName,
      comment: String(body.comment || 'OK').trim(),
      updatedAt
    };

    await db.execute({
      sql: `UPDATE records SET date = ?, fn = ?, supplierId = ?, supplierName = ?, detailId = ?, detailName = ?,
                   quantity = ?, checkedQuantity = ?, returnedQuantity = ?, inspectorId = ?, inspectorName = ?,
                   comment = ?, updatedAt = ?
            WHERE id = ?`,
      args: [
        updatedRecord.date, updatedRecord.fn, updatedRecord.supplierId, updatedRecord.supplierName,
        updatedRecord.detailId, updatedRecord.detailName, updatedRecord.quantity, updatedRecord.checkedQuantity,
        updatedRecord.returnedQuantity, updatedRecord.inspectorId, updatedRecord.inspectorName,
        updatedRecord.comment, updatedRecord.updatedAt, id
      ]
    });

    await recordYear(db, updatedRecord.date);

    return sendJson(res, 200, updatedRecord);
  }

  if (req.method === 'DELETE') {
    await db.execute({ sql: 'DELETE FROM records WHERE id = ?', args: [id] });
    return sendJson(res, 200, { ok: true });
  }

  res.setHeader('Allow', 'PUT, DELETE');
  return sendJson(res, 405, { error: 'Method not allowed' });
};
