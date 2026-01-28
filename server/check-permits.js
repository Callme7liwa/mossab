import db from './db.js';

console.log('Checking permits table...\n');

try {
  const count = db.prepare('SELECT COUNT(*) as c FROM permits').get();
  console.log('Permits table exists, count:', count.c);
  
  const byYear = db.prepare(`
    SELECT strftime('%Y', date_submitted) as year, COUNT(*) as c 
    FROM permits 
    WHERE date_submitted IS NOT NULL 
    GROUP BY year 
    ORDER BY year DESC
  `).all();
  console.log('\nBy year:', byYear);
  
  const byType = db.prepare(`
    SELECT property_type, COUNT(*) as c 
    FROM permits 
    GROUP BY property_type
  `).all();
  console.log('\nBy property type:', byType);
  
  const byWork = db.prepare(`
    SELECT type_of_work, COUNT(*) as c 
    FROM permits 
    WHERE type_of_work IS NOT NULL 
    GROUP BY type_of_work 
    ORDER BY c DESC 
    LIMIT 10
  `).all();
  console.log('\nBy work type (top 10):', byWork);
  
} catch(e) {
  console.log('Error:', e.message);
}
