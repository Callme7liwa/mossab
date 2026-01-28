// Final cleanup of garbage addresses that are really descriptions
const Database = require('better-sqlite3');
const db = new Database('./properties.db');

console.log('=== Final Garbage Cleanup ===\n');

// Patterns that indicate garbage (descriptions, not addresses)
const garbagePatterns = [
  '%REALTY TRUST%',
  '% FLOOR %',
  '%1 ST FLOOR%',
  '%2 ND FLOOR%', 
  '%3 RD FLOOR%',
  '%DORMER%',
  '%PARTITION%',
  '%AMP ELECTRIC%',
  '%ADDITION%',
  '%BEDROOM%',
  '%DECK INCLUDING%',
  '% SQ FT %',
  '% SF %',
  '%GYM SPACE%',
  '%LAUNDRY%',
  '%ENTRY DECK%',
  '%EXISTING HOME%',
  '%REFINISH%',
  '%NEW CONSTRUCTION OF%',
  '%DEMOLITION%',
  '%STAIRS%'
];

// Build WHERE clause
const whereClauses = garbagePatterns.map(p => `address LIKE '${p}'`).join(' OR ');
const query = `SELECT id, address FROM permits WHERE ${whereClauses}`;

console.log('Finding garbage entries...');
const garbage = db.prepare(query).all();
console.log(`Found ${garbage.length} garbage entries:\n`);

garbage.forEach(r => console.log(`  ${r.id}: ${r.address}`));

if (garbage.length > 0) {
  const ids = garbage.map(r => r.id);
  
  // Delete from matches first
  const matchDel = db.prepare(`DELETE FROM permit_mls_matches WHERE permit_id IN (${ids.join(',')})`);
  const matchResult = matchDel.run();
  console.log(`\nDeleted ${matchResult.changes} matches`);
  
  // Delete permits
  const permitDel = db.prepare(`DELETE FROM permits WHERE id IN (${ids.join(',')})`);
  const permitResult = permitDel.run();
  console.log(`Deleted ${permitResult.changes} garbage permits`);
}

// Now check for addresses that don't start with a number (likely garbage)
console.log('\n=== Addresses not starting with a number ===');
const noNumber = db.prepare(`
  SELECT id, address 
  FROM permits 
  WHERE address NOT LIKE '1%' 
    AND address NOT LIKE '2%' 
    AND address NOT LIKE '3%' 
    AND address NOT LIKE '4%' 
    AND address NOT LIKE '5%' 
    AND address NOT LIKE '6%' 
    AND address NOT LIKE '7%' 
    AND address NOT LIKE '8%' 
    AND address NOT LIKE '9%'
    AND address NOT LIKE '0%'
`).all();

console.log(`Found ${noNumber.length} entries not starting with number:`);
noNumber.slice(0, 50).forEach(r => console.log(`  ${r.id}: ${r.address}`));

if (noNumber.length > 0 && noNumber.length < 500) {
  console.log('\nDeleting these...');
  const ids = noNumber.map(r => r.id);
  db.prepare(`DELETE FROM permit_mls_matches WHERE permit_id IN (${ids.join(',')})`).run();
  const result = db.prepare(`DELETE FROM permits WHERE id IN (${ids.join(',')})`).run();
  console.log(`Deleted ${result.changes} permits without valid street number`);
}

// Final stats
console.log('\n=== Final Stats ===');
const total = db.prepare('SELECT COUNT(*) as c FROM permits').get().c;
const matched = db.prepare('SELECT COUNT(*) as c FROM permit_mls_matches').get().c;
console.log(`Total permits: ${total}`);
console.log(`Matched to MLS: ${matched}`);

db.close();
console.log('\nDone!');
