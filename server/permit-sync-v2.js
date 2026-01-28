/**
 * Wellesley Permit Sync System
 * 
 * Downloads permit files from Wellesley archive:
 * - 2009-2024: PDF files (parsed using pdf-parse)
 * - 2025+: CSV files (direct import)
 * 
 * Run: node permit-sync-v2.js [--download] [--parse] [--import] [--all]
 */

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

// Wellesley Archive document IDs mapped to years
const DOCUMENT_MAP = {
  // 2025 - CSV/Excel files
  893: { year: 2025, type: 'commercial', format: 'pdf' },
  848: { year: 2025, type: 'residential', format: 'pdf' },
  
  // 2024
  751: { year: 2024, type: 'residential', format: 'pdf' },
  777: { year: 2024, type: 'commercial', format: 'pdf' },
  
  // 2023
  662: { year: 2023, type: 'residential', format: 'pdf' },
  663: { year: 2023, type: 'commercial', format: 'pdf' },
  
  // 2022
  525: { year: 2022, type: 'residential', format: 'pdf' },
  580: { year: 2022, type: 'commercial', format: 'pdf' },
  
  // 2021
  441: { year: 2021, type: 'residential', format: 'pdf' },
  
  // 2019
  278: { year: 2019, type: 'all', format: 'pdf' },
  
  // Historical (2009-2018)
  221: { year: 2018, type: 'all', format: 'pdf' },
  55: { year: 2017, type: 'all', format: 'pdf' },
  54: { year: 2016, type: 'all', format: 'pdf' },
  53: { year: 2015, type: 'all', format: 'pdf' },
  52: { year: 2014, type: 'all', format: 'pdf' },
  51: { year: 2013, type: 'all', format: 'pdf' },
  50: { year: 2012, type: 'all', format: 'pdf' },
  49: { year: 2011, type: 'all', format: 'pdf' },
  48: { year: 2010, type: 'all', format: 'pdf' },
  47: { year: 2009, type: 'all', format: 'pdf' },
};

const PERMITS_DIR = path.join(process.cwd(), 'permits');
const DB_PATH = path.join(process.cwd(), 'properties.db');

// Ensure permits directory exists
if (!fs.existsSync(PERMITS_DIR)) {
  fs.mkdirSync(PERMITS_DIR, { recursive: true });
}

/**
 * Download all permit files from Wellesley archive
 */
