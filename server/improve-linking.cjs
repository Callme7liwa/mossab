// Check address formats and improve linking
const db = require('better-sqlite3')('./properties.db');

console.log('=== Address Format Analysis ===\n');

// Sample permit addresses
console.log('Sample permit addresses:');
const permits = db.prepare('SELECT address, address_normalized, street_number, street_name FROM permits LIMIT 5').all();
permits.forEach(p => console.log('  ', p));

// Sample property addresses
console.log('\nSample property addresses (Wellesley):');
const props = db.prepare("SELECT address, city FROM properties WHERE city = 'Wellesley' LIMIT 5").all();
props.forEach(p => console.log('  ', p));

// Try a specific match
console.log('\n=== Testing Match Logic ===');
const testPermit = db.prepare("SELECT id, address, address_normalized, street_number, street_name FROM permits WHERE address LIKE '%MELLON%' LIMIT 1").get();
console.log('Test permit:', testPermit);

if (testPermit) {
  const testProp = db.prepare("SELECT mlsId, address FROM properties WHERE UPPER(address) LIKE '%MELLON%' AND city = 'Wellesley' LIMIT 5").all();
  console.log('Matching properties:', testProp);
}

// Re-link with better logic
console.log('\n=== Re-linking with improved logic ===');

// Clear existing matches and re-link
db.prepare('DELETE FROM permit_mls_matches').run();
console.log('Cleared existing matches');

const allPermits = db.prepare('SELECT id, address, street_number, street_name FROM permits WHERE address IS NOT NULL').all();
console.log('Processing', allPermits.length, 'permits...');

const insertMatch = db.prepare('INSERT INTO permit_mls_matches (permit_id, mls_list_no, match_type, match_score) VALUES (?, ?, ?, ?)');

let linked = 0;
for (const permit of allPermits) {
  // Extract just the street number and name from permit address
  const match = permit.address.match(/^(\d+[A-Z]?)\s+(.+?)(?:,|\s+WELLESLEY)/i);
  if (!match) continue;
  
  const streetNum = match[1];
  const streetName = match[2].trim().toUpperCase();
  
  // Search in properties
  const property = db.prepare(`
    SELECT mlsId FROM properties 
    WHERE UPPER(address) LIKE ? 
    AND city = 'Wellesley'
    LIMIT 1
  `).get(`${streetNum} ${streetName}%`);
  
  if (property) {
    insertMatch.run(permit.id, property.mlsId, 'exact', 1.0);
    linked++;
  }
}

console.log('Linked:', linked, 'permits to MLS');

// Show stats
const totalMatches = db.prepare('SELECT COUNT(*) as count FROM permit_mls_matches').get();
console.log('Total matches:', totalMatches.count);

db.close();
