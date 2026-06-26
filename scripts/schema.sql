-- schema.sql - Turso (libSQL/SQLite) schema mirroring the Firestore collections.
-- Document IDs become TEXT PRIMARY KEYs so existing Firestore IDs can be migrated as-is.

CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS parts (
  id TEXT PRIMARY KEY,
  supplierId TEXT NOT NULL,
  supplierName TEXT NOT NULL,
  detailId TEXT NOT NULL,
  detailName TEXT NOT NULL,
  createdAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_parts_supplierId ON parts(supplierId);

CREATE TABLE IF NOT EXISTS inspectors (
  id TEXT PRIMARY KEY,
  fullName TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS records (
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
);
CREATE INDEX IF NOT EXISTS idx_records_supplierId ON records(supplierId);
CREATE INDEX IF NOT EXISTS idx_records_date ON records(date);

-- Mirrors the Firestore meta/years doc: one row holding the distinct calendar
-- years seen across `records`, maintained incrementally on every write
-- instead of scanned from the full table on every read.
CREATE TABLE IF NOT EXISTS meta_years (
  year INTEGER PRIMARY KEY
);
