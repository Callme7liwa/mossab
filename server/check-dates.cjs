// Check date fields
const db = require('better-sqlite3')('./properties.db');

console.log('With date_submitted:', db.prepare("SELECT COUNT(*) as c FROM permits WHERE date_submitted IS NOT NULL AND date_submitted != ''").get());
console.log('With year column:', db.prepare("SELECT COUNT(*) as c FROM permits WHERE year IS NOT NULL").get());

// Sample data
console.log('\nSample permits:');
const samples = db.prepare("SELECT id, address, date_submitted, year, record_status FROM permits LIMIT 10").all();
samples.forEach(s => console.log(s));

db.close();
