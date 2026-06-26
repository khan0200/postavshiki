/**
 * api/lib/http.js - Tiny shared helpers for Vercel Node serverless functions
 * (these are plain (req, res) handlers, not Express - no framework needed at this scale).
 */

function sendJson(res, status, body) {
  res.status(status).json(body);
}

function genId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function readBody(req) {
  // Vercel's Node runtime already parses JSON bodies onto req.body for
  // standard content-types, but guard for the rare empty/already-object case.
  if (req.body && typeof req.body === 'object') return req.body;
  return {};
}

module.exports = { sendJson, genId, readBody };