async function downloadPermitFiles() {
  console.log('📥 Downloading permit files from Wellesley archive...\n');
  
  for (const [adid, info] of Object.entries(DOCUMENT_MAP)) {
    const filename = `permits_${info.year}_${info.type}.pdf`;
    const filepath = path.join(PERMITS_DIR, filename);
    
    // Skip if already downloaded
    if (fs.existsSync(filepath)) {
      const stats = fs.statSync(filepath);
      if (stats.size > 1000) {
        console.log(`⏭️  ${filename} already exists (${(stats.size / 1024).toFixed(1)} KB)`);
        continue;
      }
    }
    
    try {
      const url = `https://wellesleyma.gov/Archive.aspx?ADID=${adid}`;
      console.log(`📄 Downloading ADID=${adid}: ${info.year} ${info.type}...`);
      
      const response = await fetch(url);
      if (!response.ok) {
        console.log(`   ❌ Failed: ${response.status}`);
        continue;
      }
      
      const buffer = await response.arrayBuffer();
      fs.writeFileSync(filepath, Buffer.from(buffer));
      
      console.log(`   ✅ Saved: ${filename} (${(buffer.byteLength / 1024).toFixed(1)} KB)`);
      
      // Rate limit
      await new Promise(r => setTimeout(r, 500));
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }
  
  console.log('\n✅ Download complete!');
}

/**
 * Parse PDF files and extract permit data
 */
async function parsePermitPDFs() {
  console.log('📖 Parsing permit PDFs...\n');
  
  let pdfParse;
  try {
    // pdf-parse v1.1.1 uses CommonJS
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    pdfParse = require('pdf-parse');
  } catch (e) {
    console.log('❌ pdf-parse error:', e.message);
    console.log('Run: npm install pdf-parse@1.1.1');
    return [];
  }
  
  const allPermits = [];
  const files = fs.readdirSync(PERMITS_DIR).filter(f => f.endsWith('.pdf'));
  
  for (const file of files) {
    const filepath = path.join(PERMITS_DIR, file);
    const yearMatch = file.match(/permits_(\d{4})_/);
    const year = yearMatch ? parseInt(yearMatch[1]) : null;
    
    console.log(`\n📄 Parsing ${file}...`);
    
    try {
      const buffer = fs.readFileSync(filepath);
      const data = await pdfParse(buffer);
      
      console.log(`   Pages: ${data.numpages}`);
      console.log(`   Text length: ${data.text.length} chars`);
      
      // Parse the text content
      const permits = parsePermitText(data.text, year);
      console.log(`   Permits found: ${permits.length}`);
      
      allPermits.push(...permits);
    } catch (error) {
      console.log(`   ❌ Parse error: ${error.message}`);
    }
  }
  
  // Save parsed data
  const outputPath = path.join(PERMITS_DIR, 'parsed_permits.json');
  fs.writeFileSync(outputPath, JSON.stringify(allPermits, null, 2));
  console.log(`\n✅ Saved ${allPermits.length} permits to parsed_permits.json`);
  
  return allPermits;
}

/**
 * Parse permit text content from PDF
 * Handles multiple Wellesley permit PDF formats
 */
function parsePermitText(text, year) {
  const permits = [];
  const seenRecords = new Set();
  const seenAddresses = new Set();
  
  // Pattern 1: Modern format (2021-2025) with RES/COM prefix
  // RES-25-989Building Permit - Residential5 BOW STREET, WELLESLEY, MA 02481
  const modernPattern = /((?:RES|COM|COMM)-\d{2,4}-\d+)(?:Building Permit - (?:Residential|Commercial))?[\s\S]*?(\d+[A-Z]?\s+[A-Z][A-Z\s]+(?:STREET|ST|AVENUE|AVE|ROAD|RD|DRIVE|DR|LANE|LN|WAY|CIRCLE|CIR|COURT|CT|PLACE|PL|TERRACE|TER|HILL|PATH|PARK|BROOK|GATE|PLAIN)[A-Z]*),?\s*(WELLESLEY),?\s*(MA)\s*(\d{5})/gi;
  
  let match;
  while ((match = modernPattern.exec(text)) !== null) {
    const record_no = match[1];
    if (seenRecords.has(record_no)) continue;
    seenRecords.add(record_no);
    
    const rawAddress = match[2].trim();
    const city = match[3];
    const state = match[4];
    const zip = match[5];
    
    const addrParts = rawAddress.match(/^(\d+[A-Z]?)\s+(.+)$/i);
    const street_number = addrParts ? addrParts[1] : '';
    const street_name = addrParts ? addrParts[2].trim() : rawAddress;
    
    seenAddresses.add(rawAddress.toUpperCase());
    
    permits.push({
      record_no,
      permit_type: record_no.startsWith('COM') ? 'Commercial' : 'Residential',
      address: `${rawAddress}, ${city}, ${state} ${zip}`,
      address_normalized: rawAddress.toUpperCase(),
      street_number,
      street_name,
      city,
      state,
      zip,
      year
    });
  }
  
  // Pattern 2: Older format (2009-2019) with permit numbers like 20090049
  // and addresses like " 23BOULDER BROOK RD" (space before, no space after number)
  // Format: No.\n 23BOULDER BROOK RD
  const olderPattern = /(\d{7,9})\s+[\s\S]*?No\.\s*(\d+)([A-Z][A-Z\s\.]+(?:STREET|ST|AVENUE|AVE|ROAD|RD|DRIVE|DR|LANE|LN|WAY|CIRCLE|CIR|COURT|CT|PLACE|PL|TERRACE|TER|HILL|PATH|PARK|BROOK)\.?)/gi;
  
  while ((match = olderPattern.exec(text)) !== null) {
    const record_no = match[1];
    if (seenRecords.has(record_no)) continue;
    seenRecords.add(record_no);
    
    const street_number = match[2];
    const street_name = match[3].trim().replace(/\.$/, '');
    const address = `${street_number} ${street_name}`;
    
    if (seenAddresses.has(address.toUpperCase())) continue;
    seenAddresses.add(address.toUpperCase());
    
    permits.push({
      record_no,
      permit_type: 'Building',
      address: `${address}, WELLESLEY, MA`,
      address_normalized: address.toUpperCase(),
      street_number,
      street_name,
      city: 'Wellesley',
      state: 'MA',
      year
    });
  }
  
  // Pattern 3: Simple address extraction for any missed ones
  // Look for addresses in typical format: NUMBER + STREETNAME
  const addressPattern = /\s(\d+)([A-Z][A-Z\s]+(?:STREET|ST|AVENUE|AVE|ROAD|RD|DRIVE|DR|LANE|LN|WAY|CIRCLE|CIR|COURT|CT|PLACE|PL|TERRACE|TER|HILL|PATH|PARK|BROOK|GATE|PLAIN)[A-Z]*)(?:\s|$|,)/gi;
  
  while ((match = addressPattern.exec(text)) !== null) {
    const street_number = match[1];
    const street_name = match[2].trim();
    const address = `${street_number} ${street_name}`;
    
    if (seenAddresses.has(address.toUpperCase())) continue;
    seenAddresses.add(address.toUpperCase());
    
    permits.push({
      record_no: `PERMIT-${year}-${permits.length + 1}`,
      permit_type: 'Building',
      address: `${address}, WELLESLEY, MA`,
      address_normalized: address.toUpperCase(),
      street_number,
      street_name,
      city: 'Wellesley',
      state: 'MA',
      year
    });
  }
  
  return permits;
}

function getPermitType(code) {
  const types = {
    'BP': 'Building',
    'EP': 'Electrical',
    'PP': 'Plumbing',
    'MP': 'Mechanical',
    'GP': 'Gas',
    'FP': 'Fire',
    'SP': 'Sign',
    'DP': 'Demo'
  };
  return types[code] || code;
}

/**
 * Import permits into database
 */
async function importPermitsToDb(permits) {
  console.log(`\n📦 Importing ${permits.length} permits to database...\n`);
  
  const db = new Database(DB_PATH);
  
  // Add year column if needed
  const columns = db.prepare("PRAGMA table_info(permits)").all().map(c => c.name);
  if (!columns.includes('year')) {
    db.exec("ALTER TABLE permits ADD COLUMN year INTEGER");
  }
  
  // Get existing record numbers to avoid duplicates
  const existing = new Set(
    db.prepare("SELECT record_no FROM permits WHERE record_no IS NOT NULL").all()
      .map(r => r.record_no)
  );
  
  console.log(`Existing permits in DB: ${existing.size}`);
  
  const insert = db.prepare(`
    INSERT INTO permits (
      record_no, address, address_normalized, street_number, street_name,
      city, state, permit_type, year
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  let inserted = 0;
  let skipped = 0;
  
  const insertMany = db.transaction((permits) => {
    for (const p of permits) {
      if (!p.address) {
        skipped++;
        continue;
      }
      
      // Skip if record exists
      if (existing.has(p.record_no)) {
        skipped++;
        continue;
      }
      
      try {
        insert.run(
          p.record_no,
          p.address,
          p.address_normalized || p.address.toUpperCase(),
          p.street_number || '',
          p.street_name || '',
          p.city || 'Wellesley',
          p.state || 'MA',
          p.permit_type || 'Building',
          p.year
        );
        inserted++;
      } catch (err) {
        skipped++;
      }
    }
  });
  
  insertMany(permits);
  
  console.log(`✅ Imported: ${inserted}`);
  console.log(`⏭️  Skipped (duplicates): ${skipped}`);
  
  // Show totals by year
  const byYear = db.prepare(`
    SELECT year, COUNT(*) as count 
    FROM permits 
    WHERE year IS NOT NULL
    GROUP BY year 
    ORDER BY year DESC
  `).all();
  console.log('\nPermits by year in DB:');
  byYear.forEach(r => console.log(`  ${r.year}: ${r.count}`));
  
  db.close();
}

function normalizeAddress(address) {
  if (!address) return '';
  return address.toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/\./g, '')
    .replace(/,.*$/, '')
    .trim();
}

/**
 * Link permits to MLS properties
 */
async function linkPermitsToMLS() {
  console.log('\n🔗 Linking permits to MLS properties...\n');
  
  const db = new Database(DB_PATH);
  
  // Ensure linking table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS permit_mls_matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      permit_id INTEGER,
      mls_list_no TEXT,
      match_type TEXT,
      match_score REAL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Get all permits
  const permits = db.prepare(`
    SELECT id, address, address_normalized, street_number, street_name 
    FROM permits 
    WHERE id NOT IN (SELECT permit_id FROM permit_mls_matches WHERE permit_id IS NOT NULL)
  `).all();
  
  console.log(`Found ${permits.length} unlinked permits`);
  
  const insertMatch = db.prepare(`
    INSERT INTO permit_mls_matches (permit_id, mls_list_no, match_type, match_score)
    VALUES (?, ?, ?, ?)
  `);
  
  let linked = 0;
  
  for (const permit of permits) {
    // Try exact address match first (using mlsId column from properties table)
    let property = db.prepare(`
      SELECT mlsId FROM properties 
      WHERE UPPER(address) LIKE ?
      AND city = 'Wellesley'
      LIMIT 1
    `).get(`%${permit.address_normalized}%`);
    
    if (property) {
      insertMatch.run(permit.id, property.mlsId, 'exact', 1.0);
      linked++;
      continue;
    }
    
    // Try partial match on street number and name
    if (permit.street_number && permit.street_name) {
      property = db.prepare(`
        SELECT mlsId FROM properties 
        WHERE address LIKE ?
        AND city = 'Wellesley'
        LIMIT 1
      `).get(`${permit.street_number} ${permit.street_name}%`);
      
      if (property) {
        insertMatch.run(permit.id, property.mlsId, 'partial', 0.8);
        linked++;
      }
    }
  }
  
  console.log(`✅ Linked ${linked} permits to MLS properties`);
  
  db.close();
}

/**
 * Show current permit stats
 */
function showStats() {
  const db = new Database(DB_PATH);
  
  console.log('\n📊 Permit Database Stats\n');
  
  // Total permits
  const total = db.prepare('SELECT COUNT(*) as count FROM permits').get();
  console.log(`Total permits: ${total.count}`);
  
  // Check what columns exist
  const columns = db.prepare("PRAGMA table_info(permits)").all().map(c => c.name);
  
  // By year - extract from date_submitted or record_no
  console.log('\nBy Year (from date_submitted):');
  if (columns.includes('date_submitted')) {
    const byYear = db.prepare(`
      SELECT SUBSTR(date_submitted, 1, 4) as year, COUNT(*) as count 
      FROM permits 
      WHERE date_submitted IS NOT NULL AND date_submitted != ''
      GROUP BY SUBSTR(date_submitted, 1, 4) 
      ORDER BY year DESC
      LIMIT 10
    `).all();
    byYear.forEach(r => console.log(`  ${r.year}: ${r.count}`));
  }
  
  // By type
  console.log('\nBy Permit Type:');
  const byType = db.prepare(`
    SELECT permit_type, COUNT(*) as count 
    FROM permits 
    WHERE permit_type IS NOT NULL AND permit_type != ''
    GROUP BY permit_type 
    ORDER BY count DESC
    LIMIT 10
  `).all();
  byType.forEach(r => console.log(`  ${r.permit_type}: ${r.count}`));
  
  // Linked to MLS
  try {
    const linked = db.prepare(`
      SELECT COUNT(DISTINCT permit_id) as count 
      FROM permit_mls_matches
    `).get();
    console.log(`\nLinked to MLS: ${linked.count}`);
  } catch (e) {
    console.log('\nLinked to MLS: table not yet created');
  }
  
  // Sample permits
  console.log('\nSample Permits:');
  const samples = db.prepare(`
    SELECT record_no, address, permit_type, date_submitted 
    FROM permits 
    LIMIT 5
  `).all();
  samples.forEach(p => console.log(`  ${p.record_no}: ${p.address} (${p.permit_type}, ${p.date_submitted})`));
  
  db.close();
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  console.log('🏠 Wellesley Permit Sync System\n');
  console.log('=' .repeat(50));
  
  if (args.includes('--download') || args.includes('--all')) {
    await downloadPermitFiles();
  }
  
  if (args.includes('--parse') || args.includes('--all')) {
    const permits = await parsePermitPDFs();
    if (permits.length > 0 && (args.includes('--import') || args.includes('--all'))) {
      await importPermitsToDb(permits);
    }
  }
  
  if (args.includes('--link') || args.includes('--all')) {
    await linkPermitsToMLS();
  }
  
  if (args.includes('--stats') || args.length === 0) {
    showStats();
  }
  
  if (args.length === 0) {
    console.log('\n📋 Usage:');
    console.log('  node permit-sync-v2.js --download   Download permit PDFs');
    console.log('  node permit-sync-v2.js --parse      Parse PDFs to JSON');
    console.log('  node permit-sync-v2.js --import     Import to database');
    console.log('  node permit-sync-v2.js --link       Link permits to MLS');
    console.log('  node permit-sync-v2.js --stats      Show statistics');
    console.log('  node permit-sync-v2.js --all        Run all steps');
  }
}

main().catch(console.error);
