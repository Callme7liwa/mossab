import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'properties.db');

const db = new Database(dbPath);

// Hash password using SHA256
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Create users table
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    firstName TEXT,
    lastName TEXT,
    role TEXT DEFAULT 'user',
    status TEXT DEFAULT 'inactive',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
`);

// Check if admin exists
const adminExists = db.prepare("SELECT * FROM users WHERE email = ?").get('jennifer@auraestate.com');

if (!adminExists) {
  console.log('Creating default admin user...');
  const adminPassword = hashPassword('AuraEstate2026!');
  
  db.prepare(`
    INSERT INTO users (email, password, firstName, lastName, role, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('jennifer@auraestate.com', adminPassword, 'Jennifer', 'F', 'admin', 'active');
  
  console.log('✓ Default admin created:');
  console.log('  Email: jennifer@auraestate.com');
  console.log('  Password: AuraEstate2026!');
}

export { db, hashPassword };
