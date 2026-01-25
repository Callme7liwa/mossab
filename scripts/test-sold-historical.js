#!/usr/bin/env node

/**
 * Test: Can we get SOLD historical data (last 10 years)?
 * Jennifer suggested querying sold within 10 years for historical data
 */

const BRIDGE_API_BASE = "https://api.bridgedataoutput.com/api/v2/OData/shared_mlspin_0705dd4";
const BRIDGE_API_TOKEN = "725919c8f3653746355154239821a3b1";

const TOWNS = ["Weston", "Wellesley", "Newton", "Needham", "Dover", "Natick", "Westwood"];

async function testSoldData() {
  console.log("\n═════════════════════════════════════════════════════");
  console.log("TESTING: Historical SOLD Data (Last 10 Years)");
  console.log("═════════════════════════════════════════════════════\n");

  const cityFilter = TOWNS.map(town => `City eq '${town}'`).join(" or ");

  // Test 1: Check all Sold properties (no date filter)
  console.log("Test 1: ALL Sold properties (no date filter)...\n");
  
  const soldFilter = `(${cityFilter}) and (StandardStatus eq 'Sold' or StandardStatus eq 'Closed')`;
  const soldUrl = `${BRIDGE_API_BASE}/Property?$filter=${encodeURIComponent(soldFilter)}&$count=true&$top=1`;

  try {
    const response = await fetch(soldUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${BRIDGE_API_TOKEN}`,
        "Accept": "application/json"
      }
    });

    if (response.ok) {
      const data = await response.json();
      const count = data["@odata.count"] || 0;
      console.log(`  Sold/Closed (all time): ${count.toLocaleString()} properties\n`);
    } else {
      console.log(`  Error: ${response.status}\n`);
    }
  } catch (e) {
    console.log(`  Error: ${e.message}\n`);
  }

  // Test 2: Try different status names
  console.log("Test 2: Trying different status names...\n");
  
  const statusNames = ["Sold", "Closed", "Settled", "Expired", "Canceled"];
  
  for (const status of statusNames) {
    const filter = `(${cityFilter}) and StandardStatus eq '${status}'`;
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
        console.log(`  ${status.padEnd(12)}: ${count.toLocaleString()} properties`);
      }
    } catch (e) {
      console.log(`  ${status.padEnd(12)}: Error`);
    }
  }

  // Test 3: Check CloseDate field
  console.log("\n\nTest 3: Properties with CloseDate (indicates sold)...\n");
  
  const closeDateFilter = `(${cityFilter}) and CloseDate ne null`;
  const closeDateUrl = `${BRIDGE_API_BASE}/Property?$filter=${encodeURIComponent(closeDateFilter)}&$count=true&$top=5`;

  try {
    const response = await fetch(closeDateUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${BRIDGE_API_TOKEN}`,
        "Accept": "application/json"
      }
    });

    if (response.ok) {
      const data = await response.json();
      const count = data["@odata.count"] || 0;
      console.log(`  Properties with CloseDate: ${count.toLocaleString()}\n`);
      
      if (data.value && data.value.length > 0) {
        console.log("  Sample properties with CloseDate:\n");
        data.value.forEach((prop, idx) => {
          console.log(`  ${idx + 1}. ${prop.StreetName}, ${prop.City}`);
          console.log(`     Status: ${prop.StandardStatus}`);
          console.log(`     CloseDate: ${prop.CloseDate}`);
          console.log(`     ClosePrice: $${(prop.ClosePrice || 0).toLocaleString()}`);
          console.log(`     ListPrice: $${(prop.ListPrice || 0).toLocaleString()}`);
          console.log("");
        });
      }
    } else {
      console.log(`  Error: ${response.status}\n`);
    }
  } catch (e) {
    console.log(`  Error: ${e.message}\n`);
  }

  // Test 4: Check ClosePrice field
  console.log("\nTest 4: Properties with ClosePrice (indicates sold)...\n");
  
  const closePriceFilter = `(${cityFilter}) and ClosePrice ne null and ClosePrice gt 0`;
  const closePriceUrl = `${BRIDGE_API_BASE}/Property?$filter=${encodeURIComponent(closePriceFilter)}&$count=true&$top=5`;

  try {
    const response = await fetch(closePriceUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${BRIDGE_API_TOKEN}`,
        "Accept": "application/json"
      }
    });

    if (response.ok) {
      const data = await response.json();
      const count = data["@odata.count"] || 0;
      console.log(`  Properties with ClosePrice > 0: ${count.toLocaleString()}\n`);
      
      if (data.value && data.value.length > 0) {
        console.log("  Sample properties with ClosePrice:\n");
        data.value.forEach((prop, idx) => {
          console.log(`  ${idx + 1}. ${prop.StreetName}, ${prop.City}`);
          console.log(`     Status: ${prop.StandardStatus}`);
          console.log(`     CloseDate: ${prop.CloseDate || "EMPTY"}`);
          console.log(`     ClosePrice: $${(prop.ClosePrice || 0).toLocaleString()}`);
          console.log(`     ListPrice: $${(prop.ListPrice || 0).toLocaleString()}`);
          console.log("");
        });
      }
    } else {
      console.log(`  Error: ${response.status}\n`);
    }
  } catch (e) {
    console.log(`  Error: ${e.message}\n`);
  }

  // Test 5: Check all available StandardStatus values in these towns
  console.log("\nTest 5: All StandardStatus values in 7 towns...\n");
  
  const allFilter = `(${cityFilter})`;
  const allUrl = `${BRIDGE_API_BASE}/Property?$filter=${encodeURIComponent(allFilter)}&$top=200`;

  try {
    const response = await fetch(allUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${BRIDGE_API_TOKEN}`,
        "Accept": "application/json"
      }
    });

    if (response.ok) {
      const data = await response.json();
      const statusCounts = {};
      
      (data.value || []).forEach(prop => {
        const status = prop.StandardStatus || "Unknown";
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });

      console.log("  Status distribution (sample of 200):\n");
      Object.entries(statusCounts)
        .sort((a, b) => b[1] - a[1])
        .forEach(([status, count]) => {
          console.log(`    ${status.padEnd(15)}: ${count}`);
        });
    }
  } catch (e) {
    console.log(`  Error: ${e.message}\n`);
  }

  // Summary
  console.log("\n\n═════════════════════════════════════════════════════");
  console.log("SUMMARY");
  console.log("═════════════════════════════════════════════════════\n");
  console.log("If any test above shows sold/closed data, we CAN build Jennifer's metrics!");
  console.log("If all show 0, we need to ask about alternative data sources.\n");
  console.log("═════════════════════════════════════════════════════\n");
}

testSoldData().catch(console.error);
