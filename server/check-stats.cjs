// Check stats byYear query
const db = require('better-sqlite3')('./properties.db');

console.log('Stats byYear query result:');
const byYear = db.prepare(`
  SELECT COALESCE(CAST(year AS TEXT), strftime('%Y', date_submitted)) as year, COUNT(*) as count 
  FROM permits 
  WHERE year IS NOT NULL OR date_submitted IS NOT NULL 
  GROUP BY COALESCE(CAST(year AS TEXT), strftime('%Y', date_submitted)) 
  ORDER BY year DESC
`).all();

byYear.forEach(r => console.log(r));

db.close();
