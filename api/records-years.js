/**
 * api/records/years.js - GET: distinct calendar years across all records.
 * Mirrors ReceivingRepository.getDistinctYears() from js/repositories.js -
 * reads the small meta_years table (maintained incrementally on every record
 * write) instead of scanning the full records table.
 */
const { getClient } = require('./lib/turso');
const { sendJson } = require('./lib/http');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const db = getClient();
  const result = await db.execute('SELECT year FROM meta_years ORDER BY year DESC');
  return sendJson(res, 200, result.rows.map(r => r.year));
};
