// Fix partial addresses by adding missing street types
const db = require('better-sqlite3')('./properties.db');

console.log('=== Fixing Partial Addresses ===\n');

// Known Wellesley street name to type mappings (from MLS data)
const streetNameToType = {};

// Get street names from properties table
const mlsStreets = db.prepare(`
  SELECT DISTINCT 
    UPPER(SUBSTR(address, INSTR(address, ' ') + 1)) as street_part,
    address
  FROM properties 
  WHERE city = 'Wellesley'
`).all();

// Build a mapping of street names to full addresses
console.log('Building street name mapping from MLS data...');
for (const prop of mlsStreets) {
  // Extract just the street name portion (before the comma or city)
  const match = prop.address?.match(/^\d+[A-Z]?\s+(.+?),/i);
  if (match) {
    const streetFull = match[1].toUpperCase().trim();
    // Extract name without type
    const parts = streetFull.match(/^(.+?)\s+(STREET|ROAD|AVENUE|DRIVE|LANE|WAY|CIRCLE|COURT|PLACE|TERRACE|HILL|PATH|PARK|BROOK)$/i);
    if (parts) {
      streetNameToType[parts[1].toUpperCase()] = parts[2].toUpperCase();
    }
  }
}

console.log('Found', Object.keys(streetNameToType).length, 'unique street name mappings');
console.log('Sample:', Object.entries(streetNameToType).slice(0, 10));

// Get permits with partial addresses (no street type)
const partialAddresses = db.prepare(`
  SELECT id, address, street_number, street_name FROM permits 
  WHERE address NOT LIKE '%STREET%' AND address NOT LIKE '%ROAD%' AND address NOT LIKE '%AVENUE%' 
  AND address NOT LIKE '%DRIVE%' AND address NOT LIKE '%LANE%' AND address NOT LIKE '%WAY%' 
  AND address NOT LIKE '%CIRCLE%' AND address NOT LIKE '%COURT%' AND address NOT LIKE '%PLACE%' 
  AND address NOT LIKE '%TERRACE%' AND address NOT LIKE '%HILL%' AND address NOT LIKE '%PATH%'
  AND address NOT LIKE '%PARK%' AND address NOT LIKE '%BROOK%'
  AND address IS NOT NULL AND address != ''
`).all();

console.log('\nPartial addresses to fix:', partialAddresses.length);

// Try to fix each one
const updateStmt = db.prepare('UPDATE permits SET address = ?, street_name = ? WHERE id = ?');
let fixed = 0;
let notFound = 0;

for (const permit of partialAddresses) {
  if (!permit.address) continue;
  
  // Extract street name from address
  const match = permit.address.match(/^\d+[A-Z]?\s+(.+?)(?:,|$)/i);
  if (!match) continue;
  
  const streetName = match[1].toUpperCase().trim();
  const streetType = streetNameToType[streetName];
  
  if (streetType) {
    const newAddress = permit.address.replace(
      new RegExp(`(\\d+[A-Z]?\\s+${streetName.replace(/\s+/g, '\\s+')})`, 'i'),
      `$1 ${streetType}`
    );
    
    if (newAddress !== permit.address) {
      updateStmt.run(newAddress, `${streetName} ${streetType}`, permit.id);
      fixed++;
    }
  } else {
    notFound++;
  }
}

console.log('Fixed:', fixed);
console.log('Could not match:', notFound);

// Re-check remaining
const stillBad = db.prepare(`
  SELECT COUNT(*) as count FROM permits 
  WHERE address NOT LIKE '%STREET%' AND address NOT LIKE '%ROAD%' AND address NOT LIKE '%AVENUE%' 
  AND address NOT LIKE '%DRIVE%' AND address NOT LIKE '%LANE%' AND address NOT LIKE '%WAY%' 
  AND address NOT LIKE '%CIRCLE%' AND address NOT LIKE '%COURT%' AND address NOT LIKE '%PLACE%' 
  AND address NOT LIKE '%TERRACE%' AND address NOT LIKE '%HILL%' AND address NOT LIKE '%PATH%'
  AND address NOT LIKE '%PARK%' AND address NOT LIKE '%BROOK%'
`).get();
console.log('\nRemaining incomplete:', stillBad.count);

// Show some still-remaining samples
console.log('\nStill incomplete (sample):');
const samples = db.prepare(`
  SELECT address FROM permits 
  WHERE address NOT LIKE '%STREET%' AND address NOT LIKE '%ROAD%' AND address NOT LIKE '%AVENUE%' 
  AND address NOT LIKE '%DRIVE%' AND address NOT LIKE '%LANE%' AND address NOT LIKE '%WAY%' 
  AND address NOT LIKE '%CIRCLE%' AND address NOT LIKE '%COURT%' AND address NOT LIKE '%PLACE%' 
  AND address NOT LIKE '%TERRACE%' AND address NOT LIKE '%HILL%' AND address NOT LIKE '%PATH%'
  AND address NOT LIKE '%PARK%' AND address NOT LIKE '%BROOK%'
  LIMIT 20
`).all();
samples.forEach(s => console.log(`  ${s.address}`));

db.close();
