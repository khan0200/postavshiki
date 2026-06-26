/**
 * api/records/import.js - POST: bulk CSV import of receiving records for one supplier.
 *
 * The browser still does CSV parsing (js/supplier-history.js parseCSV()) since that's
 * pure client-side text processing with no DB access - this endpoint receives the
 * already-parsed row objects and does all the database work (resolving/creating
 * inspectors and parts, bulk-inserting records, updating the meta_years table) in one
 * request instead of the previous many-small-Firestore-batches dance.
 *
 * Body shape:
 *   {
 *     supplierId: string,
 *     supplierName: string,
 *     rows: [{ date, fn, detailId, quantity, checkedQuantity, returnedQuantity, comment, inspectorName }]
 *   }
 */
const { getClient } = require('../lib/turso');
const { sendJson, genId, readBody } = require('../lib/http');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const db = getClient();
  const body = await readBody(req);
  const { supplierId, supplierName, rows } = body;

  if (!supplierId || !supplierName || !Array.isArray(rows) || rows.length === 0) {
    return sendJson(res, 400, { error: 'supplierId, supplierName, and a non-empty rows array are required' });
  }

  // 1. Resolve inspectors: reuse existing by case-insensitive fullName match, create missing ones.
  const inspectorsResult = await db.execute('SELECT id, fullName FROM inspectors');
  const inspectorMap = new Map(inspectorsResult.rows.map(i => [i.fullName.trim().toLowerCase(), i.id]));

  const uniqueInspectorNames = new Set(rows.map(r => (r.inspectorName || 'Unknown').trim()).filter(Boolean));
  const newInspectorStatements = [];
  for (const name of uniqueInspectorNames) {
    const key = name.toLowerCase();
    if (!inspectorMap.has(key)) {
      const newId = genId('ins');
      inspectorMap.set(key, newId);
      newInspectorStatements.push({ sql: 'INSERT INTO inspectors (id, fullName) VALUES (?, ?)', args: [newId, name] });
    }
  }
  if (newInspectorStatements.length > 0) {
    await db.batch(newInspectorStatements, 'write');
  }

  // 2. Resolve parts: any detailId already known anywhere keeps its existing detailName;
  // any detailId not yet registered for this supplier gets created.
  const allPartsResult = await db.execute('SELECT detailId, detailName FROM parts');
  const partNameMap = new Map();
  allPartsResult.rows.forEach(p => {
    if (p.detailId && p.detailName) partNameMap.set(p.detailId.trim().toUpperCase(), p.detailName.trim());
  });

  const activePartsResult = await db.execute({
    sql: 'SELECT detailId FROM parts WHERE supplierId = ?',
    args: [supplierId]
  });
  const activePartIds = new Set(activePartsResult.rows.map(p => p.detailId.trim().toUpperCase()));

  const uniqueDetailIds = new Set(rows.map(r => (r.detailId || '').trim().toUpperCase()).filter(Boolean));
  const newPartStatements = [];
  const createdAt = new Date().toISOString();
  for (const detailId of uniqueDetailIds) {
    if (!activePartIds.has(detailId)) {
      const detailName = partNameMap.get(detailId) || `Part ${detailId}`;
      const newId = genId('part');
      newPartStatements.push({
        sql: 'INSERT INTO parts (id, supplierId, supplierName, detailId, detailName, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
        args: [newId, supplierId, supplierName, detailId, detailName, createdAt]
      });
      activePartIds.add(detailId);
      if (!partNameMap.has(detailId)) partNameMap.set(detailId, detailName);
    }
  }
  if (newPartStatements.length > 0) {
    await db.batch(newPartStatements, 'write');
  }

  // 3. Bulk-insert the records themselves, tracking distinct years as we go.
  const recordStatements = [];
  const importedYears = new Set();
  const recordCreatedAt = new Date().toISOString();

  for (const row of rows) {
    const detailId = (row.detailId || '').trim().toUpperCase();
    const detailName = partNameMap.get(detailId) || `Part ${detailId}`;
    const insName = (row.inspectorName || 'Unknown').trim();
    const inspectorId = inspectorMap.get(insName.toLowerCase()) || 'unknown';

    const yr = new Date(row.date).getFullYear();
    if (!isNaN(yr)) importedYears.add(yr);

    const id = genId('rec');
    recordStatements.push({
      sql: `INSERT INTO records (id, date, fn, supplierId, supplierName, detailId, detailName, quantity,
                                  checkedQuantity, returnedQuantity, inspectorId, inspectorName, comment, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id, row.date, row.fn || '', supplierId, supplierName, detailId, detailName,
        Number(row.quantity) || 0, Number(row.checkedQuantity) || 0, Number(row.returnedQuantity) || 0,
        inspectorId, insName, row.comment || 'OK', recordCreatedAt
      ]
    });
  }

  // libSQL batches are most reliable in chunks rather than one giant batch for
  // very large imports - 500 statements per batch matches the previous Firestore chunking.
  const CHUNK_SIZE = 500;
  for (let i = 0; i < recordStatements.length; i += CHUNK_SIZE) {
    await db.batch(recordStatements.slice(i, i + CHUNK_SIZE), 'write');
  }

  if (importedYears.size > 0) {
    await db.batch(
      Array.from(importedYears).map(yr => ({ sql: 'INSERT OR IGNORE INTO meta_years (year) VALUES (?)', args: [yr] })),
      'write'
    );
  }

  return sendJson(res, 200, { imported: recordStatements.length });
};
