// Analyze permit data quality
const db = require('better-sqlite3')('./properties.db');

console.log('=== Permit Data Quality Analysis ===\n');

// Count total permits
const total = db.prepare('SELECT COUNT(*) as count FROM permits').get();
console.log('Total permits:', total.count);

// Find bad addresses (those without proper street types)
const streetTypes = ['STREET', 'ROAD', 'AVENUE', 'DRIVE', 'LANE', 'WAY', 'CIRCLE', 'COURT', 'PLACE', 'TERRACE', 'HILL', 'PATH', 'PARK', 'BROOK', 'GATE', 'PLAIN'];
const likeConditions = streetTypes.map(t => `address NOT LIKE '%${t}%'`).join(' AND ');

const badAddresses = db.prepare(`
  SELECT id, address, street_number, street_name, year 
  FROM permits 
  WHERE ${likeConditions}
`).all();

console.log('\nBad addresses (no valid street type):', badAddresses.length);
console.log('\nSample bad addresses:');
badAddresses.slice(0, 30).forEach(p => {
  console.log(`  [${p.id}] ${p.address}`);
});

// Analyze patterns in bad addresses
console.log('\n=== Patterns in bad addresses ===');

const startsWithZip = badAddresses.filter(p => p.address && p.address.match(/^024\d{2}/));
console.log('Starts with ZIP code:', startsWithZip.length);

const containsFloor = badAddresses.filter(p => p.address && p.address.match(/floor|flr/i));
console.log('Contains "floor/flr":', containsFloor.length);

const containsTrust = badAddresses.filter(p => p.address && p.address.match(/trust|llc|corp/i));
console.log('Contains "trust/llc/corp":', containsTrust.length);

const containsInstall = badAddresses.filter(p => p.address && p.address.match(/install|replace|repair|add/i));
console.log('Contains work descriptions:', containsInstall.length);

// Delete bad permits
console.log('\n=== Cleanup ===');
console.log(`Found ${badAddresses.length} invalid permit entries to clean up`);

// Show by year
const badByYear = db.prepare(`
  SELECT year, COUNT(*) as count 
  FROM permits 
  WHERE ${likeConditions}
  GROUP BY year 
  ORDER BY year DESC
`).all();
console.log('\nBad permits by year:');
badByYear.forEach(y => console.log(`  ${y.year || 'null'}: ${y.count}`));

db.close();
