/**
 * api/_lib/turso.js - Shared libSQL client for all Vercel serverless functions.
 * The Turso auth token lives only here, server-side, read from env vars -
 * it is never sent to or embedded in any browser-facing code.
 */
const { createClient } = require('@libsql/client');

let client;

function getClient() {
  if (!client) {
    client = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN
    });
  }
  return client;
}

module.exports = { getClient };
