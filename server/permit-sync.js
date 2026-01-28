/**
 * Wellesley Building Permits Scraper & Importer
 * 
 * This script:
 * 1. Scrapes the Wellesley archive page for permit files
 * 2. Downloads PDF and CSV files
 * 3. Parses them and imports into the database
 * 4. Can be run on a schedule to auto-update
 */

import 'dotenv/config';
import db from './db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import xlsx from 'xlsx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PERMITS_DIR = path.join(__dirname, 'permit-files');
const ARCHIVE_URL = 'https://wellesleyma.gov/Archive.aspx?AMID=36';

// Ensure permits directory exists
if (!fs.existsSync(PERMITS_DIR)) {
  fs.mkdirSync(PERMITS_DIR, { recursive: true });
}

// ============================================================================
// ADDRESS NORMALIZATION
// ============================================================================

function normalizeAddress(address) {
  if (!address) return '';
  return address
    .toUpperCase()
    .replace(/,?\s*(WELLESLEY|MA|02481|02482)\s*/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/[.,#]/g, '')
    .replace(/\bSTREET\b/g, 'ST')
    .replace(/\bAVENUE\b/g, 'AVE')
    .replace(/\bROAD\b/g, 'RD')
    .replace(/\bDRIVE\b/g, 'DR')
    .replace(/\bLANE\b/g, 'LN')
    .replace(/\bCOURT\b/g, 'CT')
    .replace(/\bCIRCLE\b/g, 'CIR')
    .replace(/\bPLACE\b/g, 'PL')
    .replace(/\bTERRACE\b/g, 'TER')
    .replace(/\bPARKWAY\b/g, 'PKWY')
    .replace(/\bBOULEVARD\b/g, 'BLVD')
    .trim();
}

// ============================================================================
// SCRAPE ARCHIVE PAGE
// ============================================================================

async function scrapeArchivePage() {
  console.log('📡 Fetching Wellesley permit archive page...');
  
  const response = await fetch(ARCHIVE_URL);
  const html = await response.text();
  
  // Parse links to permit files
  const files = [];
  
  // Match PDF links
  const pdfPattern = /href="([^"]*\.pdf[^"]*)"/gi;
  let match;
  while ((match = pdfPattern.exec(html)) !== null) {
    const url = match[1];
    if (url.toLowerCase().includes('permit') || url.toLowerCase().includes('building')) {
      files.push({
        url: url.startsWith('http') ? url : `https://wellesleyma.gov${url}`,
        type: 'pdf',
        filename: path.basename(url).replace(/\?.*/, '')
      });
    }
  }
  
  // Match CSV/Excel links (2025+ uses CSV format)
  const csvPattern = /href="([^"]*\.(csv|xlsx?)[^"]*)"/gi;
  while ((match = csvPattern.exec(html)) !== null) {
    const url = match[1];
    files.push({
      url: url.startsWith('http') ? url : `https://wellesleyma.gov${url}`,
      type: match[2].toLowerCase() === 'csv' ? 'csv' : 'excel',
      filename: path.basename(url).replace(/\?.*/, '')
    });
  }
  
  // Also check for ViewFile links (common pattern on gov sites)
  const viewFilePattern = /href="(\/ViewFile\/Item\/(\d+)[^"]*)"/gi;
  while ((match = viewFilePattern.exec(html)) !== null) {
    // Extract year from context
    const contextStart = Math.max(0, match.index - 200);
    const context = html.substring(contextStart, match.index + match[0].length + 100);
    const yearMatch = context.match(/20\d{2}/);
    const year = yearMatch ? yearMatch[0] : 'unknown';
    
    const isResidential = context.toLowerCase().includes('residential');
    const isCommercial = context.toLowerCase().includes('commercial');
    const type = isResidential ? 'residential' : (isCommercial ? 'commercial' : 'unknown');
    
    files.push({
      url: `https://wellesleyma.gov${match[1]}`,
      type: 'pdf',
      filename: `${year}-${type}-permits-${match[2]}.pdf`,
      year: parseInt(year) || null
    });
  }
  
  console.log(`   Found ${files.length} permit files`);
  return files;
}

// ============================================================================
// DOWNLOAD FILE
// ============================================================================

