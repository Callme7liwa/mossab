import 'dotenv/config';
import db from './db.js';

console.log('=== DATA QUALITY ANALYSIS ===\n');

// Date analysis
console.log('DATE ANALYSIS:');
console.log('  Permits with date:', db.prepare('SELECT COUNT(*) as c FROM permits WHERE date_submitted IS NOT NULL').get().c);
console.log('  Permits without date:', db.prepare('SELECT COUNT(*) as c FROM permits WHERE date_submitted IS NULL').get().c);

console.log('\nSample permit dates:');
db.prepare('SELECT date_submitted, address FROM permits WHERE date_submitted IS NOT NULL LIMIT 5').all().forEach(r => {
  console.log('  ', r.date_submitted, '-', r.address?.substring(0, 40));
});

// Check for weird dates
console.log('\nWeird dates (year < 2000 or > 2030):');
const weirdDates = db.prepare(`
  SELECT date_submitted, address FROM permits 
  WHERE date_submitted IS NOT NULL 
  AND (CAST(strftime('%Y', date_submitted) as INTEGER) < 2000 
       OR CAST(strftime('%Y', date_submitted) as INTEGER) > 2030)
  LIMIT 5
`).all();
weirdDates.forEach(r => console.log('  ', r.date_submitted, '-', r.address?.substring(0, 40)));

// Empty address analysis
console.log('\n\nADDRESS ANALYSIS:');
console.log('  Empty/null addresses:', db.prepare("SELECT COUNT(*) as c FROM permits WHERE address_normalized IS NULL OR address_normalized = ''").get().c);

// Match date issues
console.log('\n\nMATCH DATE ISSUES:');
const badMatches = db.prepare(`
  SELECT p.address, p.date_submitted, m.mls_settled_date,
         julianday(m.mls_settled_date) - julianday(p.date_submitted) as days
  FROM permits p
  JOIN permit_mls_matches m ON m.permit_id = p.id
  WHERE p.date_submitted IS NOT NULL AND m.mls_settled_date IS NOT NULL
  AND julianday(m.mls_settled_date) - julianday(p.date_submitted) < 0
  LIMIT 5
`).all();
console.log('  Permits where sale date < permit date (negative days):');
badMatches.forEach(r => {
  console.log(`    ${r.address?.substring(0, 30)}: permit=${r.date_submitted}, sold=${r.mls_settled_date}, days=${r.days}`);
});

// Count of bad matches
const badCount = db.prepare(`
  SELECT COUNT(*) as c
  FROM permits p
  JOIN permit_mls_matches m ON m.permit_id = p.id
  WHERE p.date_submitted IS NOT NULL AND m.mls_settled_date IS NOT NULL
  AND julianday(m.mls_settled_date) - julianday(p.date_submitted) < 0
`).get().c;
console.log(`  Total bad matches (sale before permit): ${badCount}`);

console.log('\n=== DONE ===');
