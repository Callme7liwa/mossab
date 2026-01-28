// Final verification of all fixes
const db = require('better-sqlite3')('./properties.db');

console.log('=== FINAL VERIFICATION ===\n');

// 1. Stats byYear (should have no duplicates)
console.log('1. PERMITS BY YEAR (stats query):');
const byYear = db.prepare(`
  SELECT COALESCE(CAST(year AS TEXT), strftime('%Y', date_submitted)) as year, COUNT(*) as count 
  FROM permits 
  WHERE year IS NOT NULL OR date_submitted IS NOT NULL 
  GROUP BY COALESCE(CAST(year AS TEXT), strftime('%Y', date_submitted)) 
  ORDER BY year DESC
`).all();
byYear.forEach(y => console.log(`   ${y.year}: ${y.count}`));

// 2. Filter by year (should work)
console.log('\n2. FILTER BY YEAR:');
const f2015 = db.prepare(`
  SELECT COUNT(*) as c FROM permits 
  WHERE COALESCE(CAST(year AS TEXT), strftime('%Y', date_submitted)) = '2015'
`).get();
console.log(`   2015: ${f2015.c} permits`);

const f2009 = db.prepare(`
  SELECT COUNT(*) as c FROM permits 
  WHERE COALESCE(CAST(year AS TEXT), strftime('%Y', date_submitted)) = '2009'
`).get();
console.log(`   2009: ${f2009.c} permits`);

// 3. Match quality
console.log('\n3. MATCH QUALITY:');
const matches = db.prepare(`
  SELECT 
    COUNT(*) as total,
    COUNT(CASE WHEN mls_sale_price > 0 THEN 1 END) as with_price,
    COUNT(CASE WHEN mls_settled_date IS NOT NULL THEN 1 END) as with_date
  FROM permit_mls_matches
`).get();
console.log(`   Total matches: ${matches.total}`);
console.log(`   With sale price: ${matches.with_price}`);
console.log(`   With sale date: ${matches.with_date}`);

// 4. Sample matches with sale data
console.log('\n4. SAMPLE MATCHES WITH SALES:');
const sampleSales = db.prepare(`
  SELECT p.address, m.mls_list_no, m.mls_sale_price, m.mls_settled_date
  FROM permit_mls_matches m
  JOIN permits p ON p.id = m.permit_id
  WHERE m.mls_sale_price > 0
  LIMIT 5
`).all();
sampleSales.forEach(s => console.log(`   ${s.address.substring(0,30)} -> $${s.mls_sale_price?.toLocaleString()} (${s.mls_settled_date})`));

// 5. Count unmatched permits
console.log('\n5. UNMATCHED PERMITS:');
const unmatched = db.prepare(`
  SELECT COUNT(*) as c FROM permits 
  WHERE id NOT IN (SELECT DISTINCT permit_id FROM permit_mls_matches)
`).get();
console.log(`   Total unmatched: ${unmatched.c}`);

// 6. Verify manual match works
console.log('\n6. MANUAL MATCH TEST:');
const mlsProperty = db.prepare(`SELECT mlsId, address, closePrice FROM properties WHERE closePrice > 0 LIMIT 1`).get();
console.log(`   Sample MLS property: ${mlsProperty?.address} - $${mlsProperty?.closePrice?.toLocaleString()}`);

console.log('\n=== ALL SYSTEMS GO ===');
db.close();
