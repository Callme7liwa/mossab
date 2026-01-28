// Test permit sync functionality
import Database from 'better-sqlite3';

const db = new Database('./properties.db');

console.log('=== Testing Permit Sync Functionality ===\n');

// Get a valid token from sessions table in properties.db
const session = db.prepare("SELECT s.token, u.email FROM sessions s JOIN users u ON s.user_id = u.id ORDER BY s.created_at DESC LIMIT 1").get();
console.log('1. Active session:', session ? `${session.email} (token: ${session.token.substring(0,15)}...)` : 'None');

// Check permit tables
console.log('\n2. Permit stats:');
const permitCount = db.prepare('SELECT COUNT(*) as count FROM permits').get();
console.log('   Total permits:', permitCount.count);

try {
  const linkedCount = db.prepare('SELECT COUNT(DISTINCT permit_id) as count FROM permit_mls_matches').get();
  console.log('   Linked to MLS:', linkedCount.count);
} catch (e) {
  console.log('   Linked to MLS: table not found');
}

const byYear = db.prepare(`
  SELECT year, COUNT(*) as count 
  FROM permits 
  WHERE year IS NOT NULL
  GROUP BY year 
  ORDER BY year DESC
  LIMIT 5
`).all();
console.log('   Recent years:', byYear.map(y => `${y.year}: ${y.count}`).join(', '));

// Test the endpoint
console.log('\n3. Testing API endpoint...');
if (session) {
  fetch('http://localhost:3001/api/sync/permits/status', {
    headers: { 'Authorization': `Bearer ${session.token}` }
  })
  .then(r => {
    console.log('   Response status:', r.status);
    return r.json();
  })
  .then(data => {
    console.log('   API Response:', JSON.stringify(data, null, 2));
  })
  .catch(e => {
    console.log('   Error:', e.message);
  });
} else {
  console.log('   No active session - login required first');
}

db.close();
