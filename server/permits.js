import express from 'express';
import db from './db.js';
import xlsx from 'xlsx';
import path from 'path';
import fs from 'fs';

const router = express.Router();

const BRIDGE_API_BASE = process.env.BRIDGE_API_BASE || 'https://api.bridgedataoutput.com/api/v2/OData/shared_mlspin_0705dd4';
const BRIDGE_API_TOKEN = process.env.BRIDGE_API_TOKEN || '725919c8f3653746355154239821a3b1';

// ============================================================================
// ADDRESS MATCHING UTILITIES
// ============================================================================

function normalizeAddress(address) {
  if (!address) return { full: '', number: '', street: '', city: '', state: '', zip: '' };
  
  let str = String(address).toUpperCase().trim();
  
  // Remove extra spaces and punctuation
  str = str.replace(/[.,#]/g, ' ').replace(/\s+/g, ' ').trim();
  
  // Extract components
  const parts = str.split(/,\s*/);
  const streetPart = parts[0] || '';
  const cityPart = parts[1] || 'WELLESLEY';
  const stateZipPart = parts[2] || 'MA';
  
  // Parse street number and name
  const streetMatch = streetPart.match(/^(\d+[A-Z]?)\s+(.+)$/);
  const number = streetMatch ? streetMatch[1] : '';
  let street = streetMatch ? streetMatch[2] : streetPart;
  
  // Normalize street suffixes
  const suffixMap = {
    'STREET': 'ST', 'ROAD': 'RD', 'AVENUE': 'AVE', 'DRIVE': 'DR',
    'LANE': 'LN', 'TERRACE': 'TER', 'COURT': 'CT', 'CIRCLE': 'CIR',
    'PLACE': 'PL', 'PARKWAY': 'PKWY', 'BOULEVARD': 'BLVD', 'HIGHWAY': 'HWY',
    'WAY': 'WAY', 'PATH': 'PATH', 'TRAIL': 'TRL'
  };
  
  for (const [full, abbr] of Object.entries(suffixMap)) {
    street = street.replace(new RegExp(`\\b${full}\\b`, 'g'), abbr);
  }
  
  // Parse state and zip
  const stateZipMatch = stateZipPart.match(/([A-Z]{2})?\s*(\d{5})?/);
  const state = stateZipMatch?.[1] || 'MA';
  const zip = stateZipMatch?.[2] || '';
  
  return {
    full: str,
    number,
    street: street.trim(),
    city: cityPart.trim(),
    state,
    zip,
    normalized: `${number} ${street}`.trim()
  };
}

function matchScore(permit, mls) {
  const p = normalizeAddress(permit);
  const m = normalizeAddress(mls);
  
  // Must have exact street number match (if both have numbers)
  if (p.number && m.number && p.number !== m.number) {
    return 0;
  }
  
  // If one has a number and other doesn't, lower score
  if ((p.number && !m.number) || (!p.number && m.number)) {
    return 0.3;
  }
  
  // Compare street names
  if (p.street === m.street) {
    return p.number === m.number ? 1.0 : 0.9;
  }
  
  // Fuzzy street match (Jaro-Winkler)
  const streetScore = jaroWinkler(p.street, m.street);
  
  // Only accept high street similarity with exact number
  if (p.number === m.number && streetScore > 0.85) {
    return streetScore * 0.95;
  }
  
  return streetScore > 0.9 ? streetScore * 0.7 : 0;
}

function jaroWinkler(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  
  const maxDist = Math.floor(Math.max(a.length, b.length) / 2) - 1;
  let matches = 0;
  const aMatches = Array(a.length).fill(false);
  const bMatches = Array(b.length).fill(false);

  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - maxDist);
    const end = Math.min(i + maxDist + 1, b.length);
    for (let j = start; j < end; j++) {
      if (bMatches[j] || a[i] !== b[j]) continue;
      aMatches[i] = bMatches[j] = true;
      matches++;
      break;
    }
  }

  if (!matches) return 0;

  let t = 0, k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k++;
    if (a[i] !== b[k]) t++;
    k++;
  }
  t /= 2;

  const jaro = (matches/a.length + matches/b.length + (matches-t)/matches) / 3;
  let prefix = 0;
  for (let i = 0; i < Math.min(4, a.length, b.length); i++) {
    if (a[i] === b[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

// ============================================================================
// DATABASE HELPERS
// ============================================================================

function ensureTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS permits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_no TEXT,
      address TEXT,
      address_normalized TEXT UNIQUE,
      property_type TEXT,
      street_number TEXT,
      street_name TEXT,
      city TEXT DEFAULT 'Wellesley',
      state TEXT DEFAULT 'MA',
      zip TEXT,
      latitude REAL,
      longitude REAL,
      permit_type TEXT,
      project_type TEXT,
      type_of_work TEXT,
      description TEXT,
      date_submitted TEXT,
      record_status TEXT,
      applicant_name TEXT,
      owner_name TEXT,
      estimated_cost REAL,
      demolition_cost REAL,
      demolition_date TEXT,
      lot_area REAL,
      zoning TEXT,
      year_built INTEGER,
      list_price REAL,
      mls_number TEXT,
      listing_agent TEXT,
      listing_status TEXT,
      source_sheet TEXT,
      source_file TEXT,
      raw_data JSON,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS permit_mls_matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      permit_id INTEGER NOT NULL UNIQUE,
      mls_list_no TEXT,
      mls_address TEXT,
      mls_list_date TEXT,
      mls_offer_date TEXT,
      mls_settled_date TEXT,
      mls_list_price REAL,
      mls_sale_price REAL,
      mls_sqft INTEGER,
      mls_bedrooms INTEGER,
      mls_bathrooms REAL,
      mls_year_built INTEGER,
      mls_lot_size REAL,
      match_score REAL,
      match_type TEXT,
      is_confirmed INTEGER DEFAULT 0,
      raw_data JSON,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(permit_id) REFERENCES permits(id)
    );

    CREATE INDEX IF NOT EXISTS idx_permits_address ON permits(address_normalized);
    CREATE INDEX IF NOT EXISTS idx_permits_record_no ON permits(record_no);
    CREATE INDEX IF NOT EXISTS idx_permits_date ON permits(date_submitted);
    CREATE INDEX IF NOT EXISTS idx_matches_permit ON permit_mls_matches(permit_id);
    CREATE INDEX IF NOT EXISTS idx_matches_mls ON permit_mls_matches(mls_list_no);
  `);
  
  // Migration: Add UNIQUE constraint if table already exists without it
  try {
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_permits_address_unique ON permits(address_normalized)`);
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_matches_permit_unique ON permit_mls_matches(permit_id)`);
  } catch (e) {
    // Index might already exist or data has duplicates
    console.log('Note: Could not create unique indexes, may need to deduplicate data first');
  }
}

ensureTables();

// ============================================================================
// API ENDPOINTS
// ============================================================================

// GET /api/permits - List all permits with optional filters
router.get('/', (req, res) => {
  try {
    const { status, year, hasMatch, limit = 500, propertyType } = req.query;
    
    let sql = `
      SELECT p.*, 
        (SELECT COUNT(*) FROM permit_mls_matches WHERE permit_id = p.id) as match_count,
        (SELECT MAX(match_score) FROM permit_mls_matches WHERE permit_id = p.id) as best_match_score
      FROM permits p WHERE 1=1
    `;
    const params = [];
    
    if (status) {
      sql += ' AND p.record_status = ?';
      params.push(status);
    }
    
    if (year) {
      // Use COALESCE to check both year column (from PDF as integer) and date_submitted (from Excel)
      // Cast year to TEXT to compare with strftime result
      sql += ` AND COALESCE(CAST(p.year AS TEXT), strftime('%Y', p.date_submitted)) = ?`;
      params.push(String(year));
    }
    
    if (propertyType) {
      sql += ' AND p.property_type = ?';
      params.push(propertyType);
    }
    
    if (hasMatch === 'true') {
      sql += ' AND (SELECT COUNT(*) FROM permit_mls_matches WHERE permit_id = p.id) > 0';
    } else if (hasMatch === 'false') {
      sql += ' AND (SELECT COUNT(*) FROM permit_mls_matches WHERE permit_id = p.id) = 0';
    }
    
    // Sort by year (prefer date_submitted if available, otherwise use year column)
    sql += " ORDER BY COALESCE(p.date_submitted, CAST(p.year AS TEXT) || '-01-01') DESC LIMIT ?";
    params.push(parseInt(limit));
    
    const permits = db.prepare(sql).all(...params);
    res.json({ count: permits.length, permits });
  } catch (error) {
    console.error('Error fetching permits:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/permits/stats - Get permit statistics
router.get('/stats', (req, res) => {
  try {
    const stats = {
      total: db.prepare('SELECT COUNT(*) as count FROM permits').get().count,
      byYear: db.prepare(`
        SELECT COALESCE(CAST(year AS TEXT), strftime('%Y', date_submitted)) as year, COUNT(*) as count 
        FROM permits 
        WHERE year IS NOT NULL OR date_submitted IS NOT NULL 
        GROUP BY COALESCE(CAST(year AS TEXT), strftime('%Y', date_submitted)) 
        ORDER BY year DESC
      `).all(),
      byStatus: db.prepare(`
        SELECT record_status, COUNT(*) as count 
        FROM permits GROUP BY record_status
      `).all(),
      byProjectType: db.prepare(`
        SELECT project_type, COUNT(*) as count 
        FROM permits WHERE project_type IS NOT NULL 
        GROUP BY project_type ORDER BY count DESC
      `).all(),
      matched: db.prepare(`
        SELECT COUNT(DISTINCT permit_id) as count FROM permit_mls_matches
      `).get().count,
      unmatched: db.prepare(`
        SELECT COUNT(*) as count FROM permits 
        WHERE id NOT IN (SELECT DISTINCT permit_id FROM permit_mls_matches)
      `).get().count,
      // New: High-confidence matches (score >= 0.95)
      highConfidenceMatches: db.prepare(`
        SELECT COUNT(DISTINCT permit_id) as count FROM permit_mls_matches WHERE match_score >= 0.95
      `).get().count,
      // New: Matches with sale data
      matchesWithSales: db.prepare(`
        SELECT COUNT(DISTINCT permit_id) as count FROM permit_mls_matches 
        WHERE mls_settled_date IS NOT NULL AND mls_sale_price > 0
      `).get().count,
      // New: Average match score
      avgMatchScore: db.prepare(`
        SELECT AVG(match_score) as avg FROM permit_mls_matches
      `).get().avg || 0,
      totalEstimatedCost: db.prepare(`
        SELECT SUM(estimated_cost) as total FROM permits WHERE estimated_cost > 0
      `).get().total || 0,
      avgEstimatedCost: db.prepare(`
        SELECT AVG(estimated_cost) as avg FROM permits WHERE estimated_cost > 0
      `).get().avg || 0,
      // Total MLS sale value - DEDUPLICATED by unique MLS listing to avoid double counting
      totalSalesValue: db.prepare(`
        SELECT SUM(sale_price) as total FROM (
          SELECT DISTINCT mls_list_no, mls_sale_price as sale_price 
          FROM permit_mls_matches 
          WHERE mls_sale_price > 0
        )
      `).get().total || 0,
      // Unique permit addresses (to show deduplication)
      uniqueAddresses: db.prepare(`
        SELECT COUNT(DISTINCT address_normalized) as count FROM permits
      `).get().count,
      // Unique MLS matches
      uniqueMLSMatches: db.prepare(`
        SELECT COUNT(DISTINCT mls_list_no) as count FROM permit_mls_matches
      `).get().count
    };
    res.json(stats);
  } catch (error) {
    console.error('Error fetching permit stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/permits/analytics - Get detailed analytics
router.get('/analytics', (req, res) => {
  try {
    // Time to sale analysis - only include valid data (sale after permit)
    const timeToSale = db.prepare(`
      SELECT 
        p.id,
        p.address,
        p.date_submitted,
        p.estimated_cost,
        m.mls_list_date,
        m.mls_settled_date,
        m.mls_sale_price,
        julianday(m.mls_list_date) - julianday(p.date_submitted) as days_to_list,
        julianday(m.mls_settled_date) - julianday(p.date_submitted) as days_to_sale,
        CASE WHEN p.estimated_cost > 0 THEN m.mls_sale_price / p.estimated_cost ELSE NULL END as sale_to_cost_ratio
      FROM permits p
      JOIN permit_mls_matches m ON m.permit_id = p.id
      WHERE p.date_submitted IS NOT NULL 
        AND m.mls_settled_date IS NOT NULL
        AND (m.is_confirmed = 1 OR m.match_score >= 0.75)
        AND julianday(m.mls_settled_date) > julianday(p.date_submitted)
      ORDER BY p.date_submitted DESC
    `).all();
    
    // Aggregate stats
    const validTimeToSale = timeToSale.filter(r => r.days_to_sale > 0 && r.days_to_sale < 1500);
    const avgDaysToSale = validTimeToSale.length > 0 
      ? validTimeToSale.reduce((sum, r) => sum + r.days_to_sale, 0) / validTimeToSale.length 
      : null;
    
    const validTimeToList = timeToSale.filter(r => r.days_to_list > 0 && r.days_to_list < 1500);
    const avgDaysToList = validTimeToList.length > 0
      ? validTimeToList.reduce((sum, r) => sum + r.days_to_list, 0) / validTimeToList.length
      : null;
    
    const validRatios = timeToSale.filter(r => r.sale_to_cost_ratio > 0 && r.sale_to_cost_ratio < 10);
    const avgSaleToCost = validRatios.length > 0
      ? validRatios.reduce((sum, r) => sum + r.sale_to_cost_ratio, 0) / validRatios.length
      : null;
    
    // By year breakdown - use year column (from PDF) or date_submitted (from Excel)
    const byYear = db.prepare(`
      SELECT 
        COALESCE(CAST(p.year AS TEXT), strftime('%Y', p.date_submitted)) as permit_year,
        COUNT(DISTINCT p.id) as permits,
        COUNT(CASE WHEN m.mls_settled_date IS NOT NULL THEN 1 END) as sales,
        AVG(CASE WHEN m.mls_sale_price > 0 THEN m.mls_sale_price END) as avg_sale_price,
        AVG(CASE WHEN p.estimated_cost > 0 THEN p.estimated_cost END) as avg_construction_cost,
        AVG(CASE WHEN m.mls_settled_date IS NOT NULL 
                 THEN julianday(m.mls_settled_date) - COALESCE(julianday(p.date_submitted), julianday(CAST(p.year AS TEXT) || '-06-15'))
            END) as avg_days_to_sale
      FROM permits p
      LEFT JOIN permit_mls_matches m ON m.permit_id = p.id
      WHERE p.year IS NOT NULL OR p.date_submitted IS NOT NULL
      GROUP BY permit_year
      ORDER BY permit_year DESC
    `).all();
    
    // Top builders
    const topBuilders = db.prepare(`
      SELECT 
        COALESCE(applicant_name, owner_name) as builder,
        COUNT(*) as permit_count,
        SUM(estimated_cost) as total_construction_cost,
        AVG(estimated_cost) as avg_construction_cost
      FROM permits 
      WHERE applicant_name IS NOT NULL OR owner_name IS NOT NULL
      GROUP BY builder
      HAVING permit_count >= 2
      ORDER BY permit_count DESC
      LIMIT 20
    `).all();
    
    res.json({
      summary: {
        avgDaysToList: avgDaysToList ? Math.round(avgDaysToList) : null,
        avgDaysToSale: avgDaysToSale ? Math.round(avgDaysToSale) : null,
        avgSaleToCostRatio: avgSaleToCost ? avgSaleToCost.toFixed(2) : null,
        totalAnalyzed: timeToSale.length
      },
      byYear,
      topBuilders,
      details: timeToSale.slice(0, 100)
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/permits/:id - Get single permit with matches
router.get('/:id', (req, res) => {
  try {
    const permit = db.prepare('SELECT * FROM permits WHERE id = ?').get(req.params.id);
    if (!permit) {
      return res.status(404).json({ error: 'Permit not found' });
    }
    
    const matches = db.prepare(`
      SELECT * FROM permit_mls_matches 
      WHERE permit_id = ? 
      ORDER BY match_score DESC
    `).all(req.params.id);
    
    res.json({ permit, matches });
  } catch (error) {
    console.error('Error fetching permit:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/permits/import - Import permits from JSON
router.post('/import', async (req, res) => {
  try {
    const { permits: permitData, sourceFile = 'manual', autoMatch = true } = req.body;
    
    if (!Array.isArray(permitData)) {
      return res.status(400).json({ error: 'permits must be an array' });
    }
    
    // Check if address already exists - if so, update; if not, insert
    const checkExisting = db.prepare('SELECT id FROM permits WHERE address_normalized = ?');
    
    const insertPermit = db.prepare(`
      INSERT INTO permits (
        record_no, address, address_normalized, street_number, street_name,
        city, state, zip, latitude, longitude, permit_type, property_type, project_type,
        type_of_work, description, date_submitted, record_status,
        applicant_name, owner_name, estimated_cost, demolition_cost,
        demolition_date, lot_area, zoning, year_built, list_price,
        mls_number, listing_agent, listing_status, source_sheet, source_file, raw_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const updatePermit = db.prepare(`
      UPDATE permits SET
        record_no = COALESCE(?, record_no),
        address = COALESCE(?, address),
        date_submitted = COALESCE(?, date_submitted),
        record_status = COALESCE(?, record_status),
        applicant_name = COALESCE(?, applicant_name),
        owner_name = COALESCE(?, owner_name),
        estimated_cost = CASE WHEN ? > 0 THEN ? ELSE estimated_cost END,
        property_type = COALESCE(?, property_type),
        source_sheet = ?,
        source_file = ?,
        raw_data = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE address_normalized = ?
    `);
    
    const results = { imported: 0, updated: 0, skipped: 0, errors: [] };
    
    for (const row of permitData) {
      try {
        // Extract address from various possible fields
        // Handle split address columns (Address + Town + State_Zip)
        let rawAddress = '';
        if (row['Full Address']) {
          rawAddress = row['Full Address'];
        } else if (row['Address'] && row['Town']) {
          // Split address format: Address + Town + State_Zip
          rawAddress = `${row['Address']}, ${row['Town']}${row['State_Zip'] ? ' ' + row['State_Zip'] : ', MA'}`;
        } else if (row['ADDRESS']) {
          rawAddress = row['ADDRESS'];
        } else if (row['Full']) {
          // Handle "Full" and "Address" as separate columns
          rawAddress = row['Full'] + (row['Address'] ? ' ' + row['Address'] : '');
        } else {
          rawAddress = row.address || row.address_raw || '';
        }
        
        // Skip rows without address (likely MLS sold data sheets)
        if (!rawAddress || rawAddress.trim() === '') {
          // Check if this is an MLS sold data row (has LIST_NO but no permit address)
          if (row['LIST_NO'] || row['SALE_PRICE']) {
            results.skipped++;
            continue; // Skip MLS data rows - they're not permits
          }
        }
        
        const addr = normalizeAddress(rawAddress);
        
        // Parse cost values
        const parseCost = (val) => {
          if (!val) return null;
          const str = String(val).replace(/[$,]/g, '');
          const num = parseFloat(str);
          return isNaN(num) ? null : num;
        };
        
        // Parse date
        const parseDate = (val) => {
          if (!val) return null;
          if (val instanceof Date) return val.toISOString().slice(0, 10);
          const str = String(val).trim();
          // Handle Excel serial dates
          if (/^\d+(\.\d+)?$/.test(str)) {
            const serial = parseFloat(str);
            const date = new Date((serial - 25569) * 86400 * 1000);
            return date.toISOString().slice(0, 10);
          }
          // Try parsing as date string
          const parsed = new Date(str);
          return isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
        };
        
        // Parse all fields
        const recordNo = row['Record #'] || row.record_no || row.record_id || null;
        const propertyType = row['Property Type'] || row.property_type || null;
        const dateSubmitted = parseDate(row['Date Submitted'] || row.date_submitted);
        const recordStatus = row['Record Status'] || row.record_status || null;
        const applicantName = row['Applicant Name'] || row.applicant_name || null;
        const ownerName = row['Owner Name'] || row.owner_name || null;
        const estimatedCost = parseCost(row['Total Estimated Building Cost\n(based on type of work)'] || 
                   row['Total Estimated Building Cost'] ||
                   row['Total Estimated Cost'] || 
                   row['Total Estimated New Construction Cost'] ||
                   row.estimated_cost ||
                   row.est_cost);
        const sheetName = row.__sheetName || row.source_sheet || null;
        const rawData = JSON.stringify(row);
        
        // Check if this address already exists
        const existing = checkExisting.get(addr.normalized);
        
        if (existing) {
          // Update existing record
          updatePermit.run(
            recordNo,
            rawAddress,
            dateSubmitted,
            recordStatus,
            applicantName,
            ownerName,
            estimatedCost, estimatedCost, // CASE WHEN ? > 0 THEN ? ELSE...
            propertyType,
            sheetName,
            sourceFile,
            rawData,
            addr.normalized
          );
          results.updated++;
        } else {
          // Insert new record
          insertPermit.run(
            recordNo,
            rawAddress,
            addr.normalized,
            addr.number,
            addr.street,
            row['Town'] || addr.city || 'Wellesley',
            addr.state || 'MA',
            addr.zip || null,
            parseFloat(row['Latitude '] || row['Latitude'] || row.latitude) || null,
            parseFloat(row['Longitude'] || row.longitude) || null,
            row['Record Type'] || row.permit_type || null,
            row['Property Type'] || row.property_type || null,
            row['Type of Project'] || row.project_type || null,
            row['Type of Work'] || row['Type of Proposed Work'] || row.type_of_work || null,
            row['Brief Description of Proposed Work'] || row.description || null,
            dateSubmitted,
            recordStatus,
            applicantName,
            ownerName,
            estimatedCost,
            parseCost(row['Demolition: Total Estimated Cost'] || row.demolition_cost || row.demo_cost),
            parseDate(row['Demolition: Date Submitted'] || row.demolition_date),
            parseFloat(row['Lot Area'] || row['LOT_SIZE'] || row.lot_area) || null,
            row['Zoning'] || row.zoning || null,
            parseInt(row['Year Built'] || row['YEAR_BUILT'] || row.year_built) || null,
            parseCost(row['List Price'] || row['LIST_PRICE'] || row.list_price),
            row['MLS #'] || row['LIST_NO'] || row.mls_number || null,
            row['Listing Agent'] || row.listing_agent || null,
            row['Listing Status'] || row.listing_status || null,
            sheetName,
            sourceFile,
            rawData
          );
          results.imported++;
        }
      } catch (err) {
        results.errors.push({ row: row['Record #'] || 'unknown', error: err.message });
        results.skipped++;
      }
    }
    
    // Auto-match if requested
    if (autoMatch && (results.imported > 0 || results.updated > 0)) {
      const matchResult = await runMatching();
      results.matching = matchResult;
    }
    
    res.json(results);
  } catch (error) {
    console.error('Error importing permits:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/permits/import-excel - Import from Excel file path
router.post('/import-excel', async (req, res) => {
  try {
    const { filePath, sheets = null } = req.body;
    
    if (!filePath) {
      return res.status(400).json({ error: 'filePath is required' });
    }
    
    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved)) {
      return res.status(404).json({ error: `File not found: ${resolved}` });
    }
    
    const wb = xlsx.readFile(resolved, { cellDates: true });
    const sheetNames = sheets || wb.SheetNames;
    
    const results = { total: 0, bySheet: {} };
    
    for (const sheetName of sheetNames) {
      if (!wb.Sheets[sheetName]) continue;
      
      const rows = xlsx.utils.sheet_to_json(wb.Sheets[sheetName], { defval: null, raw: false });
      
      // Add sheet name to each row
      for (const row of rows) {
        row.__sheetName = sheetName;
      }
      
      // Import via the same logic
      const importResult = await new Promise((resolve) => {
        const fakeReq = { body: { permits: rows, sourceFile: path.basename(filePath), autoMatch: false } };
        const fakeRes = { json: resolve, status: () => ({ json: resolve }) };
        router.handle({ ...fakeReq, method: 'POST', url: '/import' }, fakeRes, () => {});
      });
      
      // Use direct insert instead
      const insertPermit = db.prepare(`
        INSERT INTO permits (
          record_no, address, address_normalized, street_number, street_name,
          city, state, zip, latitude, longitude, permit_type, property_type, project_type,
          type_of_work, description, date_submitted, record_status,
          applicant_name, owner_name, estimated_cost, demolition_cost,
          demolition_date, lot_area, zoning, year_built, source_sheet, source_file, raw_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      let sheetCount = 0;
      for (const row of rows) {
        try {
          const rawAddress = row['Full Address'] || row['Address'] || '';
          const addr = normalizeAddress(rawAddress);
          if (!rawAddress) continue;
          
          const parseCost = (val) => {
            if (!val) return null;
            const str = String(val).replace(/[$,]/g, '');
            const num = parseFloat(str);
            return isNaN(num) ? null : num;
          };
          
          insertPermit.run(
            row['Record #'] || null,
            rawAddress,
            addr.normalized,
            addr.number,
            addr.street,
            addr.city || 'Wellesley',
            addr.state || 'MA',
            addr.zip || null,
            parseFloat(row['Latitude ']) || null,
            parseFloat(row['Longitude']) || null,
            row['Record Type'] || null,
            row['Property Type'] || row.property_type || null,
            row['Type of Project'] || null,
            row['Type of Work'] || row['Type of Proposed Work'] || null,
            row['Brief Description of Proposed Work'] || null,
            row['Date Submitted'] || null,
            row['Record Status'] || null,
            row['Applicant Name'] || null,
            row['Owner Name'] || null,
            parseCost(row['Total Estimated Building Cost\n(based on type of work)'] || 
                     row['Total Estimated Cost'] || 
                     row['Total Estimated New Construction Cost']),
            parseCost(row['Demolition: Total Estimated Cost']),
            row['Demolition: Date Submitted'] || null,
            parseFloat(row['Lot Area']) || null,
            row['Zoning'] || null,
            parseInt(row['Year Built']) || null,
            sheetName,
            path.basename(filePath),
            JSON.stringify(row)
          );
          sheetCount++;
        } catch (e) {
          // Skip duplicates or errors
        }
      }
      
      results.bySheet[sheetName] = sheetCount;
      results.total += sheetCount;
    }
    
    // Run matching
    const matchResult = await runMatching();
    results.matching = matchResult;
    
    res.json(results);
  } catch (error) {
    console.error('Error importing Excel:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/permits/match - Run matching against MLS data
router.post('/match', async (req, res) => {
  try {
    const result = await runMatching();
    res.json(result);
  } catch (error) {
    console.error('Error running matching:', error);
    res.status(500).json({ error: error.message });
  }
});

async function runMatching() {
  console.log('Starting matching process...');
  
  // Get all permits without confirmed matches
  const permits = db.prepare(`
    SELECT * FROM permits 
    WHERE id NOT IN (
      SELECT permit_id FROM permit_mls_matches WHERE is_confirmed = 1
    )
  `).all();
  
  console.log(`Found ${permits.length} permits to match`);
  
  // Get all properties from the properties table (synced from Bridge API)
  const properties = db.prepare(`
    SELECT * FROM properties WHERE city = 'Wellesley'
  `).all();
  
  console.log(`Found ${properties.length} Wellesley properties`);
  
  // OPTIMIZATION: Pre-normalize all addresses and index by street number
  const propertyIndex = new Map(); // street_number -> array of properties
  const normalizedProps = properties.map(prop => {
    const norm = normalizeAddress(prop.address);
    return { ...prop, normalized: norm };
  });
  
  // Index properties by street number for fast lookup
  for (const prop of normalizedProps) {
    const key = prop.normalized.number || '_no_number';
    if (!propertyIndex.has(key)) {
      propertyIndex.set(key, []);
    }
    propertyIndex.get(key).push(prop);
  }
  
  console.log(`Indexed properties by ${propertyIndex.size} unique street numbers`);
  
  const insertMatch = db.prepare(`
    INSERT OR REPLACE INTO permit_mls_matches (
      permit_id, mls_list_no, mls_address, mls_list_date, mls_offer_date,
      mls_settled_date, mls_list_price, mls_sale_price, mls_sqft,
      mls_bedrooms, mls_bathrooms, mls_year_built, mls_lot_size,
      match_score, match_type, raw_data
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const results = { matched: 0, unmatched: 0, total: permits.length };
  let processed = 0;
  
  for (const permit of permits) {
    const permitNorm = normalizeAddress(permit.address);
    let bestMatch = null;
    let bestScore = 0;
    
    // OPTIMIZATION: Only compare with properties that have the same street number
    const candidates = permitNorm.number 
      ? (propertyIndex.get(permitNorm.number) || [])
      : normalizedProps; // If no street number, check all (rare)
    
    for (const prop of candidates) {
      // Fast path: exact normalized match
      if (permitNorm.normalized === prop.normalized.normalized) {
        bestMatch = prop;
        bestScore = 1.0;
        break;
      }
      
      // Slower path: fuzzy street name match
      const streetScore = jaroWinkler(permitNorm.street, prop.normalized.street);
      if (streetScore > bestScore && streetScore >= 0.75) {
        bestScore = streetScore;
        bestMatch = prop;
      }
    }
    
    // Accept matches at 0.75 threshold for more coverage
    if (bestMatch && bestScore >= 0.75) {
      insertMatch.run(
        permit.id,
        bestMatch.mlsId || bestMatch.id,
        bestMatch.address,
        bestMatch.listDate,
        bestMatch.offMarketDate,
        bestMatch.closeDate,
        bestMatch.originalPrice || bestMatch.price,
        bestMatch.closePrice || bestMatch.price,
        bestMatch.sqft,
        bestMatch.beds,
        bestMatch.baths,
        bestMatch.yearBuilt,
        bestMatch.lotSize,
        bestScore,
        bestScore === 1 ? 'exact' : 'fuzzy',
        JSON.stringify(bestMatch)
      );
      results.matched++;
    } else {
      results.unmatched++;
    }
    
    processed++;
    if (processed % 500 === 0) {
      console.log(`Processed ${processed}/${permits.length} permits...`);
    }
  }
  
  console.log(`Matching complete: ${results.matched} matched, ${results.unmatched} unmatched`);
  return results;
}

// POST /api/permits/:id/confirm-match - Confirm a match
router.post('/:id/confirm-match', (req, res) => {
  try {
    const { matchId } = req.body;
    
    if (!matchId) {
      return res.status(400).json({ error: 'matchId is required' });
    }
    
    // Unconfirm all other matches for this permit
    db.prepare('UPDATE permit_mls_matches SET is_confirmed = 0 WHERE permit_id = ?').run(req.params.id);
    
    // Confirm the selected match
    db.prepare('UPDATE permit_mls_matches SET is_confirmed = 1 WHERE id = ?').run(matchId);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error confirming match:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/permits/:id/manual-match - Manually add a match
router.post('/:id/manual-match', (req, res) => {
  try {
    const { mlsListNo, mlsAddress } = req.body;
    
    // Look up the MLS property
    const property = db.prepare(`
      SELECT * FROM properties WHERE mlsId = ? OR id = ? OR address LIKE ?
    `).get(mlsListNo, mlsListNo, `%${mlsAddress}%`);
    
    if (!property) {
      return res.status(404).json({ error: 'MLS property not found' });
    }
    
    const insertMatch = db.prepare(`
      INSERT INTO permit_mls_matches (
        permit_id, mls_list_no, mls_address, mls_list_date, mls_offer_date,
        mls_settled_date, mls_list_price, mls_sale_price, mls_sqft,
        mls_bedrooms, mls_bathrooms, mls_year_built, mls_lot_size,
        match_score, match_type, is_confirmed, raw_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    insertMatch.run(
      req.params.id,
      property.mlsId || property.id,
      property.address,
      property.listDate,
      property.offMarketDate,
      property.closeDate,
      property.originalPrice || property.price,
      property.closePrice || property.price,
      property.sqft,
      property.beds,
      property.baths,
      property.yearBuilt,
      property.lotSize,
      1.0,
      'manual',
      1,
      JSON.stringify(property)
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error adding manual match:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/permits/:id/reject-match - Reject a match
router.post('/:id/reject-match', (req, res) => {
  try {
    const { matchId } = req.body;
    
    // Delete the match
    db.prepare('DELETE FROM permit_mls_matches WHERE id = ? AND permit_id = ?').run(matchId, req.params.id);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error rejecting match:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/permits/:id - Delete a permit
router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM permit_mls_matches WHERE permit_id = ?').run(req.params.id);
    db.prepare('DELETE FROM permits WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting permit:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/permits - Clear all permits
router.delete('/', (req, res) => {
  try {
    db.prepare('DELETE FROM permit_mls_matches').run();
    db.prepare('DELETE FROM permits').run();
    res.json({ success: true });
  } catch (error) {
    console.error('Error clearing permits:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
