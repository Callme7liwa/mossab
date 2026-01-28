// Clean up bad permit data
const db = require('better-sqlite3')('./properties.db');

console.log('=== Permit Data Cleanup ===\n');

// Count before
const beforeCount = db.prepare('SELECT COUNT(*) as count FROM permits').get();
console.log('Permits before cleanup:', beforeCount.count);

// Delete permits with empty addresses
const emptyDeleted = db.prepare("DELETE FROM permits WHERE address IS NULL OR address = '' OR TRIM(address) = ''").run();
console.log('Deleted empty addresses:', emptyDeleted.changes);

// Delete permits where address starts with ZIP code (malformed)
const zipDeleted = db.prepare("DELETE FROM permits WHERE address LIKE '024%' AND address NOT LIKE '024% %STREET%' AND address NOT LIKE '024% %ROAD%'").run();
console.log('Deleted ZIP-starting addresses:', zipDeleted.changes);

// Delete permits where address looks like a description (contains common work words at the start)
const descDeleted = db.prepare(`
  DELETE FROM permits WHERE 
    address LIKE '%install%' OR
    address LIKE '%replace%' OR  
    address LIKE '%repair%' OR
    address LIKE '%bathroom%' OR
    address LIKE '%floor%heat%' OR
    address LIKE '%ductless%' OR
    address LIKE '%pump system%' OR
    address LIKE '% nd Floor%' OR
    address LIKE '% rd Floor%' OR
    address LIKE '% st Floor%' OR
    address LIKE '% nd Flr%' OR
    address LIKE '% rd Flr%' OR
    address LIKE '% rd Level%'
`).run();
console.log('Deleted description-like addresses:', descDeleted.changes);

// Delete permits where address is just a name with ZIP (e.g., "02482 Custom, WELLESLEY, MA")
const nameDeleted = db.prepare(`
  DELETE FROM permits WHERE 
    address GLOB '024[0-9][0-9] [A-Z]*' AND
    address NOT GLOB '024[0-9][0-9] [0-9]*'
`).run();
console.log('Deleted name-based addresses:', nameDeleted.changes);

// Update abbreviated street types to full names for better matching
const updates = [
  { abbr: ' Rd,', full: ' ROAD,' },
  { abbr: ' St,', full: ' STREET,' },
  { abbr: ' Ave,', full: ' AVENUE,' },
  { abbr: ' Dr,', full: ' DRIVE,' },
  { abbr: ' Ln,', full: ' LANE,' },
  { abbr: ' Ct,', full: ' COURT,' },
  { abbr: ' Pl,', full: ' PLACE,' },
  { abbr: ' Cir,', full: ' CIRCLE,' },
  { abbr: ' Ter,', full: ' TERRACE,' },
];

let totalUpdated = 0;
for (const { abbr, full } of updates) {
  const result = db.prepare(`UPDATE permits SET address = REPLACE(address, ?, ?) WHERE address LIKE ?`).run(abbr, full, `%${abbr}%`);
  if (result.changes > 0) {
    console.log(`Updated ${result.changes} addresses: ${abbr} -> ${full}`);
    totalUpdated += result.changes;
  }
}
console.log('Total address fixes:', totalUpdated);

// Update street_name to uppercase for consistency
db.prepare("UPDATE permits SET street_name = UPPER(street_name) WHERE street_name IS NOT NULL").run();

// Count after
const afterCount = db.prepare('SELECT COUNT(*) as count FROM permits').get();
console.log('\nPermits after cleanup:', afterCount.count);
console.log('Total removed:', beforeCount.count - afterCount.count);

// Verify remaining bad entries
const stillBad = db.prepare(`
  SELECT COUNT(*) as count FROM permits 
  WHERE address NOT LIKE '%STREET%' AND address NOT LIKE '%ROAD%' AND address NOT LIKE '%AVENUE%' 
  AND address NOT LIKE '%DRIVE%' AND address NOT LIKE '%LANE%' AND address NOT LIKE '%WAY%' 
  AND address NOT LIKE '%CIRCLE%' AND address NOT LIKE '%COURT%' AND address NOT LIKE '%PLACE%' 
  AND address NOT LIKE '%TERRACE%' AND address NOT LIKE '%HILL%' AND address NOT LIKE '%PATH%'
  AND address NOT LIKE '%PARK%' AND address NOT LIKE '%BROOK%'
`).get();
console.log('Remaining without street type:', stillBad.count);

// Show samples
console.log('\nRemaining unusual addresses (sample):');
const samples = db.prepare(`
  SELECT address FROM permits 
  WHERE address NOT LIKE '%STREET%' AND address NOT LIKE '%ROAD%' AND address NOT LIKE '%AVENUE%' 
  AND address NOT LIKE '%DRIVE%' AND address NOT LIKE '%LANE%' AND address NOT LIKE '%WAY%' 
  AND address NOT LIKE '%CIRCLE%' AND address NOT LIKE '%COURT%' AND address NOT LIKE '%PLACE%' 
  AND address NOT LIKE '%TERRACE%' AND address NOT LIKE '%HILL%' AND address NOT LIKE '%PATH%'
  AND address NOT LIKE '%PARK%' AND address NOT LIKE '%BROOK%'
  LIMIT 15
`).all();
samples.forEach(s => console.log(`  ${s.address}`));

db.close();
console.log('\n✅ Cleanup complete!');
