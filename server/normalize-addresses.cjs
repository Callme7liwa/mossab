// Comprehensive permit address cleanup
const db = require('better-sqlite3')('./properties.db');

console.log('=== Comprehensive Address Cleanup ===\n');

// Step 1: Normalize case and fix abbreviated street types at end of address
const abbreviations = [
  { pattern: /\sRd$/i, replacement: ' ROAD' },
  { pattern: /\sSt$/i, replacement: ' STREET' },
  { pattern: /\sAve$/i, replacement: ' AVENUE' },
  { pattern: /\sDr$/i, replacement: ' DRIVE' },
  { pattern: /\sLn$/i, replacement: ' LANE' },
  { pattern: /\sCt$/i, replacement: ' COURT' },
  { pattern: /\sPl$/i, replacement: ' PLACE' },
  { pattern: /\sCir$/i, replacement: ' CIRCLE' },
  { pattern: /\sTer$/i, replacement: ' TERRACE' },
  { pattern: /\sRd,/i, replacement: ' ROAD,' },
  { pattern: /\sSt,/i, replacement: ' STREET,' },
  { pattern: /\sAve,/i, replacement: ' AVENUE,' },
  { pattern: /\sDr,/i, replacement: ' DRIVE,' },
  { pattern: /\sLn,/i, replacement: ' LANE,' },
  { pattern: /\sCt,/i, replacement: ' COURT,' },
  { pattern: /\sPl,/i, replacement: ' PLACE,' },
  { pattern: /\sCir,/i, replacement: ' CIRCLE,' },
  { pattern: /\sTer,/i, replacement: ' TERRACE,' },
];

// Get all permits
const permits = db.prepare('SELECT id, address FROM permits WHERE address IS NOT NULL').all();
console.log('Processing', permits.length, 'permits...');

const updateStmt = db.prepare('UPDATE permits SET address = UPPER(?) WHERE id = ?');

let updated = 0;
for (const permit of permits) {
  let newAddr = permit.address.toUpperCase();
  
  for (const { pattern, replacement } of abbreviations) {
    newAddr = newAddr.replace(pattern, replacement);
  }
  
  // Add WELLESLEY, MA if missing
  if (!newAddr.includes('WELLESLEY')) {
    newAddr = newAddr.replace(/,?\s*$/, ', WELLESLEY, MA');
  }
  
  if (newAddr !== permit.address) {
    updateStmt.run(newAddr, permit.id);
    updated++;
  }
}
console.log('Normalized', updated, 'addresses');

// Step 2: Delete garbage entries
const garbage = db.prepare(`
  DELETE FROM permits WHERE 
    address LIKE '%Below is all from%' OR
    address LIKE '%S&N List%' OR
    address LIKE '%PERMIT%NOT%REQUIRED%' OR
    address LIKE '%Wellesley Realty Trust%' OR
    UPPER(address) NOT LIKE '%WELLESLEY%' AND address NOT LIKE '%024%'
`).run();
console.log('Deleted garbage:', garbage.changes);

// Step 3: Show stats
const total = db.prepare('SELECT COUNT(*) as count FROM permits').get();
console.log('\nTotal permits now:', total.count);

// Check valid vs incomplete
const valid = db.prepare(`
  SELECT COUNT(*) as count FROM permits 
  WHERE address LIKE '%STREET%' OR address LIKE '%ROAD%' OR address LIKE '%AVENUE%' 
  OR address LIKE '%DRIVE%' OR address LIKE '%LANE%' OR address LIKE '%WAY%' 
  OR address LIKE '%CIRCLE%' OR address LIKE '%COURT%' OR address LIKE '%PLACE%' 
  OR address LIKE '%TERRACE%' OR address LIKE '%HILL%' OR address LIKE '%PATH%'
  OR address LIKE '%PARK%' OR address LIKE '%BROOK%'
`).get();
console.log('Valid addresses:', valid.count);
console.log('Incomplete/partial:', total.count - valid.count);

// By year
console.log('\nBy year:');
const byYear = db.prepare(`
  SELECT year, COUNT(*) as count FROM permits 
  WHERE year IS NOT NULL
  GROUP BY year 
  ORDER BY year DESC
`).all();
byYear.forEach(y => console.log(`  ${y.year}: ${y.count}`));

db.close();
