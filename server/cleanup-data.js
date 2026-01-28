import 'dotenv/config';
import db from './db.js';

console.log('=== CLEANING DATABASE ===\n');

// 1. Delete empty addresses
console.log('1. Deleting empty addresses...');
const r1 = db.prepare(`DELETE FROM permits WHERE address_normalized IS NULL OR address_normalized = '' OR TRIM(address_normalized) = ''`).run();
console.log(`   Deleted: ${r1.changes} empty permits`);

// 2. Delete bad matches (sale date before permit date)
console.log('\n2. Deleting impossible matches (sale before permit)...');
const r2 = db.prepare(`
  DELETE FROM permit_mls_matches 
  WHERE permit_id IN (
    SELECT m.permit_id 
    FROM permit_mls_matches m 
    JOIN permits p ON p.id = m.permit_id 
    WHERE p.date_submitted IS NOT NULL 
    AND m.mls_settled_date IS NOT NULL 
    AND julianday(m.mls_settled_date) < julianday(p.date_submitted)
  )
`).run();
console.log(`   Deleted: ${r2.changes} bad matches`);

// 3. Summary
console.log('\n=== AFTER CLEANUP ===');
console.log('Remaining permits:', db.prepare('SELECT COUNT(*) as c FROM permits').get().c);
console.log('Remaining matches:', db.prepare('SELECT COUNT(*) as c FROM permit_mls_matches').get().c);
console.log('With dates:', db.prepare('SELECT COUNT(*) as c FROM permits WHERE date_submitted IS NOT NULL').get().c);
console.log('Match rate:', 
  (db.prepare('SELECT COUNT(DISTINCT permit_id) as c FROM permit_mls_matches').get().c / 
   db.prepare('SELECT COUNT(*) as c FROM permits').get().c * 100).toFixed(1) + '%'
);

console.log('\n✅ Cleanup complete!');
