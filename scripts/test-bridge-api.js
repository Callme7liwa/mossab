#!/usr/bin/env node

/**
 * Bridge API Data Inspection Script
 * Tests the Bridge API connection and analyzes data structure
 */

const BRIDGE_API_BASE = "https://api.bridgedataoutput.com/api/v2/OData/shared_mlspin_0705dd4";
const BRIDGE_API_TOKEN = "725919c8f3653746355154239821a3b1";

// Color codes for terminal output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
};

function log(text, color = "reset") {
  console.log(`${colors[color]}${text}${colors.reset}`);
}

function header(text) {
  console.log("\n" + colors.bright + colors.blue + "═".repeat(70) + colors.reset);
  console.log(colors.bright + colors.blue + text.padStart(text.length + 5) + colors.reset);
  console.log(colors.bright + colors.blue + "═".repeat(70) + colors.reset + "\n");
}

async function fetchWithRetry(url, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${BRIDGE_API_TOKEN}`,
          "Accept": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      log(`Retry ${i + 1}/${maxRetries - 1}...`, "yellow");
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

function getDataType(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (typeof value === "string") return "string";
  if (Array.isArray(value)) return `array[${value.length}]`;
  if (typeof value === "object") return "object";
  return typeof value;
}

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

async function testBasicConnection() {
  header("TEST 1: Basic API Connection");

  try {
    log("🔍 Testing connection to Bridge API...", "cyan");
    const url = `${BRIDGE_API_BASE}/Property?$top=1&$select=ListingKey,StreetNumber,StreetName`;
    const data = await fetchWithRetry(url);

    if (data.value && data.value.length > 0) {
      log("✅ Connection successful!", "green");
      log(`   Total properties available: ${data["@odata.count"]?.toLocaleString() || "Unknown"}`, "cyan");
    } else {
      log("⚠️  No data returned", "yellow");
    }
  } catch (error) {
    log(`❌ Connection failed: ${error.message}`, "red");
    throw error;
  }
}

async function testDataStructure() {
  header("TEST 2: Data Structure Analysis");

  log("📊 Fetching 10 sample properties...", "cyan");
  const url = `${BRIDGE_API_BASE}/Property?$top=10`;
  const data = await fetchWithRetry(url);

  if (!data.value || data.value.length === 0) {
    log("❌ No properties found", "red");
    return;
  }

  const sample = data.value[0];
  const fieldCount = Object.keys(sample).length;

  log(`✅ Retrieved ${data.value.length} properties`, "green");
  log(`   Total fields per property: ${fieldCount}`, "cyan");
  log(`   Sample property ID: ${sample.ListingKey}`, "cyan");
  log(`   Address: ${sample.UnparsedAddress || `${sample.StreetNumber} ${sample.StreetName}, ${sample.City}`}`, "cyan");

  return { sample, fieldCount, totalFields: Object.keys(sample) };
}

async function testFieldTypes() {
  header("TEST 3: Field Types & Data Quality");

  log("📋 Analyzing field types from 50 properties...", "cyan");
  const url = `${BRIDGE_API_BASE}/Property?$top=50`;
  const data = await fetchWithRetry(url);

  if (!data.value || data.value.length === 0) {
    log("❌ No properties found", "red");
    return;
  }

  const properties = data.value;
  const fieldAnalysis = {};

  // Analyze each field
  properties.forEach((prop) => {
    Object.entries(prop).forEach(([key, value]) => {
      if (!fieldAnalysis[key]) {
        fieldAnalysis[key] = {
          type: getDataType(value),
          populated: 0,
          samples: [],
          nullCount: 0,
        };
      }

      if (value !== null && value !== undefined) {
        fieldAnalysis[key].populated++;
        if (fieldAnalysis[key].samples.length < 2) {
          const sample = Array.isArray(value)
            ? `[${value.length} items]`
            : String(value).substring(0, 50);
          fieldAnalysis[key].samples.push(sample);
        }
      } else {
        fieldAnalysis[key].nullCount++;
      }
    });
  });

  // Group by category
  const categories = {
    address: ["StreetNumber", "StreetName", "City", "StateOrProvince", "PostalCode", "UnparsedAddress"],
    location: ["Latitude", "Longitude", "SubdivisionName", "CityRegion", "CountyOrParish"],
    price: ["ListPrice", "OriginalListPrice", "ClosePrice", "PricePerSqft"],
    size: ["LivingArea", "BuildingAreaTotal", "LotSizeAcres"],
    rooms: ["BedroomsTotal", "BathroomsTotalInteger", "BathroomsTotalDecimal", "BathroomsFull"],
    property: ["PropertyType", "PropertySubType", "YearBuilt", "StoriesTotal"],
    status: ["MlsStatus", "StandardStatus", "ListingContractDate", "StatusChangeTimestamp"],
    media: ["Media", "PhotosCount"],
    other: [],
  };

  const categorized = {};
  Object.entries(fieldAnalysis).forEach(([key, analysis]) => {
    let found = false;
    for (const [category, fields] of Object.entries(categories)) {
      if (fields.includes(key)) {
        if (!categorized[category]) categorized[category] = [];
        categorized[category].push({ key, ...analysis });
        found = true;
        break;
      }
    }
    if (!found) {
      if (!categorized.other) categorized.other = [];
      categorized.other.push({ key, ...analysis });
    }
  });

  // Display by category
  Object.entries(categorized).forEach(([category, fields]) => {
    if (fields.length === 0) return;

    log(`\n${colors.bright}${category.toUpperCase()}${colors.reset}`, "cyan");
    fields.forEach(({ key, type, populated, nullCount, samples }) => {
      const populatedPercent = Math.round((populated / properties.length) * 100);
      const status = populatedPercent === 100 ? "✅" : populatedPercent > 50 ? "⚠️ " : "❌";
      log(
        `  ${status} ${key.padEnd(25)} | Type: ${type.padEnd(15)} | Populated: ${populatedPercent}% (${populated}/${properties.length})`,
        populatedPercent === 100 ? "green" : populatedPercent > 50 ? "yellow" : "dim"
      );
      if (samples.length > 0) {
        log(`     Sample: ${samples[0]}`, "dim");
      }
    });
  });

  return fieldAnalysis;
}

async function testFiltering() {
  header("TEST 4: Data Filtering Options");

  const filters = [
    {
      name: "All Properties",
      filter: null,
      description: "Total count of all properties"
    },
    {
      name: "Active Listings",
      filter: "StandardStatus eq 'Active'",
      description: "Currently listed properties"
    },
    {
      name: "Active + Pending",
      filter: "StandardStatus eq 'Active' or StandardStatus eq 'Pending'",
      description: "Market listings (active or pending sale)"
    },
    {
      name: "Sold Properties",
      filter: "StandardStatus eq 'Closed'",
      description: "Recently closed properties"
    },
    {
      name: "Price Filter ($300k-$600k)",
      filter: "ListPrice ge 300000 and ListPrice le 600000",
      description: "Properties in specific price range"
    },
    {
      name: "Type Filter (Residential)",
      filter: "PropertyType eq 'Residential'",
      description: "Only residential properties"
    },
    {
      name: "Combined Filter",
      filter: "(StandardStatus eq 'Active' or StandardStatus eq 'Pending') and PropertyType eq 'Residential' and ListPrice ge 200000 and ListPrice le 1000000",
      description: "Active/Pending residential between $200k-$1M"
    }
  ];

  for (const filterTest of filters) {
    try {
      let url = `${BRIDGE_API_BASE}/Property?$top=1`;
      if (filterTest.filter) {
        url += `&$filter=${encodeURIComponent(filterTest.filter)}`;
      }

      const data = await fetchWithRetry(url);
      const count = data["@odata.count"] || 0;

      log(`✅ ${filterTest.name}`, "green");
      log(`   Filter: ${filterTest.filter || "(none)"}`, "dim");
      log(`   Description: ${filterTest.description}`, "dim");
      log(`   Count: ${count.toLocaleString()} properties`, "cyan");
      log("");
    } catch (error) {
      log(`❌ ${filterTest.name}: ${error.message}`, "red");
    }
  }
}

async function testStatusValues() {
  header("TEST 5: Available Status Values");

  log("📊 Fetching unique StandardStatus values (up to 100 properties)...", "cyan");

  try {
    const url = `${BRIDGE_API_BASE}/Property?$top=100&$select=StandardStatus`;
    const data = await fetchWithRetry(url);

    const statuses = {};
    data.value.forEach((prop) => {
      const status = prop.StandardStatus || "Unknown";
      statuses[status] = (statuses[status] || 0) + 1;
    });

    log("✅ Status Distribution:", "green");
    Object.entries(statuses)
      .sort((a, b) => b[1] - a[1])
      .forEach(([status, count]) => {
        log(`   "${status}": ${count} properties`, "cyan");
      });
  } catch (error) {
    log(`❌ Failed to fetch status values: ${error.message}`, "red");
  }
}

async function testPropertyTypes() {
  header("TEST 6: Available Property Types");

  log("📊 Fetching property type distribution (up to 100 properties)...", "cyan");

  try {
    const url = `${BRIDGE_API_BASE}/Property?$top=100&$select=PropertyType,PropertySubType`;
    const data = await fetchWithRetry(url);

    const types = {};
    const subTypes = {};
    data.value.forEach((prop) => {
      const type = prop.PropertyType || "Unknown";
      const subType = prop.PropertySubType || "Unknown";

      types[type] = (types[type] || 0) + 1;
      subTypes[subType] = (subTypes[subType] || 0) + 1;
    });

    log("✅ Primary Property Types:", "green");
    Object.entries(types)
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        log(`   "${type}": ${count} properties`, "cyan");
      });

    log("\n✅ Sub-Types (Top 10):", "green");
    Object.entries(subTypes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([subType, count]) => {
        log(`   "${subType}": ${count} properties`, "cyan");
      });
  } catch (error) {
    log(`❌ Failed to fetch property types: ${error.message}`, "red");
  }
}

async function testPerformance() {
  header("TEST 7: API Performance & Response Size");

  const tests = [
    { name: "Minimal (5 fields)", top: 100, select: "ListingKey,StreetNumber,StreetName,City,ListPrice" },
    { name: "Small (15 fields)", top: 100, select: "ListingKey,StreetNumber,StreetName,City,StateOrProvince,PostalCode,ListPrice,LivingArea,BedroomsTotal,BathroomsTotalDecimal,YearBuilt,PropertyType,Status" },
    { name: "Full (all fields)", top: 100, select: null },
  ];

  for (const test of tests) {
    try {
      let url = `${BRIDGE_API_BASE}/Property?$top=${test.top}`;
      if (test.select) {
        url += `&$select=${test.select}`;
      }

      const startTime = Date.now();
      const response = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${BRIDGE_API_TOKEN}`,
          "Accept": "application/json",
        },
      });
      const endTime = Date.now();

      const data = await response.json();
      const responseSize = JSON.stringify(data).length;

      log(`✅ ${test.name}`, "green");
      log(`   Time: ${endTime - startTime}ms`, "cyan");
      log(`   Response Size: ${formatBytes(responseSize)}`, "cyan");
      log(`   Size per property: ${formatBytes(responseSize / data.value.length)}`, "cyan");
      log("");
    } catch (error) {
      log(`❌ ${test.name}: ${error.message}`, "red");
    }
  }
}

