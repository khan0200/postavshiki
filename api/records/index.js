/**
 * api/records/index.js - GET (?latest=N or ?supplierId=X) / POST (create) records.
 * Mirrors ReceivingRepository.getLatest() / .getBySupplier() / .add() from js/repositories.js.
 */
const { getClient } = require('../_lib/turso');
const { sendJson, genId, readBody } = require('../_lib/http');

async function recordYear(db, dateStr) {
  if (!dateStr) return;
  const yr = new Date(dateStr).getFullYear();
  if (isNaN(yr)) return;
  // INSERT OR IGNORE = same semantics as Firestore's arrayUnion: no-op if
  // the year is already present, atomic, no read-before-write needed.
  await db.execute({ sql: 'INSERT OR IGNORE INTO meta_years (year) VALUES (?)', args: [yr] });
}

module.exports = async function handler(req, res) {
  const db = getClient();

  if (req.method === 'GET') {
    const { latest, supplierId } = req.query;

    if (supplierId) {
      const result = await db.execute({
        sql: `SELECT id, date, fn, supplierId, supplierName, detailId, detailName, quantity,
                     checkedQuantity, returnedQuantity, inspectorId, inspectorName, comment, createdAt, updatedAt
              FROM records WHERE supplierId = ?`,
        args: [supplierId]
      });
      return sendJson(res, 200, result.rows);
    }

    const count = latest ? parseInt(latest, 10) || 30 : 30;
    const result = await db.execute({
      sql: `SELECT id, date, fn, supplierId, supplierName, detailId, detailName, quantity,
                   checkedQuantity, returnedQuantity, inspectorId, inspectorName, comment, createdAt, updatedAt
            FROM records ORDER BY date DESC LIMIT ?`,
      args: [count]
    });
    return sendJson(res, 200, result.rows);
  }

  if (req.method === 'POST') {
    const body = await readBody(req);
    const required = ['date', 'fn', 'supplierId', 'supplierName', 'detailId', 'detailName', 'inspectorId', 'inspectorName'];
    for (const field of required) {
      if (!body[field]) return sendJson(res, 400, { error: `${field} is required` });
    }

    const id = genId('rec');
    const createdAt = new Date().toISOString();
    const newRecord = {
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
      createdAt
    };

    await db.execute({
      sql: `INSERT INTO records (id, date, fn, supplierId, supplierName, detailId, detailName, quantity,
                                  checkedQuantity, returnedQuantity, inspectorId, inspectorName, comment, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        newRecord.id, newRecord.date, newRecord.fn, newRecord.supplierId, newRecord.supplierName,
        newRecord.detailId, newRecord.detailName, newRecord.quantity, newRecord.checkedQuantity,
        newRecord.returnedQuantity, newRecord.inspectorId, newRecord.inspectorName, newRecord.comment, newRecord.createdAt
      ]
    });

    await recordYear(db, newRecord.date);

    return sendJson(res, 201, newRecord);
  }

  res.setHeader('Allow', 'GET, POST');
  return sendJson(res, 405, { error: 'Method not allowed' });
};
