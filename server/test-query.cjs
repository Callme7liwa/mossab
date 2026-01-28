// Test the permit query with COALESCE sorting
const db = require('better-sqlite3')('./properties.db');

console.log('=== TESTING PERMIT QUERY ===\n');

console.log('First 10 permits by COALESCE sort (newest first):');
const newest = db.prepare(`
  SELECT id, address, year, date_submitted 
  FROM permits 
  ORDER BY COALESCE(date_submitted, year || '-01-01') DESC 
  LIMIT 10
`).all();
newest.forEach(r => console.log(`  ${r.year || 'null'} | ${r.date_submitted || 'null'} | ${r.address?.substring(0,40)}`));

console.log('\nOldest 10 permits:');
const oldest = db.prepare(`
  SELECT id, address, year, date_submitted 
  FROM permits 
  WHERE year IS NOT NULL
  ORDER BY COALESCE(date_submitted, year || '-01-01') ASC 
  LIMIT 10
`).all();
oldest.forEach(r => console.log(`  ${r.year} | ${r.date_submitted || 'null'} | ${r.address?.substring(0,40)}`));

console.log('\nPermits from 2015:');
const p2015 = db.prepare(`
  SELECT COUNT(*) as c FROM permits 
  WHERE COALESCE(year, strftime('%Y', date_submitted)) = '2015'
`).get();
console.log(`  Count: ${p2015.c}`);

console.log('\nPermits from 2009:');
const p2009 = db.prepare(`
  SELECT COUNT(*) as c FROM permits 
  WHERE COALESCE(year, strftime('%Y', date_submitted)) = '2009'
`).get();
console.log(`  Count: ${p2009.c}`);

console.log('\n=== TEST COMPLETE ===');
db.close();
