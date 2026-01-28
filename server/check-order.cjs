// Check date ordering issue
const db = require('better-sqlite3')('./properties.db');

console.log('Sample permits with year ordering:');
const samples = db.prepare(`
  SELECT year, date_submitted, 
         CAST(year AS TEXT) as y_str, 
         COALESCE(date_submitted, CAST(year AS TEXT) || '-01-01') as sort_val
  FROM permits 
  WHERE year IS NOT NULL 
  ORDER BY COALESCE(date_submitted, CAST(year AS TEXT) || '-01-01') DESC 
  LIMIT 30
`).all();

samples.forEach(r => console.log(`Year: ${r.year}, date_submitted: ${r.date_submitted || 'null'}, sort_val: ${r.sort_val}`));

console.log('\n\nCheck 2011 permits:');
const p2011 = db.prepare(`SELECT id, address, year, date_submitted FROM permits WHERE year = 2011 LIMIT 5`).all();
p2011.forEach(r => console.log(r));

db.close();
