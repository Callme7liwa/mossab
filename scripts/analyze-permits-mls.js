#!/usr/bin/env node
import fs from "fs";
import path from "path";
import xlsx from "xlsx";

const DEFAULT_PERMITS = "vLIVE.2025-1.20.26_new construction tracker  (1).xlsx";
const DEFAULT_MLS = "vSHARE.2021-2024 years New Con B.P. and MLS sold data.unmapped.xlsx";

const args = parseArgs(process.argv.slice(2));
const permitsPath = args.permits || DEFAULT_PERMITS;
const mlsPath = args.mls || DEFAULT_MLS;
const outDir = args.out ? path.resolve(args.out) : null;
const fuzzyThreshold = Number(args["min-fuzzy"] || 0.92);

const permitsWb = readWorkbook(permitsPath, "permits");
const mlsWb = readWorkbook(mlsPath, "mls");

// If user passed a specific sheet name, use only that sheet; otherwise process ALL sheets
const permitsSheetArg = args["permits-sheet"] || null;
const mlsSheetArg = args["mls-sheet"] || null;

const permitsRows = workbookToRows(permitsWb, permitsSheetArg, scorePermitSheet);
const mlsRows = workbookToRows(mlsWb, mlsSheetArg, scoreMlsSheet);

const permitsAddressField =
  args["permits-address-field"] || detectAddressField(permitsRows);
const mlsAddressField =
  args["mls-address-field"] || detectAddressField(mlsRows);

const permits = permitsRows.map((row) => {
  const addressRaw = extractAddress(row, permitsAddressField);
  return {
    raw: row,
    addressRaw,
    addressNorm: normalizeAddress(addressRaw),
    dateSubmitted: parseDate(pickField(row, [
      "Date Submitted",
      "Date",
      "Submitted Date",
      "Permit Date",
    ])),
    recordId: pickField(row, ["Record #", "Record", "Record Number", "Permit #"]),
    estCost: parseNumber(pickField(row, [
      "Total Estimated New Construction Cost",
      "Total Estimated Cost",
      "Total Estimated New Construction Cost ",
      "Total Estimated New Construction Cost",
      "Total Estimated Cost",
    ])),
    demoCost: parseNumber(pickField(row, [
      "Demolition: Total Estimated Cost",
      "Demolition Total Estimated Cost",
      "Demolition Cost",
    ])),
    recordStatus: pickField(row, ["Record Status", "Status"]),
    typeOfWork: pickField(row, ["Type of Proposed Work", "Type of Work", "Type of Project"]),
  };
});

const mls = mlsRows.map((row) => {
  const addressRaw = extractAddress(row, mlsAddressField);
  return {
    raw: row,
    addressRaw,
    addressNorm: normalizeAddress(addressRaw),
    listNo: pickField(row, ["LIST_NO", "List No", "List Number", "MLS #", "MLS"]),
    listDate: parseDate(pickField(row, ["LIST_DATE", "List Date"])),
    offerDate: parseDate(pickField(row, ["OFFER_DATE", "Offer Date"])),
    settledDate: parseDate(pickField(row, ["SETTLED_DATE", "Settled Date", "Sale Date"])),
    listPrice: parseNumber(pickField(row, ["LIST_PRICE", "List Price"])),
    salePrice: parseNumber(pickField(row, ["SALE_PRICE", "Sale Price", "LIST_OR_SALE_PRICE"])),
    sqft: parseNumber(pickField(row, ["SQUARE_FEET", "Square Feet", "AboveGradeFinishedArea"])),
    yearBuilt: parseNumber(pickField(row, ["YEAR_BUILT", "Year Built"])),
  };
});

const mlsByAddress = new Map();
for (const row of mls) {
  if (!row.addressNorm) continue;
  if (!mlsByAddress.has(row.addressNorm)) {
    mlsByAddress.set(row.addressNorm, []);
  }
  mlsByAddress.get(row.addressNorm).push(row);
}

const uniqueMlsAddresses = Array.from(mlsByAddress.keys());

const matches = [];
const unmatched = [];

