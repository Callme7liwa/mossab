// Fix issues:
// 1. Merge date_submitted year into year column
// 2. Populate sale data in permit_mls_matches from properties table
// 3. Clean up partial addresses

const db = require('better-sqlite3')('./properties.db');

console.log('=== FIXING DATA ISSUES ===\n');

// 1. For permits with date_submitted but no year, extract year
console.log('1. Syncing year column from date_submitted...');
const updateYear = db.prepare(`
  UPDATE permits 
  SET year = strftime('%Y', date_submitted) 
  WHERE year IS NULL AND date_submitted IS NOT NULL AND date_submitted != ''
`);
const yearResult = updateYear.run();
console.log(`   Updated ${yearResult.changes} permits with year from date_submitted`);

// 2. Populate sale data from properties table
console.log('\n2. Populating sale data in permit_mls_matches...');
const updateSales = db.prepare(`
  UPDATE permit_mls_matches 
  SET 
    mls_sale_price = (SELECT closePrice FROM properties WHERE mlsId = permit_mls_matches.mls_list_no),
    mls_settled_date = (SELECT closeDate FROM properties WHERE mlsId = permit_mls_matches.mls_list_no)
  WHERE mls_sale_price IS NULL OR mls_sale_price = 0
`);
const salesResult = updateSales.run();
console.log(`   Updated ${salesResult.changes} matches with sale data`);

// Check how many now have sale data
const withSales = db.prepare(`
  SELECT COUNT(*) as c FROM permit_mls_matches 
  WHERE mls_sale_price > 0 AND mls_settled_date IS NOT NULL
`).get().c;
console.log(`   Matches with sale data: ${withSales}`);

// 3. Delete partial addresses (those without proper street type)
console.log('\n3. Cleaning up partial addresses...');
const partialAddresses = db.prepare(`
  SELECT id, address FROM permits 
  WHERE address NOT LIKE '% ROAD%' 
    AND address NOT LIKE '% STREET%' 
    AND address NOT LIKE '% AVENUE%' 
    AND address NOT LIKE '% LANE%' 
    AND address NOT LIKE '% DRIVE%'
    AND address NOT LIKE '% CIRCLE%'
    AND address NOT LIKE '% WAY%'
    AND address NOT LIKE '% TERRACE%'
    AND address NOT LIKE '% PLACE%'
    AND address NOT LIKE '% COURT%'
    AND address NOT LIKE '% PATH%'
    AND address NOT LIKE '% ST.%'
    AND address NOT LIKE '% RD.%'
    AND address NOT LIKE '% AVE.%'
`).all();

// Delete matches for these permits first
const deleteMatches = db.prepare('DELETE FROM permit_mls_matches WHERE permit_id = ?');
const deletePermit = db.prepare('DELETE FROM permits WHERE id = ?');

let deleted = 0;
for (const p of partialAddresses) {
  deleteMatches.run(p.id);
  deletePermit.run(p.id);
  deleted++;
}
console.log(`   Deleted ${deleted} permits with partial addresses`);

// 4. Verify by year now
console.log('\n4. PERMITS BY YEAR (after fix):');
const byYear = db.prepare(`
  SELECT year, COUNT(*) as count 
  FROM permits 
  WHERE year IS NOT NULL 
  GROUP BY year 
  ORDER BY year DESC
`).all();
byYear.forEach(y => console.log(`   ${y.year}: ${y.count}`));

// 5. Final stats
console.log('\n5. FINAL STATS:');
const total = db.prepare('SELECT COUNT(*) as c FROM permits').get().c;
const matched = db.prepare('SELECT COUNT(DISTINCT permit_id) as c FROM permit_mls_matches').get().c;
const withSalesNow = db.prepare(`SELECT COUNT(*) as c FROM permit_mls_matches WHERE mls_sale_price > 0`).get().c;

console.log(`   Total permits: ${total}`);
console.log(`   Matched to MLS: ${matched}`);
console.log(`   With sale data: ${withSalesNow}`);

console.log('\n=== FIXES COMPLETE ===');
db.close();
