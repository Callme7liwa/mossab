#!/usr/bin/env node

/**
 * Test Bridge API for specific towns, statuses, and property types
 * Target: 7 MA towns, single-family homes, all statuses
 */

const BRIDGE_API_BASE = "https://api.bridgedataoutput.com/api/v2/OData/shared_mlspin_0705dd4";
const BRIDGE_API_TOKEN = "725919c8f3653746355154239821a3b1";

// Target configuration
const TOWNS = ["Weston", "Wellesley", "Newton", "Needham", "Dover", "Natick", "Westwood"];
const STATUSES = ["Active", "Pending", "Sold", "Contingent", "Withdrawn", "Off Market"];
const PROPERTY_TYPE = "Residential";
const PROPERTY_SUBTYPE = "Single Family";

/**
 * Build OData filter string
 */
function buildFilter(includeSubtype = true) {
  // City filter: (City eq 'Weston' or City eq 'Wellesley' or ...)
  const cityFilter = TOWNS.map(town => `City eq '${town}'`).join(" or ");
  
  // Status filter: (StandardStatus eq 'Active' or StandardStatus eq 'Pending' or ...)
  const statusFilter = STATUSES.map(status => `StandardStatus eq '${status}'`).join(" or ");
  
  // Property type filter - try without subtype first
  let typeFilter = `PropertyType eq '${PROPERTY_TYPE}'`;
  if (includeSubtype) {
    typeFilter += ` and PropertySubType eq '${PROPERTY_SUBTYPE}'`;
  }
  
  // Combine all filters
  const fullFilter = `(${cityFilter}) and (${statusFilter}) and ${typeFilter}`;
  return fullFilter;
}

/**
 * Count total properties matching filter
 */
async function countProperties() {
  // Try both with and without subtype filter
  console.log("\n🔍 COUNTING MATCHING PROPERTIES\n");
  console.log("Towns:", TOWNS.join(", "));
  console.log("Statuses:", STATUSES.join(", "));
  console.log("Property Type:", PROPERTY_TYPE);
  console.log("Property SubType:", PROPERTY_SUBTYPE);
  console.log("");
  
  // Try with subtype
  console.log("Test 1: WITH PropertySubType filter");
  const filterWithSubtype = buildFilter(true);
  const urlWithSubtype = `${BRIDGE_API_BASE}/Property?$filter=${encodeURIComponent(filterWithSubtype)}&$count=true`;
  
  let count = 0;
  try {
    const response = await fetch(urlWithSubtype, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${BRIDGE_API_TOKEN}`,
        "Accept": "application/json"
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      count = data["@odata.count"] || data.value?.length || 0;
      console.log(`  Result: ${count.toLocaleString()} properties OK\n`);
    } else {
      console.log(`  Error: API returned ${response.status}\n`);
    }
  } catch (error) {
    console.log(`  Error: ${error.message}\n`);
  }
  
  // If zero, try without subtype  
  if (count === 0) {
    console.log("Test 2: WITHOUT PropertySubType filter (just Residential type)");
    const filterWithoutSubtype = buildFilter(false);
    const urlWithoutSubtype = `${BRIDGE_API_BASE}/Property?$filter=${encodeURIComponent(filterWithoutSubtype)}&$count=true`;
    
    try {
      const response = await fetch(urlWithoutSubtype, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${BRIDGE_API_TOKEN}`,
          "Accept": "application/json"
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        count = data["@odata.count"] || data.value?.length || 0;
        console.log(`  Result: ${count.toLocaleString()} properties OK\n`);
        console.log("  Note: Data includes all residential types (including condos, multi-family, etc.)");
        console.log("  Note: You may want to filter by PropertySubType after fetching\n");
      } else {
        console.log(`  Error: API returned ${response.status}\n`);
      }
    } catch (error) {
      console.log(`  Error: ${error.message}\n`);
    }
  }
  
  console.log(`OK TOTAL PROPERTIES FOUND: ${count.toLocaleString()}`);
  console.log(`   (Properties in 7 towns, all statuses, residential type)\n`);
  
  return count;
}

/**
 * Get properties by status
 */
