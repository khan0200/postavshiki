/**
 * scripts/migrate-firestore-to-turso.js - One-time data migration.
 *
 * Reads every document out of Firestore (suppliers, parts, inspectors, comments,
 * records, meta/years) using the Admin SDK and inserts it into Turso via libSQL,
 * preserving original document IDs so existing references (supplierId, detailId
 * foreign keys, etc.) keep working unchanged.
 *
 * Firestore is READ-ONLY in this script - nothing is deleted or modified in
 * Firestore. Safe to re-run; uses INSERT OR REPLACE so re-running after a
 * partial failure just overwrites with the same data instead of duplicating rows.
 *
 * Usage:
 *   1. Place a Firebase Admin SDK service account key at
 *      scripts/firebase-service-account.json (gitignored, never commit this file)
 *   2. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN env vars (see .env.example)
 *   3. npm run migrate:firestore-to-turso
 */
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');
const { createClient } = require('@libsql/client');

const SERVICE_ACCOUNT_PATH = path.join(__dirname, 'firebase-service-account.json');

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

async function main() {
  if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    console.error(`Service account key not found at ${SERVICE_ACCOUNT_PATH}`);
    console.error('Generate one at: Firebase Console > Project Settings > Service Accounts > Generate new private key');
    process.exit(1);
  }

  const tursoUrl = requireEnv('TURSO_DATABASE_URL');
  const tursoToken = requireEnv('TURSO_AUTH_TOKEN');

  admin.initializeApp({
    credential: admin.credential.cert(require(SERVICE_ACCOUNT_PATH))
  });
  const firestore = admin.firestore();
  const turso = createClient({ url: tursoUrl, authToken: tursoToken });

  console.log('Applying schema to Turso...');
  const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const statements = schemaSql.split(';').map(s => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    await turso.execute(stmt);
  }
  console.log('Schema applied.\n');

  // --- Suppliers ---
  console.log('Migrating suppliers...');
  const suppliersSnap = await firestore.collection('suppliers').get();
  const supplierStatements = [];
  suppliersSnap.forEach(doc => {
    const d = doc.data();
    supplierStatements.push({
      sql: 'INSERT OR REPLACE INTO suppliers (id, name, createdAt) VALUES (?, ?, ?)',
      args: [doc.id, d.name, d.createdAt || new Date().toISOString()]
    });
  });
  if (supplierStatements.length > 0) await turso.batch(supplierStatements, 'write');
  console.log(`  ${supplierStatements.length} suppliers migrated.`);

  // --- Parts ---
  console.log('Migrating parts...');
  const partsSnap = await firestore.collection('parts').get();
  const partStatements = [];
  partsSnap.forEach(doc => {
    const d = doc.data();
    partStatements.push({
      sql: 'INSERT OR REPLACE INTO parts (id, supplierId, supplierName, detailId, detailName, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
      args: [doc.id, d.supplierId, d.supplierName, d.detailId, d.detailName, d.createdAt || new Date().toISOString()]
    });
  });
  for (let i = 0; i < partStatements.length; i += 500) {
    await turso.batch(partStatements.slice(i, i + 500), 'write');
  }
  console.log(`  ${partStatements.length} parts migrated.`);

  // --- Inspectors ---
  console.log('Migrating inspectors...');
  const inspectorsSnap = await firestore.collection('inspectors').get();
  const inspectorStatements = [];
  inspectorsSnap.forEach(doc => {
    const d = doc.data();
    inspectorStatements.push({
      sql: 'INSERT OR REPLACE INTO inspectors (id, fullName) VALUES (?, ?)',
      args: [doc.id, d.fullName]
    });
  });
  if (inspectorStatements.length > 0) await turso.batch(inspectorStatements, 'write');
  console.log(`  ${inspectorStatements.length} inspectors migrated.`);

  // --- Comments ---
  console.log('Migrating comments...');
  const commentsSnap = await firestore.collection('comments').get();
  const commentStatements = [];
  commentsSnap.forEach(doc => {
    const d = doc.data();
    commentStatements.push({
      sql: 'INSERT OR REPLACE INTO comments (id, text) VALUES (?, ?)',
      args: [doc.id, d.text]
    });
  });
  if (commentStatements.length > 0) await turso.batch(commentStatements, 'write');
  console.log(`  ${commentStatements.length} comments migrated.`);

  // --- Records (the big one - chunked batches) ---
  console.log('Migrating records...');
  const recordsSnap = await firestore.collection('records').get();
  const recordStatements = [];
  const years = new Set();
  recordsSnap.forEach(doc => {
    const d = doc.data();
    recordStatements.push({
      sql: `INSERT OR REPLACE INTO records
              (id, date, fn, supplierId, supplierName, detailId, detailName, quantity,
               checkedQuantity, returnedQuantity, inspectorId, inspectorName, comment, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        doc.id, d.date, d.fn, d.supplierId, d.supplierName, d.detailId, d.detailName,
        Number(d.quantity) || 0, Number(d.checkedQuantity) || 0, Number(d.returnedQuantity) || 0,
        d.inspectorId, d.inspectorName, d.comment || 'OK',
        d.createdAt || new Date().toISOString(), d.updatedAt || null
      ]
    });
    if (d.date) {
      const yr = new Date(d.date).getFullYear();
      if (!isNaN(yr)) years.add(yr);
    }
  });
  for (let i = 0; i < recordStatements.length; i += 500) {
    await turso.batch(recordStatements.slice(i, i + 500), 'write');
    console.log(`  ...${Math.min(i + 500, recordStatements.length)} / ${recordStatements.length} records`);
  }
  console.log(`  ${recordStatements.length} records migrated.`);

  // --- meta/years ---
  console.log('Migrating meta/years...');
  if (years.size > 0) {
    await turso.batch(
      Array.from(years).map(yr => ({ sql: 'INSERT OR IGNORE INTO meta_years (year) VALUES (?)', args: [yr] })),
      'write'
    );
  }
  console.log(`  ${years.size} distinct years migrated.\n`);

  console.log('=== Migration complete ===');
  console.log(`Suppliers: ${supplierStatements.length}`);
  console.log(`Parts: ${partStatements.length}`);
  console.log(`Inspectors: ${inspectorStatements.length}`);
  console.log(`Comments: ${commentStatements.length}`);
  console.log(`Records: ${recordStatements.length}`);
  console.log(`Distinct years: ${years.size}`);
  console.log('\nFirestore was not modified - all original data remains intact for reconnection later.');

  process.exit(0);
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
