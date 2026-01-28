// Better permit-to-MLS linking with fuzzy matching
const db = require('better-sqlite3')('./properties.db');

console.log('=== Improved Permit-to-MLS Linking ===\n');

// Clear existing matches
db.prepare('DELETE FROM permit_mls_matches').run();
console.log('Cleared existing matches');

// Build a lookup table of properties by street number + normalized street name
console.log('Building property lookup table...');

const properties = db.prepare(`
  SELECT mlsId, address, city FROM properties 
  WHERE city = 'Wellesley'
`).all();

// Normalize street names for matching
function normalizeStreetName(name) {
  if (!name) return '';
  return name.toUpperCase()
    .replace(/\s+ROAD$/i, ' RD')
    .replace(/\s+STREET$/i, ' ST')
    .replace(/\s+AVENUE$/i, ' AVE')
    .replace(/\s+DRIVE$/i, ' DR')
    .replace(/\s+LANE$/i, ' LN')
    .replace(/\s+COURT$/i, ' CT')
    .replace(/\s+PLACE$/i, ' PL')
    .replace(/\s+CIRCLE$/i, ' CIR')
    .replace(/\s+TERRACE$/i, ' TER')
    .replace(/\s+HIGHWAY$/i, ' HWY')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractStreetInfo(address) {
  if (!address) return null;
  
  // Match: number + street name (stop at comma or city name)
  const match = address.match(/^(\d+[A-Z]?)\s+(.+?)(?:,|\s+(?:Wellesley|WELLESLEY))/i);
  if (!match) return null;
  
  return {
    number: match[1].toUpperCase(),
    street: normalizeStreetName(match[2])
  };
}

// Build lookup: "12 MELLON RD" -> [mlsId1, mlsId2, ...]
const propertyLookup = {};
for (const prop of properties) {
  const info = extractStreetInfo(prop.address);
  if (!info) continue;
  
  const key = `${info.number} ${info.street}`;
  if (!propertyLookup[key]) propertyLookup[key] = [];
  propertyLookup[key].push(prop.mlsId);
}

console.log('Property lookup entries:', Object.keys(propertyLookup).length);

// Now link permits
const permits = db.prepare('SELECT id, address FROM permits WHERE address IS NOT NULL').all();
console.log('Processing', permits.length, 'permits...');

const insertMatch = db.prepare('INSERT INTO permit_mls_matches (permit_id, mls_list_no, match_type, match_score) VALUES (?, ?, ?, ?)');

let exactMatches = 0;
let noMatch = 0;
const linkedPermits = new Set();

for (const permit of permits) {
  const info = extractStreetInfo(permit.address);
  if (!info) {
    noMatch++;
    continue;
  }
  
  const key = `${info.number} ${info.street}`;
  const matches = propertyLookup[key];
  
  if (matches && matches.length > 0) {
    // Link to first matching property (avoid duplicates)
    if (!linkedPermits.has(permit.id)) {
      insertMatch.run(permit.id, matches[0], 'exact', 1.0);
      linkedPermits.add(permit.id);
      exactMatches++;
    }
  } else {
    noMatch++;
  }
}

console.log('\nResults:');
console.log('  Matched permits:', exactMatches);
console.log('  Unmatched permits:', noMatch);

const totalLinks = db.prepare('SELECT COUNT(*) as count FROM permit_mls_matches').get();
console.log('  Total MLS links:', totalLinks.count);

// Sample matches
console.log('\nSample matches:');
const samples = db.prepare(`
  SELECT p.address as permit_addr, pr.address as property_addr, m.match_score
  FROM permit_mls_matches m
  JOIN permits p ON m.permit_id = p.id
  JOIN properties pr ON m.mls_list_no = pr.mlsId
  LIMIT 5
`).all();
samples.forEach(s => console.log(`  ${s.permit_addr} -> ${s.property_addr}`));

db.close();
