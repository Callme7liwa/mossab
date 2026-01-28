import 'dotenv/config';
import db from './db.js';

console.log('=== DEDUPLICATING PERMITS DATABASE ===\n');

// Step 1: Count current state
const beforePermits = db.prepare('SELECT COUNT(*) as c FROM permits').get().c;
const beforeUniqueAddresses = db.prepare('SELECT COUNT(DISTINCT address_normalized) as c FROM permits').get().c;
const beforeMatches = db.prepare('SELECT COUNT(*) as c FROM permit_mls_matches').get().c;

console.log('BEFORE:');
console.log(`  Total permits: ${beforePermits}`);
console.log(`  Unique addresses: ${beforeUniqueAddresses}`);
console.log(`  Total matches: ${beforeMatches}`);
console.log(`  Duplicates: ${beforePermits - beforeUniqueAddresses}\n`);

// Step 2: Create deduplicated permits table
console.log('Step 1: Creating deduplicated permits...');

db.exec(`
  CREATE TABLE IF NOT EXISTS permits_dedup AS
  SELECT * FROM permits
  WHERE id IN (
    SELECT MIN(id) as id FROM permits 
    GROUP BY address_normalized
  )
`);

const dedupCount = db.prepare('SELECT COUNT(*) as c FROM permits_dedup').get().c;
console.log(`  Deduplicated permits: ${dedupCount}\n`);

// Step 3: Create a mapping from old permit IDs to new (kept) IDs
console.log('Step 2: Creating ID mapping for matches...');

// Get the kept permit ID for each address
const idMapping = db.prepare(`
  SELECT p.id as old_id, pd.id as new_id, p.address_normalized
  FROM permits p
  JOIN permits_dedup pd ON p.address_normalized = pd.address_normalized
  WHERE p.id != pd.id
`).all();

console.log(`  Found ${idMapping.length} permit IDs that need remapping\n`);

// Step 4: Update matches to point to deduplicated permits
console.log('Step 3: Updating matches to use deduplicated permit IDs...');

const updateMatch = db.prepare('UPDATE permit_mls_matches SET permit_id = ? WHERE permit_id = ?');
let remapped = 0;
for (const m of idMapping) {
  const result = updateMatch.run(m.new_id, m.old_id);
  remapped += result.changes;
}
console.log(`  Remapped ${remapped} matches\n`);

// Step 5: Remove duplicate matches (keep highest score per permit)
console.log('Step 4: Keeping only best match per permit...');

const beforeMatchDedup = db.prepare('SELECT COUNT(*) as c FROM permit_mls_matches').get().c;

db.exec(`
  DELETE FROM permit_mls_matches 
  WHERE id NOT IN (
    SELECT id FROM (
      SELECT id, permit_id, match_score,
             ROW_NUMBER() OVER (PARTITION BY permit_id ORDER BY match_score DESC, id ASC) as rn
      FROM permit_mls_matches
    ) WHERE rn = 1
  )
`);

const afterMatchDedup = db.prepare('SELECT COUNT(*) as c FROM permit_mls_matches').get().c;
console.log(`  Matches before: ${beforeMatchDedup}`);
console.log(`  Matches after: ${afterMatchDedup}`);
console.log(`  Removed: ${beforeMatchDedup - afterMatchDedup} duplicate matches\n`);

// Step 6: Replace permits table with deduplicated version
console.log('Step 5: Replacing permits table with deduplicated data...');

db.exec(`
  DROP TABLE IF EXISTS permits_old;
  ALTER TABLE permits RENAME TO permits_old;
  ALTER TABLE permits_dedup RENAME TO permits;
  DROP TABLE permits_old;
`);

// Step 7: Create unique indexes
console.log('Step 6: Creating unique indexes...');
try {
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_permits_address_unique ON permits(address_normalized)`);
  console.log('  Created unique index on permits.address_normalized');
} catch (e) {
  console.log('  Note:', e.message);
}

try {
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_matches_permit_unique ON permit_mls_matches(permit_id)`);
  console.log('  Created unique index on permit_mls_matches.permit_id');
} catch (e) {
  console.log('  Note:', e.message);
}

// Step 8: Final counts
console.log('\n=== AFTER DEDUPLICATION ===\n');
const afterPermits = db.prepare('SELECT COUNT(*) as c FROM permits').get().c;
const afterMatches = db.prepare('SELECT COUNT(*) as c FROM permit_mls_matches').get().c;
const afterUniqueMLs = db.prepare('SELECT COUNT(DISTINCT mls_list_no) as c FROM permit_mls_matches').get().c;

console.log('AFTER:');
console.log(`  Total permits: ${afterPermits} (was ${beforePermits})`);
console.log(`  Total matches: ${afterMatches} (was ${beforeMatches})`);
console.log(`  Unique MLS linked: ${afterUniqueMLs}`);

// Verify sales total
const sales = db.prepare('SELECT SUM(mls_sale_price) as total FROM permit_mls_matches WHERE mls_sale_price > 0').get();
console.log(`  Total sales value: $${(sales.total / 1000000).toFixed(1)}M`);

console.log('\n✅ Deduplication complete!');
