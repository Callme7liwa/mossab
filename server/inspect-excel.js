#!/usr/bin/env node
import xlsx from "xlsx";
import path from "path";

const PERMITS_FILE = "vLIVE.2025-1.20.26_new construction tracker  (1).xlsx";
const MLS_FILE = "vSHARE.2021-2024 years New Con B.P. and MLS sold data.unmapped.xlsx";

function inspectWorkbook(filePath, label) {
  const wb = xlsx.readFile(path.resolve(filePath), { cellDates: true });
  console.log(`\n${"=".repeat(80)}`);
  console.log(`WORKBOOK: ${label}`);
  console.log(`File: ${filePath}`);
  console.log(`Sheets: ${wb.SheetNames.length}`);
  console.log(`${"=".repeat(80)}`);

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: null, raw: false });
    
    console.log(`\n--- Sheet: "${sheetName}" (${rows.length} rows) ---`);
    
    if (rows.length === 0) {
      console.log("  (empty sheet)");
      continue;
    }

    const columns = Object.keys(rows[0]);
    console.log(`Columns (${columns.length}):`);
    columns.forEach((col, i) => {
      // Sample first non-null value for this column
      let sample = null;
      for (const row of rows.slice(0, 20)) {
        if (row[col] !== null && row[col] !== undefined && row[col] !== "") {
          sample = String(row[col]).substring(0, 50);
          break;
        }
      }
      console.log(`  ${i + 1}. "${col}" => sample: ${sample || "(empty)"}`);
    });

    // Show 2 sample rows
    console.log(`\nSample rows:`);
    for (let i = 0; i < Math.min(2, rows.length); i++) {
      const row = rows[i];
      const preview = {};
      for (const key of columns.slice(0, 8)) {
        preview[key] = row[key];
      }
      console.log(`  Row ${i + 1}:`, JSON.stringify(preview, null, 2).substring(0, 500));
    }
  }
}

inspectWorkbook(PERMITS_FILE, "PERMITS / LIVE TRACKER");
inspectWorkbook(MLS_FILE, "MLS / HISTORICAL");