for (const permit of permits) {
  if (!permit.addressNorm) {
    unmatched.push({ permit, reason: "no_address" });
    continue;
  }

  const exactMatches = mlsByAddress.get(permit.addressNorm);
  if (exactMatches && exactMatches.length > 0) {
    const chosen = pickBestMlsMatch(exactMatches);
    matches.push(buildMatch(permit, chosen, "exact", 1));
    continue;
  }

  const fuzzy = findBestFuzzyMatch(permit.addressNorm, uniqueMlsAddresses);
  if (fuzzy && fuzzy.score >= fuzzyThreshold) {
    const chosen = pickBestMlsMatch(mlsByAddress.get(fuzzy.addressNorm) || []);
    matches.push(buildMatch(permit, chosen, "fuzzy", fuzzy.score));
  } else {
    unmatched.push({ permit, reason: "no_match" });
  }
}

printSummary({
  permitsPath,
  mlsPath,
  permitsSheet: permitsRows.__detectedBestSheet,
  mlsSheet: mlsRows.__detectedBestSheet,
  permitsRows,
  mlsRows,
  permitsAddressField,
  mlsAddressField,
  permits,
  mls,
  matches,
  unmatched,
});

if (outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  writeCsv(path.join(outDir, "permits_clean.csv"), permits.map((p) => ({
    record_id: p.recordId,
    address_raw: p.addressRaw,
    address_norm: p.addressNorm,
    date_submitted: formatDate(p.dateSubmitted),
    est_cost: p.estCost,
    demo_cost: p.demoCost,
    record_status: p.recordStatus,
    type_of_work: p.typeOfWork,
  })));

  writeCsv(path.join(outDir, "mls_clean.csv"), mls.map((m) => ({
    list_no: m.listNo,
    address_raw: m.addressRaw,
    address_norm: m.addressNorm,
    list_date: formatDate(m.listDate),
    offer_date: formatDate(m.offerDate),
    settled_date: formatDate(m.settledDate),
    list_price: m.listPrice,
    sale_price: m.salePrice,
    sqft: m.sqft,
    year_built: m.yearBuilt,
  })));

  writeCsv(path.join(outDir, "matches.csv"), matches.map((m) => ({
    permit_record_id: m.permit.recordId,
    permit_address: m.permit.addressRaw,
    permit_date: formatDate(m.permit.dateSubmitted),
    permit_est_cost: m.permit.estCost,
    mls_list_no: m.mls?.listNo || "",
    mls_address: m.mls?.addressRaw || "",
    mls_list_date: formatDate(m.mls?.listDate),
    mls_settled_date: formatDate(m.mls?.settledDate),
    mls_sale_price: m.mls?.salePrice || "",
    match_type: m.matchType,
    match_score: m.matchScore,
    time_to_list_days: m.timeToListDays,
    time_to_sale_days: m.timeToSaleDays,
    sale_to_cost_ratio: m.saleToCostRatio,
  })));

  writeCsv(path.join(outDir, "unmatched.csv"), unmatched.map((u) => ({
    permit_record_id: u.permit.recordId,
    permit_address: u.permit.addressRaw,
    reason: u.reason,
  })));

  fs.writeFileSync(
    path.join(outDir, "report.json"),
    JSON.stringify({
      summary: {
        permits_rows: permits.length,
        mls_rows: mls.length,
        exact_matches: matches.filter((m) => m.matchType === "exact").length,
        fuzzy_matches: matches.filter((m) => m.matchType === "fuzzy").length,
        unmatched: unmatched.length,
      },
    }, null, 2)
  );

  console.log(`\nOutputs written to: ${outDir}`);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : true;
    out[key] = value;
  }
  return out;
}

function readWorkbook(filePath, label) {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    console.error(`Missing ${label} file: ${resolved}`);
    process.exit(1);
  }
  return xlsx.readFile(resolved, { cellDates: true });
}

function sheetToRows(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    console.error(`Sheet not found: ${sheetName}`);
    process.exit(1);
  }
  return xlsx.utils.sheet_to_json(sheet, { defval: null, raw: false });
}

function detectBestSheet(workbook, scorer) {
  const scores = workbook.SheetNames.map((name) => ({
    name,
    score: scorer(sheetToRows(workbook, name)),
  }));
  scores.sort((a, b) => b.score - a.score);
  return scores[0]?.name || workbook.SheetNames[0];
}

