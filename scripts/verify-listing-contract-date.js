#!/usr/bin/env node

/**
 * Verify ListingContractDate field
 * Test WITHOUT the "Single Family Residence" filter
 * This will show if the field is populated at all
 */

const BRIDGE_API_BASE = "https://api.bridgedataoutput.com/api/v2/OData/shared_mlspin_0705dd4";
const BRIDGE_API_TOKEN = "725919c8f3653746355154239821a3b1";

const TOWNS = ["Weston", "Wellesley", "Newton", "Needham", "Dover", "Natick", "Westwood"];

async function verifyListingContractDate() {
  console.log("\n═════════════════════════════════════════════════════");
  console.log("VERIFYING: ListingContractDate (WITHOUT Single Family filter)");
  console.log("═════════════════════════════════════════════════════\n");

  // Test 1: Get count of pending properties (no property type filter)
  const cityFilter = TOWNS.map(town => `City eq '${town}'`).join(" or ");
  const countFilter = `(${cityFilter}) and StandardStatus eq 'Pending'`;

  const countUrl = `${BRIDGE_API_BASE}/Property?$filter=${encodeURIComponent(countFilter)}&$count=true&$top=1`;

  try {
    console.log("Step 1: Counting ALL PENDING properties (all types)...\n");
    
    const countResponse = await fetch(countUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${BRIDGE_API_TOKEN}`,
        "Accept": "application/json"
      }
    });

    if (!countResponse.ok) {
      throw new Error(`Count failed: ${countResponse.status}`);
    }

    const countData = await countResponse.json();
    const totalPending = countData["@odata.count"] || 0;

    console.log(`✅ Found ${totalPending} PENDING properties (all types)\n`);

    if (totalPending === 0) {
      console.log("❌ No pending properties at all - can't test\n");
      return;
    }

    // Test 2: Get samples with ListingContractDate
    console.log("Step 2: Fetching 15 samples to check ListingContractDate...\n");

    const sampleUrl = `${BRIDGE_API_BASE}/Property?$filter=${encodeURIComponent(countFilter)}&$top=15`;

    const sampleResponse = await fetch(sampleUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${BRIDGE_API_TOKEN}`,
        "Accept": "application/json"
      }
    });

    if (!sampleResponse.ok) {
      throw new Error(`Sample fetch failed: ${sampleResponse.status}`);
    }

    const sampleData = await sampleResponse.json();
    const properties = sampleData.value || [];

    console.log(`Checking ${properties.length} properties:\n`);

    let withListingContractDate = 0;
    let propertyTypeBreakdown = {};
    let timeToContractData = [];

    properties.forEach((prop, idx) => {
      const propType = prop.PropertySubType || prop.PropertyType || "Unknown";
      
      // Track property types
      if (!propertyTypeBreakdown[propType]) {
        propertyTypeBreakdown[propType] = { total: 0, withDate: 0 };
      }
      propertyTypeBreakdown[propType].total++;

      console.log(`${idx + 1}. ${prop.StreetName}, ${prop.City}`);
      console.log(`   Type: ${propType}`);
      console.log(`   OnMarketDate: ${prop.OnMarketDate || "EMPTY"}`);
      console.log(`   ListingContractDate: ${prop.ListingContractDate || "EMPTY"}`);

      if (prop.ListingContractDate && prop.OnMarketDate) {
        try {
          const onMarket = new Date(prop.OnMarketDate);
          const contract = new Date(prop.ListingContractDate);
          const daysToContract = Math.floor((contract - onMarket) / (1000 * 60 * 60 * 24));
          
          console.log(`   ✅ Days to Pending: ${daysToContract} days`);
          
          propertyTypeBreakdown[propType].withDate++;
          withListingContractDate++;
          timeToContractData.push(daysToContract);
        } catch (e) {
          console.log(`   ⚠️  Date parsing error`);
        }
      } else {
        console.log(`   ❌ Can't calculate - missing dates`);
      }
      console.log("");
    });

    // Summary
    console.log("\n═════════════════════════════════════════════════════");
    console.log("RESULTS");
    console.log("═════════════════════════════════════════════════════\n");

    console.log(`Properties Sampled: ${properties.length}`);
    console.log(`Have ListingContractDate: ${withListingContractDate} (${(withListingContractDate/properties.length*100).toFixed(0)}%)\n`);

    console.log("By Property Type:\n");
    Object.entries(propertyTypeBreakdown).forEach(([type, data]) => {
      console.log(`  ${type}: ${data.withDate}/${data.total} have ListingContractDate`);
    });

    if (withListingContractDate > 0) {
      console.log(`\nDays to Pending (from 10 samples with data):`);
      const sorted = timeToContractData.sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      const avg = (sorted.reduce((a, b) => a + b, 0) / sorted.length).toFixed(0);
      const min = Math.min(...sorted);
      const max = Math.max(...sorted);
      
      console.log(`  Min: ${min} days`);
      console.log(`  Max: ${max} days`);
      console.log(`  Median: ${median} days`);
      console.log(`  Average: ${avg} days`);
    }

    // Final verdict
    console.log(`\n═════════════════════════════════════════════════════`);
    console.log("VERDICT");
    console.log("═════════════════════════════════════════════════════\n");

    if (withListingContractDate === 0) {
      console.log("❌ PROBLEM #3 CONFIRMED: ListingContractDate is NOT populated");
      console.log("   Impact: Can't calculate time from list to pending\n");
    } else if (withListingContractDate >= properties.length * 0.8) {
      console.log("✅ PROBLEM #3 RESOLVED: ListingContractDate IS populated");
      console.log(`   ${withListingContractDate}/${properties.length} properties have the data\n`);
    } else {
      console.log("⚠️  PROBLEM #3 UNCERTAIN: ListingContractDate partially populated");
      console.log(`   ${withListingContractDate}/${properties.length} properties have the data\n`);
    }

    console.log("═════════════════════════════════════════════════════\n");

  } catch (error) {
    console.error("Error:", error.message);
  }
}

verifyListingContractDate();