async function getByStatus() {
  console.log("Status Breakdown\n");
  
  const results = {};
  
  for (const status of STATUSES) {
    const cityFilter = TOWNS.map(town => `City eq '${town}'`).join(" or ");
    const filter = `(${cityFilter}) and StandardStatus eq '${status}' and PropertyType eq '${PROPERTY_TYPE}'`;
    
    const url = `${BRIDGE_API_BASE}/Property?$filter=${encodeURIComponent(filter)}&$count=true&$top=1`;
    
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${BRIDGE_API_TOKEN}`,
          "Accept": "application/json"
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const count = data["@odata.count"] || 0;
        results[status] = count;
        console.log(`  ${status.padEnd(12)} : ${count.toLocaleString()} properties`);
      }
    } catch (error) {
      console.log(`  ${status.padEnd(12)} : Error - ${error.message}`);
    }
  }
  
  console.log("");
  return results;
}

/**
 * Get sample properties to analyze fields
 */
async function getSampleProperties() {
  console.log("Sample Properties\n");
  
  const cityFilter = TOWNS.map(town => `City eq '${town}'`).join(" or ");
  const filter = `(${cityFilter}) and PropertyType eq '${PROPERTY_TYPE}'`;
  const url = `${BRIDGE_API_BASE}/Property?$filter=${encodeURIComponent(filter)}&$select=StreetNumber,StreetName,City,StateOrProvince,ListPrice,ClosePrice,PropertyType,PropertySubType,StandardStatus,BedroomsTotal,BathroomsTotalInteger,LivingArea&$top=5`;
  
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${BRIDGE_API_TOKEN}`,
        "Accept": "application/json"
      }
    });
    
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.value && data.value.length > 0) {
      data.value.forEach((prop, index) => {
        console.log(`\nProperty ${index + 1}:`);
        console.log(`  Address: ${prop.StreetNumber} ${prop.StreetName}, ${prop.City}`);
        console.log(`  Type: ${prop.PropertyType}`);
        console.log(`  SubType: ${prop.PropertySubType}`);
        console.log(`  Status: ${prop.StandardStatus}`);
        console.log(`  Price: $${(prop.ListPrice || prop.ClosePrice || 0).toLocaleString()}`);
        console.log(`  Beds: ${prop.BedroomsTotal || "N/A"}`);
        console.log(`  Baths: ${prop.BathroomsTotalInteger || "N/A"}`);
        console.log(`  Sqft: ${(prop.LivingArea || "N/A").toLocaleString()}`);
      });
    } else {
      console.log("No properties returned from API");
    }
    
    console.log("\n");
  } catch (error) {
    console.error("Error:", error.message);
  }
}

/**
 * Estimate storage needs
 */
async function estimateStorage(count) {
  console.log("💾 STORAGE ESTIMATION\n");
  
  // Average size per property in bytes
  const avgBytesPerProperty = 10000; // ~10KB per property with full fields
  const minimalBytesPerProperty = 500; // ~500 bytes with selected fields
  
  const fullStorageMB = (count * avgBytesPerProperty) / (1024 * 1024);
  const minimalStorageMB = (count * minimalBytesPerProperty) / (1024 * 1024);
  
  console.log(`  With ALL 389 fields : ~${fullStorageMB.toFixed(1)} MB`);
  console.log(`  With 15 key fields  : ~${minimalStorageMB.toFixed(1)} MB`);
  console.log(`  localStorage limit  : 5-10 MB per domain`);
  
  if (fullStorageMB > 10) {
    console.log(`\n  ⚠️  Full data WON'T fit in localStorage!`);
    console.log(`  💡 Solutions:`);
    console.log(`     1. Use minimal fields (15 key fields) → ${minimalStorageMB.toFixed(1)} MB`);
    console.log(`     2. Add backend database (PostgreSQL)`);
    console.log(`     3. Paginate/load on-demand`);
  } else {
    console.log(`\n  ✅ Fits in localStorage!`);
  }
  
  console.log("");
}

/**
 * Main execution
 */
async function main() {
  console.log("═".repeat(60));
  console.log("BRIDGE API - NARROWED SCOPE TEST");
  console.log("═".repeat(60));
  
  // Count total
  const totalCount = await countProperties();
  
  // Break down by status
  await getByStatus();
  
  // Show sample
  await getSampleProperties();
  
  // Estimate storage
  await estimateStorage(totalCount);
  
  // Recommendations
  console.log("📋 RECOMMENDATIONS\n");
  if (totalCount < 5000) {
    console.log("  ✅ Small dataset! Can use localStorage with minimal fields");
    console.log("  💡 Cache strategy: Store all properties, refresh daily");
  } else if (totalCount < 50000) {
    console.log("  ⚠️  Medium dataset. Options:");
    console.log("     • localStorage with minimal fields + pagination");
    console.log("     • Small backend SQLite database");
    console.log("     • IndexedDB for more storage");
  } else {
    console.log("  ❌ Large dataset! Needs backend:");
    console.log("     • PostgreSQL database");
    console.log("     • Indexed searches");
    console.log("     • Pagination/streaming");
  }
  
  console.log("\n" + "═".repeat(60));
  console.log("TEST COMPLETE");
  console.log("═".repeat(60) + "\n");
}

// Run
main().catch(console.error);
