import db from './db.js';

// Migration: Add addressKey column and populate it for existing records

console.log('🔄 Running migration: Add addressKey column...\n');

// Check if column exists
const columns = db.prepare("PRAGMA table_info(properties)").all();
const hasAddressKey = columns.some(col => col.name === 'addressKey');

if (hasAddressKey) {
  console.log('✓ addressKey column already exists');
} else {
  console.log('Adding addressKey column...');
  db.exec('ALTER TABLE properties ADD COLUMN addressKey TEXT');
  console.log('✓ Column added');
}

// Create index if not exists
console.log('Creating index...');
db.exec('CREATE INDEX IF NOT EXISTS idx_properties_addressKey ON properties(addressKey)');
console.log('✓ Index created');

// Generate addressKey for existing records
console.log('\nPopulating addressKey for existing records...');

// Parse address to extract components
function generateAddressKey(address, city) {
  if (!address) return null;
  
  // Extract street number (first number in address)
  const streetNumMatch = address.match(/^(\d+)/);
  const streetNum = streetNumMatch ? streetNumMatch[1] : '';
  
  // Extract street name (after number, before comma)
  const streetPart = address.split(',')[0];
  const streetName = streetPart
    .replace(/^\d+\s*/, '') // Remove leading number
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  
  // Extract city
  const cityNorm = (city || '').trim().toLowerCase().replace(/[^a-z]/g, '');
  
  // Extract zip (last 5 digits in address or after city)
  const zipMatch = address.match(/(\d{5})(?:\s*-\d{4})?$/);
  const zip = zipMatch ? zipMatch[1] : '';
  
  return `${streetNum}-${streetName}-${cityNorm}-${zip}`;
}

// Get all properties without addressKey
const properties = db.prepare(`
  SELECT id, address, city FROM properties WHERE addressKey IS NULL OR addressKey = ''
`).all();

console.log(`Found ${properties.length} properties without addressKey`);

if (properties.length > 0) {
  const update = db.prepare('UPDATE properties SET addressKey = ? WHERE id = ?');
  
  const updateAll = db.transaction(() => {
    let updated = 0;
    for (const prop of properties) {
      const key = generateAddressKey(prop.address, prop.city);
      if (key) {
        update.run(key, prop.id);
        updated++;
      }
    }
    return updated;
  });
  
  const count = updateAll();
  console.log(`✓ Updated ${count} properties with addressKey`);
}

// Show some stats
const stats = db.prepare(`
  SELECT 
    COUNT(DISTINCT addressKey) as uniqueAddresses,
    COUNT(*) as totalListings,
    (SELECT COUNT(*) FROM (
      SELECT addressKey FROM properties WHERE addressKey IS NOT NULL GROUP BY addressKey HAVING COUNT(*) > 1
    )) as addressesWithMultipleListings
  FROM properties
  WHERE addressKey IS NOT NULL
`).get();

console.log('\n📊 Stats:');
console.log(`   Total listings: ${stats.totalListings}`);
console.log(`   Unique addresses: ${stats.uniqueAddresses}`);
console.log(`   Addresses with multiple listings: ${stats.addressesWithMultipleListings}`);

// Show top re-listed properties
const multipleListings = db.prepare(`
  SELECT 
    addressKey,
    address,
    city,
    COUNT(*) as listingCount,
    GROUP_CONCAT(status) as statuses
  FROM properties
  WHERE addressKey IS NOT NULL
  GROUP BY addressKey
  HAVING COUNT(*) > 1
  ORDER BY listingCount DESC
  LIMIT 10
`).all();

if (multipleListings.length > 0) {
  console.log('\n🏠 Properties with multiple listings:');
  multipleListings.forEach((p, i) => {
    console.log(`   ${i + 1}. ${p.address} (${p.city}) - ${p.listingCount} listings [${p.statuses}]`);
  });
}

console.log('\n✓ Migration complete!');