async function downloadFile(fileInfo) {
  const localPath = path.join(PERMITS_DIR, fileInfo.filename);
  
  // Skip if already downloaded
  if (fs.existsSync(localPath)) {
    console.log(`   ⏭️  Already have: ${fileInfo.filename}`);
    return localPath;
  }
  
  console.log(`   ⬇️  Downloading: ${fileInfo.filename}`);
  
  const response = await fetch(fileInfo.url);
  if (!response.ok) {
    console.log(`   ❌ Failed to download: ${response.status}`);
    return null;
  }
  
  const buffer = await response.arrayBuffer();
  fs.writeFileSync(localPath, Buffer.from(buffer));
  
  console.log(`   ✅ Saved: ${fileInfo.filename}`);
  return localPath;
}

// ============================================================================
// PARSE CSV/EXCEL FILE
// ============================================================================

function parseSpreadsheet(filePath) {
  console.log(`   📊 Parsing: ${path.basename(filePath)}`);
  
  const wb = xlsx.readFile(filePath, { cellDates: true });
  const allRows = [];
  
  for (const sheetName of wb.SheetNames) {
    const rows = xlsx.utils.sheet_to_json(wb.Sheets[sheetName], { defval: null, raw: false });
    rows.forEach(row => {
      row.__sheet = sheetName;
      row.__file = path.basename(filePath);
    });
    allRows.push(...rows);
  }
  
  console.log(`   Found ${allRows.length} rows`);
  return allRows;
}

// ============================================================================
// MAP ROW TO PERMIT
// ============================================================================

function mapRowToPermit(row, sourceFile) {
  // Find value by checking multiple possible column names
  const get = (...keys) => {
    for (const key of keys) {
      for (const rowKey of Object.keys(row)) {
        if (rowKey.toLowerCase().replace(/[^a-z0-9]/g, '').includes(key.toLowerCase().replace(/[^a-z0-9]/g, ''))) {
          return row[rowKey];
        }
      }
    }
    return null;
  };
  
  const address = get('Full Address', 'Address') || '';
  const recordNo = get('Record #', 'Record Number', 'Permit #', 'RecordNo') || '';
  const isCommercial = recordNo.startsWith('COM') || sourceFile.toLowerCase().includes('commercial');
  
  // Extract year from filename or date
  const dateSubmitted = get('Date Submitted', 'DateSubmitted', 'Date');
  let year = null;
  if (dateSubmitted) {
    const yearMatch = String(dateSubmitted).match(/20\d{2}/);
    if (yearMatch) year = parseInt(yearMatch[0]);
  }
  if (!year) {
    const fileYearMatch = sourceFile.match(/20\d{2}/);
    if (fileYearMatch) year = parseInt(fileYearMatch[0]);
  }
  
  // Parse cost
  const costStr = get('Total Estimated Cost', 'Estimated Cost', 'Cost');
  const cost = costStr ? parseFloat(String(costStr).replace(/[$,]/g, '')) || null : null;
  
  // Parse address components
  const addrNorm = normalizeAddress(address);
  const streetMatch = address.match(/^(\d+[A-Z]?)\s+(.+?)(?:,|$)/i);
  const streetNumber = streetMatch ? streetMatch[1] : '';
  const streetName = streetMatch ? streetMatch[2].trim() : '';
  
  return {
    record_no: recordNo,
    address: address,
    address_normalized: addrNorm,
    street_number: streetNumber,
    street_name: streetName,
    city: 'Wellesley',
    state: 'MA',
    permit_type: isCommercial ? 'Commercial' : 'Residential',
    project_type: get('Record Type', 'RecordType', 'Permit Type'),
    type_of_work: get('Type of Proposed Work', 'Work Type', 'TypeOfWork'),
    description: get('Brief Description', 'Description'),
    date_submitted: dateSubmitted,
    record_status: get('Record Status', 'Status'),
    applicant_name: get('Applicant Name', 'Applicant'),
    owner_name: get('Owner Name', 'Owner'),
    estimated_cost: cost,
    lot_area: get('Lot Area', 'LotArea'),
    zoning: get('Zoning'),
    year_built: parseInt(get('Year Built', 'YearBuilt')) || null,
    source_file: sourceFile,
    source_sheet: row.__sheet || null,
  };
}

// ============================================================================
// IMPORT PERMITS TO DATABASE
// ============================================================================

