// Check year type and fix the query
const db = require('better-sqlite3')('./properties.db');

console.log('Year type check:');
console.log(db.prepare('SELECT year, typeof(year) as t FROM permits WHERE year IS NOT NULL LIMIT 5').all());

console.log('\nCount with integer comparison:');
console.log('2015:', db.prepare('SELECT COUNT(*) as c FROM permits WHERE year = 2015').get().c);
console.log('2009:', db.prepare('SELECT COUNT(*) as c FROM permits WHERE year = 2009').get().c);

console.log('\nCount with string comparison:');
console.log('2015 as string:', db.prepare("SELECT COUNT(*) as c FROM permits WHERE CAST(year AS TEXT) = '2015'").get().c);

db.close();
