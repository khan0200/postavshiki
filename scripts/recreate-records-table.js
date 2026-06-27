require('dotenv').config();
const { createClient } = require('@libsql/client');

const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN;

if (!tursoUrl || !tursoToken) {
  console.error('Error: TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set.');
  console.error('Please create a .env file or export these environment variables before running.');
  process.exit(1);
}

const client = createClient({
  url: tursoUrl,
  authToken: tursoToken
});

async function main() {
  console.log('Recreating "records" table and indexes on Turso...');

  const statements = [
    `CREATE TABLE IF NOT EXISTS records (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      fn TEXT NOT NULL,
      supplierId TEXT NOT NULL,
      supplierName TEXT NOT NULL,
      detailId TEXT NOT NULL,
      detailName TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      checkedQuantity INTEGER NOT NULL,
      returnedQuantity INTEGER NOT NULL,
      inspectorId TEXT NOT NULL,
      inspectorName TEXT NOT NULL,
      comment TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_records_supplierId ON records(supplierId)`,
    `CREATE INDEX IF NOT EXISTS idx_records_date ON records(date)`
  ];

  for (const stmt of statements) {
    console.log(`Executing: ${stmt.split('\n')[0]}...`);
    await client.execute(stmt);
  }

  console.log('Success! The "records" table has been created successfully.');
  process.exit(0);
}

main().catch(err => {
  console.error('Error recreating table:', err);
  process.exit(1);
});