function importPermits(permits) {
  console.log(`   💾 Importing ${permits.length} permits...`);
  
  const upsert = db.prepare(`
    INSERT INTO permits (
      record_no, address, address_normalized, street_number, street_name,
      city, state, permit_type, project_type, type_of_work, description,
      date_submitted, record_status, applicant_name, owner_name,
      estimated_cost, lot_area, zoning, year_built, source_file, source_sheet,
      updated_at
    ) VALUES (
      @record_no, @address, @address_normalized, @street_number, @street_name,
      @city, @state, @permit_type, @project_type, @type_of_work, @description,
      @date_submitted, @record_status, @applicant_name, @owner_name,
      @estimated_cost, @lot_area, @zoning, @year_built, @source_file, @source_sheet,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT(address_normalized) DO UPDATE SET
      record_no = COALESCE(@record_no, record_no),
      address = COALESCE(@address, address),
      street_number = COALESCE(@street_number, street_number),
      street_name = COALESCE(@street_name, street_name),
      permit_type = COALESCE(@permit_type, permit_type),
      project_type = COALESCE(@project_type, project_type),
      type_of_work = COALESCE(@type_of_work, type_of_work),
      description = COALESCE(@description, description),
      date_submitted = COALESCE(@date_submitted, date_submitted),
      record_status = COALESCE(@record_status, record_status),
      applicant_name = COALESCE(@applicant_name, applicant_name),
      owner_name = COALESCE(@owner_name, owner_name),
      estimated_cost = COALESCE(@estimated_cost, estimated_cost),
      lot_area = COALESCE(@lot_area, lot_area),
      zoning = COALESCE(@zoning, zoning),
      year_built = COALESCE(@year_built, year_built),
      source_file = @source_file,
      source_sheet = @source_sheet,
      updated_at = CURRENT_TIMESTAMP
  `);
  
  let imported = 0;
  let skipped = 0;
  let errors = 0;
  
  const insertMany = db.transaction((perms) => {
    for (const p of perms) {
      try {
        if (!p.address || !p.address_normalized) {
          skipped++;
          continue;
        }
        upsert.run(p);
        imported++;
      } catch (e) {
        errors++;
        if (errors <= 3) console.log(`   Error: ${e.message}`);
      }
    }
  });
  
  insertMany(permits);
  console.log(`   ✅ Imported: ${imported}, Skipped: ${skipped}, Errors: ${errors}`);
  return imported;
}

// ============================================================================
// LINK PERMITS TO MLS PROPERTIES
// ============================================================================

function linkToMLS() {
  console.log('\n🔗 Linking permits to MLS properties...');
  
  // Get unlinked permits
  const permits = db.prepare(`
    SELECT p.id, p.address_normalized 
    FROM permits p
    LEFT JOIN permit_mls_matches m ON p.id = m.permit_id
    WHERE p.address_normalized IS NOT NULL AND m.id IS NULL
  `).all();
  
  console.log(`   Found ${permits.length} unlinked permits`);
  
  // Get Wellesley properties
  const properties = db.prepare(`
    SELECT id, mlsId, address FROM properties WHERE city = 'Wellesley'
  `).all();
  
  // Build lookup map
  const propMap = new Map();
  for (const p of properties) {
    const norm = normalizeAddress(p.address);
    if (norm) propMap.set(norm, { id: p.id, mlsId: p.mlsId, address: p.address });
  }
  
  const upsertMatch = db.prepare(`
    INSERT INTO permit_mls_matches (permit_id, mls_list_no, mls_address, match_type, match_score)
    VALUES (?, ?, ?, 'exact', 1.0)
    ON CONFLICT(permit_id) DO UPDATE SET 
      mls_list_no = excluded.mls_list_no,
      mls_address = excluded.mls_address,
      match_type = 'exact',
      match_score = 1.0
  `);
  
  let matched = 0;
  for (const permit of permits) {
    const prop = propMap.get(permit.address_normalized);
    if (prop) {
      try {
        upsertMatch.run(permit.id, prop.mlsId || prop.id, prop.address);
        matched++;
      } catch (e) {
        // Skip duplicates
      }
    }
  }
  
  console.log(`   ✅ Matched ${matched} new permits to MLS properties`);
  
  // Show total
  const totalMatched = db.prepare('SELECT COUNT(*) as c FROM permit_mls_matches').get().c;
  console.log(`   Total linked: ${totalMatched}`);
  
  return matched;
}

// ============================================================================
// IMPORT FROM LOCAL CSV FILE
// ============================================================================

async function importLocalCSV(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return;
  }
  
  console.log(`\n📂 Importing from: ${filePath}`);
  const rows = parseSpreadsheet(filePath);
  const permits = rows.map(row => mapRowToPermit(row, path.basename(filePath)));
  importPermits(permits);
  linkToMLS();
}

