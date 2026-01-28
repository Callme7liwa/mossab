// Comprehensive verification of permit data
const db = require('better-sqlite3')('./properties.db');

console.log('=== PERMIT DATABASE VERIFICATION ===\n');

// 1. Total counts
const total = db.prepare('SELECT COUNT(*) as c FROM permits').get().c;
const matched = db.prepare('SELECT COUNT(DISTINCT permit_id) as c FROM permit_mls_matches').get().c;
const withYear = db.prepare("SELECT COUNT(*) as c FROM permits WHERE year IS NOT NULL").get().c;
const withDateSubmitted = db.prepare("SELECT COUNT(*) as c FROM permits WHERE date_submitted IS NOT NULL AND date_submitted != ''").get().c;

console.log('1. COUNTS:');
console.log(`   Total permits: ${total}`);
console.log(`   Matched to MLS: ${matched} (${(matched/total*100).toFixed(1)}%)`);
console.log(`   With year column: ${withYear}`);
console.log(`   With date_submitted: ${withDateSubmitted}`);

// 2. Check for garbage addresses
const garbagePatterns = [
  "SELECT COUNT(*) as c FROM permits WHERE address LIKE '%FLOOR%'",
  "SELECT COUNT(*) as c FROM permits WHERE address LIKE '%EXISTING%'",
  "SELECT COUNT(*) as c FROM permits WHERE address LIKE '%ADDITION%'",
  "SELECT COUNT(*) as c FROM permits WHERE address LIKE '%REALTY TRUST%'",
  "SELECT COUNT(*) as c FROM permits WHERE address LIKE '%SQ FT%'",
  "SELECT COUNT(*) as c FROM permits WHERE address NOT LIKE '% ROAD%' AND address NOT LIKE '% STREET%' AND address NOT LIKE '% AVENUE%' AND address NOT LIKE '% LANE%' AND address NOT LIKE '% DRIVE%' AND address NOT LIKE '% CIRCLE%' AND address NOT LIKE '% WAY%' AND address NOT LIKE '% TERRACE%' AND address NOT LIKE '% PLACE%' AND address NOT LIKE '% COURT%' AND address NOT LIKE '% PATH%'"
];

console.log('\n2. DATA QUALITY:');
const remaining = db.prepare(garbagePatterns[5]).get().c;
console.log(`   Addresses missing street type: ${remaining}`);

// 3. By Year breakdown (matches stats query)
console.log('\n3. PERMITS BY YEAR (COALESCE logic):');
const byYear = db.prepare(`
  SELECT COALESCE(year, strftime('%Y', date_submitted)) as year, COUNT(*) as count 
  FROM permits 
  WHERE year IS NOT NULL OR date_submitted IS NOT NULL 
  GROUP BY COALESCE(year, strftime('%Y', date_submitted)) 
  ORDER BY year DESC
`).all();

byYear.forEach(y => console.log(`   ${y.year}: ${y.count}`));

// 4. Check for null years
const nullYear = db.prepare("SELECT COUNT(*) as c FROM permits WHERE year IS NULL AND (date_submitted IS NULL OR date_submitted = '')").get().c;
console.log(`\n4. PERMITS WITHOUT ANY DATE: ${nullYear}`);

// 5. Sample garbage addresses remaining
console.log('\n5. SAMPLE GARBAGE ADDRESSES (if any):');
const garbage = db.prepare(`
  SELECT address FROM permits 
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
  LIMIT 20
`).all();
garbage.forEach(g => console.log(`   - ${g.address}`));

// 6. Verify match data
console.log('\n6. MATCH QUALITY:');
const matchStats = db.prepare(`
  SELECT 
    COUNT(*) as total,
    COUNT(CASE WHEN match_score >= 0.95 THEN 1 END) as high_confidence,
    COUNT(CASE WHEN mls_sale_price > 0 THEN 1 END) as with_sale_price,
    COUNT(CASE WHEN mls_settled_date IS NOT NULL THEN 1 END) as with_sale_date
  FROM permit_mls_matches
`).get();
console.log(`   Total matches: ${matchStats.total}`);
console.log(`   High confidence (95%+): ${matchStats.high_confidence}`);
console.log(`   With sale price: ${matchStats.with_sale_price}`);
console.log(`   With sale date: ${matchStats.with_sale_date}`);

// 7. Sample matches to verify
console.log('\n7. SAMPLE MATCHES:');
const sampleMatches = db.prepare(`
  SELECT p.address, m.mls_list_no, m.mls_sale_price, m.mls_settled_date, m.match_score
  FROM permit_mls_matches m
  JOIN permits p ON p.id = m.permit_id
  LIMIT 5
`).all();
sampleMatches.forEach(m => console.log(`   ${m.address} -> MLS#${m.mls_list_no} Score:${m.match_score}`));

console.log('\n=== VERIFICATION COMPLETE ===');
db.close();
