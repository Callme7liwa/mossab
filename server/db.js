import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'properties.db');

const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS properties (
    id TEXT PRIMARY KEY,
    mlsId TEXT,
    address TEXT NOT NULL,
    addressKey TEXT,
    city TEXT,
    neighborhood TEXT,
    price INTEGER,
    originalPrice INTEGER,
    closePrice INTEGER,
    beds INTEGER,
    baths REAL,
    sqft INTEGER,
    lotSize REAL,
    yearBuilt INTEGER,
    propertyType TEXT,
    status TEXT,
    dom INTEGER,
    listDate TEXT,
    offMarketDate TEXT,
    closeDate TEXT,
    latitude REAL,
    longitude REAL,
    photoUrl TEXT,
    prevMarketTime INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);
  CREATE INDEX IF NOT EXISTS idx_properties_city ON properties(city);
  CREATE INDEX IF NOT EXISTS idx_properties_price ON properties(price);
  CREATE INDEX IF NOT EXISTS idx_properties_listDate ON properties(listDate);
  CREATE INDEX IF NOT EXISTS idx_properties_closeDate ON properties(closeDate);

  CREATE TABLE IF NOT EXISTS sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    status TEXT NOT NULL,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    properties_synced INTEGER DEFAULT 0,
    error TEXT
  );
`);

// Add addressKey column if it doesn't exist (for existing databases)
try {
  const columns = db.prepare("PRAGMA table_info(properties)").all();
  const hasAddressKey = columns.some(col => col.name === 'addressKey');
  if (!hasAddressKey) {
    db.exec('ALTER TABLE properties ADD COLUMN addressKey TEXT');
  }
  db.exec('CREATE INDEX IF NOT EXISTS idx_properties_addressKey ON properties(addressKey)');
  
  // Add photos column if it doesn't exist
  const hasPhotos = columns.some(col => col.name === 'photos');
  if (!hasPhotos) {
    console.log('Adding photos column to properties table...');
    db.exec('ALTER TABLE properties ADD COLUMN photos TEXT');
  }
} catch (e) {
  // Index might already exist, that's fine
}

export default db;