// ============================================================================
// FULL SYNC FROM WELLESLEY WEBSITE
// ============================================================================

async function fullSync() {
  console.log('\n========================================');
  console.log('WELLESLEY PERMITS SYNC');
  console.log('========================================\n');
  
  // Step 1: Scrape archive page
  const files = await scrapeArchivePage();
  
  // Step 2: Download new files (skip PDFs for now, focus on CSV/Excel)
  const spreadsheetFiles = files.filter(f => f.type === 'csv' || f.type === 'excel');
  console.log(`\n📥 Downloading ${spreadsheetFiles.length} spreadsheet files...`);
  
  for (const file of spreadsheetFiles) {
    await downloadFile(file);
  }
  
  // Step 3: Parse and import all spreadsheets in permit-files directory
  console.log('\n📊 Importing spreadsheet files...');
  const localFiles = fs.readdirSync(PERMITS_DIR).filter(f => 
    f.endsWith('.csv') || f.endsWith('.xlsx') || f.endsWith('.xls')
  );
  
  let totalImported = 0;
  for (const filename of localFiles) {
    const filePath = path.join(PERMITS_DIR, filename);
    try {
      const rows = parseSpreadsheet(filePath);
      const permits = rows.map(row => mapRowToPermit(row, filename));
      const count = importPermits(permits);
      totalImported += count;
    } catch (e) {
      console.log(`   ❌ Error processing ${filename}: ${e.message}`);
    }
  }
  
  // Step 4: Link to MLS
  linkToMLS();
  
  // Step 5: Show stats
  console.log('\n📊 Final Statistics:');
  const total = db.prepare('SELECT COUNT(*) as c FROM permits').get().c;
  const byType = db.prepare('SELECT permit_type, COUNT(*) as c FROM permits GROUP BY permit_type').all();
  console.log(`   Total permits: ${total}`);
  byType.forEach(r => console.log(`   ${r.permit_type || 'Unknown'}: ${r.c}`));
  
  const matchedCount = db.prepare('SELECT COUNT(*) as c FROM permit_mls_matches').get().c;
  console.log(`   Linked to MLS: ${matchedCount}`);
  
  console.log('\n✅ Sync complete!');
}

// ============================================================================
// CLI
// ============================================================================

const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'sync':
    fullSync().catch(console.error);
    break;
    
  case 'import':
    const file = args[1];
    if (!file) {
      console.log('Usage: node permit-sync.js import <file.csv>');
    } else {
      importLocalCSV(file).catch(console.error);
    }
    break;
    
  case 'link':
    linkToMLS();
    break;
    
  case 'stats':
    console.log('\n📊 Permit Statistics:');
    const total = db.prepare('SELECT COUNT(*) as c FROM permits').get().c;
    console.log(`Total: ${total}`);
    
    const byType = db.prepare('SELECT permit_type, COUNT(*) as c FROM permits GROUP BY permit_type').all();
    console.log('\nBy Permit Type:');
    byType.forEach(r => console.log(`  ${r.permit_type || 'Unknown'}: ${r.c}`));
    
    const byWork = db.prepare(`
      SELECT type_of_work, COUNT(*) as c FROM permits 
      WHERE type_of_work IS NOT NULL 
      GROUP BY type_of_work ORDER BY c DESC LIMIT 10
    `).all();
    console.log('\nBy Work Type (top 10):');
    byWork.forEach(r => console.log(`  ${r.type_of_work}: ${r.c}`));
    
    const byYear = db.prepare(`
      SELECT COALESCE(strftime('%Y', date_submitted), 'Unknown') as year, COUNT(*) as c 
      FROM permits GROUP BY year ORDER BY year DESC
    `).all();
    console.log('\nBy Year:');
    byYear.forEach(r => console.log(`  ${r.year}: ${r.c}`));
    
    try {
      const matched = db.prepare('SELECT COUNT(*) as c FROM permit_mls_matches').get().c;
      console.log(`\nLinked to MLS: ${matched}`);
    } catch(e) {}
    break;
    
  default:
    console.log(`
Wellesley Building Permits Sync Tool

Commands:
  sync              Full sync from Wellesley website (downloads & imports)
  import <file>     Import a local CSV/Excel file
  link              Link permits to MLS properties by address
  stats             Show permit statistics

Examples:
  node permit-sync.js sync
  node permit-sync.js import 2025-residential.csv
  node permit-sync.js stats
    `);
}
