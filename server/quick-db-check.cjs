// Quick test of database structure
const db = require('better-sqlite3')('./properties.db');

console.log('=== Database Structure ===\n');

// List tables
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables:', tables.map(t => t.name).join(', '));

// Check permits
console.log('\n=== Permits ===');
const permitCount = db.prepare('SELECT COUNT(*) as count FROM permits').get();
console.log('Total permits:', permitCount.count);

const byYear = db.prepare("SELECT year, COUNT(*) as count FROM permits WHERE year IS NOT NULL GROUP BY year ORDER BY year DESC LIMIT 5").all();
console.log('By year:', byYear);

// Check permit_mls_matches
try {
  const linked = db.prepare('SELECT COUNT(DISTINCT permit_id) as count FROM permit_mls_matches').get();
  console.log('Linked to MLS:', linked.count);
} catch (e) {
  console.log('permit_mls_matches table not found');
}

db.close();
