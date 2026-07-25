require('dotenv').config();
const { createClient } = require('@libsql/client');
const fs = require('fs');
const path = require('path');

// Fallback to local.db if not defined
const dbUrl = process.env.TURSO_DATABASE_URL || 'file:local.db';
const authToken = process.env.TURSO_AUTH_TOKEN || '';

console.log(`Connecting to database at: ${dbUrl}`);

const client = createClient({
  url: dbUrl,
  authToken: authToken
});

async function main() {
  // 1. Read and apply schema
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  const statements = schemaSql.split(';').map(s => s.trim()).filter(Boolean);
  
  console.log('Applying schema to database...');
  for (const stmt of statements) {
    await client.execute(stmt);
  }
  console.log('Schema applied successfully.');

  // 2. Seed default data if empty
  // Seed inspectors
  const inspectorsCheck = await client.execute('SELECT COUNT(*) as count FROM inspectors');
  if (inspectorsCheck.rows[0].count === 0) {
    console.log('Seeding default inspectors...');
    const defaultInspectors = [
      { id: 'insp1', fullName: 'Aliyev Vali' },
      { id: 'insp2', fullName: 'Karimov Hasan' },
      { id: 'insp3', fullName: 'Nazarov Farhod' }
    ];
    for (const insp of defaultInspectors) {
      await client.execute({
        sql: 'INSERT INTO inspectors (id, fullName) VALUES (?, ?)',
        args: [insp.id, insp.fullName]
      });
    }
  }

  // Seed comments
  const commentsCheck = await client.execute('SELECT COUNT(*) as count FROM comments');
  if (commentsCheck.rows[0].count === 0) {
    console.log('Seeding default comments...');
    const defaultComments = [
      { id: 'c1', text: 'OK' },
      { id: 'c2', text: 'QAYTARILSIN' },
      { id: 'c3', text: 'ZANGLAGAN' },
      { id: 'c4', text: 'Tirnalgan joylari bor' },
      { id: 'c5', text: 'O\'lchami noto\'g\'ri' }
    ];
    for (const c of defaultComments) {
      await client.execute({
        sql: 'INSERT INTO comments (id, text) VALUES (?, ?)',
        args: [c.id, c.text]
      });
    }
  }

  // Seed some dummy suppliers and parts if empty
  const suppliersCheck = await client.execute('SELECT COUNT(*) as count FROM suppliers');
  if (suppliersCheck.rows[0].count === 0) {
    console.log('Seeding default suppliers and parts...');
    const now = new Date().toISOString();
    
    // Suppliers
    const suppliers = [
      { id: 'sup1', name: 'AutoParts Ltd', createdAt: now },
      { id: 'sup2', name: 'Global Metals', createdAt: now }
    ];
    for (const s of suppliers) {
      await client.execute({
        sql: 'INSERT INTO suppliers (id, name, createdAt) VALUES (?, ?, ?)',
        args: [s.id, s.name, s.createdAt]
      });
    }

    // Parts
    const parts = [
      { id: 'part1', supplierId: 'sup1', supplierName: 'AutoParts Ltd', detailId: 'AP-101', detailName: 'Porshen', createdAt: now },
      { id: 'part2', supplierId: 'sup1', supplierName: 'AutoParts Ltd', detailId: 'AP-102', detailName: 'Klapan', createdAt: now },
      { id: 'part3', supplierId: 'sup2', supplierName: 'Global Metals', detailId: 'GM-501', detailName: 'Bolt M10', createdAt: now }
    ];
    for (const p of parts) {
      await client.execute({
        sql: 'INSERT INTO parts (id, supplierId, supplierName, detailId, detailName, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
        args: [p.id, p.supplierId, p.supplierName, p.detailId, p.detailName, p.createdAt]
      });
    }
  }

  console.log('Database initialization and seeding complete.');
  process.exit(0);
}

main().catch(err => {
  console.error('Error during database initialization:', err);
  process.exit(1);
});