function workbookToRows(workbook, sheetArg, scorer) {
  // Returns combined rows from either a specific sheet (if sheetArg provided)
  // or from all sheets. Each returned row will have a `__sheetName` field
  // to identify its origin. If all-sheets are processed, we also try to
  // detect the best sheet name for reporting via scorer.
  const all = [];
  const sheetNames = sheetArg ? [sheetArg] : workbook.SheetNames;

  for (const name of sheetNames) {
    if (!workbook.Sheets[name]) continue;
    const rows = xlsx.utils.sheet_to_json(workbook.Sheets[name], { defval: null, raw: false });
    for (const r of rows) {
      r.__sheetName = name;
      all.push(r);
    }
  }

  // If no explicit sheetArg and multiple sheets exist, and a scorer is provided,
  // choose the highest scoring sheet name for compatibility with older behavior.
  all.__detectedBestSheet = sheetArg || (scorer ? detectBestSheet(workbook, scorer) : workbook.SheetNames[0]);
  return all;
}

function scorePermitSheet(rows) {
  if (rows.length === 0) return 0;
  const keys = Object.keys(rows[0]);
  return scoreByKeys(keys, [
    "Record #",
    "Record Type",
    "Date Submitted",
    "Applicant",
    "Permit",
    "Type of Work",
    "Address",
  ]);
}

function scoreMlsSheet(rows) {
  if (rows.length === 0) return 0;
  const keys = Object.keys(rows[0]);
  return scoreByKeys(keys, [
    "LIST_NO",
    "ADDRESS",
    "LIST_DATE",
    "SALE_PRICE",
    "SQUARE_FEET",
  ]);
}

function scoreByKeys(keys, targets) {
  const lower = keys.map((k) => k.toLowerCase());
  return targets.reduce((sum, t) => {
    const hit = lower.some((k) => k.includes(t.toLowerCase()));
    return sum + (hit ? 1 : 0);
  }, 0) + keys.length * 0.001;
}

function detectAddressField(rows) {
  if (!rows.length) return null;
  const keys = Object.keys(rows[0]);
  const priority = [
    "Full Address",
    "Address",
    "ADDRESS",
    "Property Address",
    "Street Address",
  ];
  for (const p of priority) {
    const hit = keys.find((k) => k.toLowerCase() === p.toLowerCase());
    if (hit) return hit;
  }
  const fallback = keys.find((k) => /address/i.test(k));
  return fallback || null;
}

function extractAddress(row, addressField) {
  if (addressField && row[addressField]) return String(row[addressField]).trim();

  const keys = Object.keys(row);
  const addressKeys = keys.filter((k) =>
    /(address|street|road|avenue|ave|boulevard|blvd|drive|dr|lane|ln|way|circle|cir|court|ct|terrace|ter|place|pl|parkway|pkwy|route|rte|highway|hwy|full)/i.test(k)
  );
  const cityKeys = keys.filter((k) => /(town|city)/i.test(k));
  const stateKeys = keys.filter((k) => /(state)/i.test(k));
  const zipKeys = keys.filter((k) => /(zip|postal)/i.test(k));

  const parts = [];
  for (const k of addressKeys) addPart(parts, row[k]);
  for (const k of cityKeys) addPart(parts, row[k]);
  for (const k of stateKeys) addPart(parts, row[k]);
  for (const k of zipKeys) addPart(parts, row[k]);

  return parts.join(" ").trim();
}

function addPart(parts, value) {
  if (value === null || value === undefined) return;
  const str = String(value).trim();
  if (!str) return;
  parts.push(str);
}

function normalizeAddress(value) {
  if (!value) return "";
  let v = String(value).toUpperCase();
  v = v.replace(/[.,]/g, " ");
  v = v.replace(/\s+/g, " ").trim();

  const replacements = {
    " ROAD": " RD",
    " STREET": " ST",
    " AVENUE": " AVE",
    " DRIVE": " DR",
    " LANE": " LN",
    " TERRACE": " TER",
    " COURT": " CT",
    " CIRCLE": " CIR",
    " PLACE": " PL",
    " PARKWAY": " PKWY",
    " BOULEVARD": " BLVD",
    " HIGHWAY": " HWY",
    " ROUTE": " RTE",
  };

  for (const [from, to] of Object.entries(replacements)) {
    v = v.replaceAll(from, to);
  }

  v = v.replace(/\s+/g, " ").trim();
  return v;
}

function pickField(row, keys) {
  for (const key of keys) {
    const match = Object.keys(row).find(
      (k) => k.toLowerCase() === key.toLowerCase()
    );
    if (match && row[match] !== null && row[match] !== undefined) {
      return row[match];
    }
  }
  return null;
}

function parseNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return value;
  let str = String(value).trim();
  if (!str) return null;

  str = str.replace(/[^0-9,.-]/g, "");
  if (!str) return null;

  const lastComma = str.lastIndexOf(",");
  const lastDot = str.lastIndexOf(".");
  if (lastComma !== -1 && lastDot !== -1) {
    if (lastComma > lastDot) {
      str = str.replace(/\./g, "");
      str = str.replace(",", ".");
    } else {
      str = str.replace(/,/g, "");
    }
  } else if (lastComma !== -1) {
    if (str.match(/,\d{1,2}$/)) {
      str = str.replace(",", ".");
    } else {
      str = str.replace(/,/g, "");
    }
  }

  const num = Number(str);
  return Number.isNaN(num) ? null : num;
}

function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "number") {
    const date = xlsx.SSF.parse_date_code(value);
    if (!date) return null;
    return new Date(Date.UTC(date.y, date.m - 1, date.d));
  }
  const str = String(value).trim();
  if (!str) return null;
  const parts = str.split(/[\\/\\-]/);
  if (parts.length >= 3) {
    const [a, b, c] = parts.map((p) => p.replace(/\D/g, ""));
    if (a && b && c) {
      const dayFirst = Number(a) > 12;
      const day = dayFirst ? Number(a) : Number(b);
      const month = dayFirst ? Number(b) : Number(a);
      const year = Number(c.length === 2 ? `20${c}` : c);
      const date = new Date(year, month - 1, day);
      if (!Number.isNaN(date.getTime())) return date;
    }
  }
  const date = new Date(str);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(date) {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

function jaroWinkler(a, b) {
  if (a === b) return 1;
  const maxDist = Math.floor(Math.max(a.length, b.length) / 2) - 1;
  let matches = 0;
  const aMatches = Array(a.length).fill(false);
  const bMatches = Array(b.length).fill(false);

  for (let i = 0; i < a.length; i += 1) {
    const start = Math.max(0, i - maxDist);
    const end = Math.min(i + maxDist + 1, b.length);
    for (let j = start; j < end; j += 1) {
      if (bMatches[j]) continue;
      if (a[i] !== b[j]) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matches += 1;
      break;
    }
  }

  if (!matches) return 0;

  let t = 0;
  let k = 0;
  for (let i = 0; i < a.length; i += 1) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k += 1;
    if (a[i] !== b[k]) t += 1;
    k += 1;
  }
  t /= 2;

  const jaro =
    (matches / a.length +
      matches / b.length +
      (matches - t) / matches) /
    3;

  let prefix = 0;
  for (let i = 0; i < Math.min(4, a.length, b.length); i += 1) {
    if (a[i] === b[i]) prefix += 1;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

function findBestFuzzyMatch(needle, haystack) {
  let best = null;
  for (const candidate of haystack) {
    const score = jaroWinkler(needle, candidate);
    if (!best || score > best.score) {
      best = { addressNorm: candidate, score };
    }
  }
  return best;
}

function pickBestMlsMatch(list) {
  if (!list || list.length === 0) return null;
  return list.reduce((best, current) => {
    if (!best) return current;
    const bestDate = best.settledDate || best.listDate || new Date(0);
    const currentDate = current.settledDate || current.listDate || new Date(0);
    return currentDate > bestDate ? current : best;
  }, null);
}

function buildMatch(permit, mlsRow, matchType, matchScore) {
  const timeToListDays =
    permit.dateSubmitted && mlsRow?.listDate
      ? Math.round((mlsRow.listDate - permit.dateSubmitted) / (1000 * 60 * 60 * 24))
      : null;
  const timeToSaleDays =
    permit.dateSubmitted && mlsRow?.settledDate
      ? Math.round((mlsRow.settledDate - permit.dateSubmitted) / (1000 * 60 * 60 * 24))
      : null;
  const saleToCostRatio =
    permit.estCost && mlsRow?.salePrice
      ? Number((mlsRow.salePrice / permit.estCost).toFixed(2))
      : null;

  return {
    permit,
    mls: mlsRow,
    matchType,
    matchScore,
    timeToListDays,
    timeToSaleDays,
    saleToCostRatio,
  };
}

function printSummary({
  permitsPath,
  mlsPath,
  permitsSheet,
  mlsSheet,
  permitsRows,
  mlsRows,
  permitsAddressField,
  mlsAddressField,
  permits,
  mls,
  matches,
  unmatched,
}) {
  console.log("\n=== Input Summary ===");
  console.log(`Permits file: ${permitsPath}`);
  console.log(`Permits sheet: ${permitsSheet}`);
  // If multiple sheets were processed, show breakdown
  const permitSheetCounts = {};
  for (const r of permitsRows) {
    const s = r.__sheetName || '(unknown)';
    permitSheetCounts[s] = (permitSheetCounts[s] || 0) + 1;
  }
  if (Object.keys(permitSheetCounts).length > 1) {
    console.log(`Permits rows (by sheet):`);
    for (const [s, c] of Object.entries(permitSheetCounts)) console.log(`  - ${s}: ${c}`);
    console.log(`Permits total rows: ${permitsRows.length}`);
  } else {
    console.log(`Permits rows: ${permitsRows.length}`);
  }
  console.log(`Permits address field: ${permitsAddressField || "auto-composed"}`);

  console.log(`\nMLS file: ${mlsPath}`);
  console.log(`MLS sheet: ${mlsSheet}`);
  const mlsSheetCounts = {};
  for (const r of mlsRows) {
    const s = r.__sheetName || '(unknown)';
    mlsSheetCounts[s] = (mlsSheetCounts[s] || 0) + 1;
  }
  if (Object.keys(mlsSheetCounts).length > 1) {
    console.log(`MLS rows (by sheet):`);
    for (const [s, c] of Object.entries(mlsSheetCounts)) console.log(`  - ${s}: ${c}`);
    console.log(`MLS total rows: ${mlsRows.length}`);
  } else {
    console.log(`MLS rows: ${mlsRows.length}`);
  }
  console.log(`MLS address field: ${mlsAddressField || "auto-composed"}`);

  const permitDates = permits.filter((p) => p.dateSubmitted).length;
  const permitCosts = permits.filter((p) => p.estCost).length;
  const permitAddresses = permits.filter((p) => p.addressNorm).length;

  const mlsListDates = mls.filter((m) => m.listDate).length;
  const mlsSaleDates = mls.filter((m) => m.settledDate).length;
  const mlsAddresses = mls.filter((m) => m.addressNorm).length;

  console.log("\n=== Data Quality ===");
  console.log(`Permits with address: ${permitAddresses}/${permits.length}`);
  console.log(`Permits with date submitted: ${permitDates}/${permits.length}`);
  console.log(`Permits with est. cost: ${permitCosts}/${permits.length}`);
  console.log(`MLS with address: ${mlsAddresses}/${mls.length}`);
  console.log(`MLS with list date: ${mlsListDates}/${mls.length}`);
  console.log(`MLS with settled date: ${mlsSaleDates}/${mls.length}`);

  console.log("\n=== Matching ===");
  const exactCount = matches.filter((m) => m.matchType === "exact").length;
  const fuzzyCount = matches.filter((m) => m.matchType === "fuzzy").length;
  console.log(`Exact matches: ${exactCount}`);
  console.log(`Fuzzy matches (>= ${fuzzyThreshold}): ${fuzzyCount}`);
  console.log(`Unmatched permits: ${unmatched.length}`);

  const sampleUnmatched = unmatched.slice(0, 10).map((u) => u.permit.addressRaw);
  if (sampleUnmatched.length) {
    console.log("\nSample unmatched addresses:");
    for (const addr of sampleUnmatched) console.log(`- ${addr}`);
  }

  const sampleMatches = matches.slice(0, 10).map((m) => ({
    permit: m.permit.addressRaw,
    mls: m.mls?.addressRaw,
    type: m.matchType,
    score: m.matchScore,
  }));
  if (sampleMatches.length) {
    console.log("\nSample matches:");
    for (const row of sampleMatches) {
      console.log(
        `- ${row.permit} -> ${row.mls} (${row.type}, ${row.score})`
      );
    }
  }
}

function writeCsv(filePath, rows) {
  if (!rows.length) {
    fs.writeFileSync(filePath, "");
    return;
  }
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    const line = headers
      .map((h) => {
        const value = row[h] === null || row[h] === undefined ? "" : String(row[h]);
        const escaped = value.replace(/"/g, '""');
        return `"${escaped}"`;
      })
      .join(",");
    lines.push(line);
  }
  fs.writeFileSync(filePath, lines.join("\n"));
}