async function main() {
  console.clear();
  header("🏘️  BRIDGE DATA OUTPUT API - INSPECTION SCRIPT");
  log("Testing data structure, filtering, and performance", "cyan");

  const args = process.argv.slice(2);
  const testName = args[0]?.toLowerCase();

  try {
    if (!testName || testName === "all") {
      await testBasicConnection();
      await testDataStructure();
      await testFieldTypes();
      await testFiltering();
      await testStatusValues();
      await testPropertyTypes();
      await testPerformance();
    } else if (testName === "connection") {
      await testBasicConnection();
    } else if (testName === "structure") {
      await testDataStructure();
    } else if (testName === "fields") {
      await testFieldTypes();
    } else if (testName === "filters") {
      await testFiltering();
    } else if (testName === "status") {
      await testStatusValues();
    } else if (testName === "types") {
      await testPropertyTypes();
    } else if (testName === "performance") {
      await testPerformance();
    } else if (testName === "questions") {
      log("📚 Available Tests:\n", "bright");
      log("  node scripts/test-bridge-api.js all           - Run all tests", "cyan");
      log("  node scripts/test-bridge-api.js connection    - Test API connection", "cyan");
      log("  node scripts/test-bridge-api.js structure     - Analyze data structure", "cyan");
      log("  node scripts/test-bridge-api.js fields        - Detailed field analysis", "cyan");
      log("  node scripts/test-bridge-api.js filters       - Test filtering options", "cyan");
      log("  node scripts/test-bridge-api.js status        - Check status values", "cyan");
      log("  node scripts/test-bridge-api.js types         - Check property types", "cyan");
      log("  node scripts/test-bridge-api.js performance   - Test response times", "cyan");
      log("  node scripts/test-bridge-api.js questions     - Show this help\n", "cyan");
    } else {
      log(`❌ Unknown test: ${testName}`, "red");
      log("Run: node scripts/test-bridge-api.js questions", "yellow");
      process.exit(1);
    }

    header("✅ Test Complete");
  } catch (error) {
    header("❌ Test Failed");
    log(error.message, "red");
    process.exit(1);
  }
}

main();
