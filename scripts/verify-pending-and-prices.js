#!/usr/bin/env node

/**
 * Verify Problem #3: ListingContractDate (Pending Data)
 * Verify Problem #4: Price Reduction Tracking (OriginalListPrice vs ListPrice)
 */

const BRIDGE_API_BASE = "https://api.bridgedataoutput.com/api/v2/OData/shared_mlspin_0705dd4";
const BRIDGE_API_TOKEN = "725919c8f3653746355154239821a3b1";

const TOWNS = ["Weston", "Wellesley", "Newton", "Needham", "Dover", "Natick", "Westwood"];

async function verifyPendingData() {
  console.log("\n═════════════════════════════════════════════════════");
  console.log("VERIFYING PROBLEM #3: ListingContractDate (Pending)");
  console.log("═════════════════════════════════════════════════════\n");

  const cityFilter = TOWNS.map(town => `City eq '${town}'`).join(" or ");
  const filter = `(${cityFilter}) and PropertyType eq 'Residential' and PropertySubType eq 'Single Family Residence' and StandardStatus eq 'Pending'`;

  const url = `${BRIDGE_API_BASE}/Property?$filter=${encodeURIComponent(filter)}&$select=StreetName,City,StandardStatus,OnMarketDate,ListingContractDate,ListPrice&$top=10`;

  try {
    console.log("Checking 10 PENDING properties...\n");
    
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
    const properties = data.value || [];

    if (properties.length === 0) {
      console.log("❌ NO PENDING PROPERTIES FOUND");
      console.log("   This means we can't test ListingContractDate\n");
      return { found: 0, hasListingContractDate: 0 };
    }

    console.log(`Found ${properties.length} pending properties\n`);

    let withListingContractDate = 0;

    properties.forEach((prop, idx) => {
      console.log(`Property ${idx + 1}: ${prop.StreetName}, ${prop.City}`);
      console.log(`  Status: ${prop.StandardStatus}`);
      console.log(`  OnMarketDate: ${prop.OnMarketDate || "EMPTY"}`);
      console.log(`  ListingContractDate: ${prop.ListingContractDate || "EMPTY"}`);
      
      if (prop.ListingContractDate && prop.OnMarketDate) {
        const onMarket = new Date(prop.OnMarketDate);
        const contract = new Date(prop.ListingContractDate);
        const daysToContract = Math.floor((contract - onMarket) / (1000 * 60 * 60 * 24));
        console.log(`  ✅ Days to Pending: ${daysToContract} days`);
        withListingContractDate++;
      } else {
        console.log(`  ❌ Missing data for calculation`);
      }
      console.log("");
    });

    console.log(`\nRESULT:`);
    console.log(`  Total Pending: ${properties.length}`);
    console.log(`  Have ListingContractDate: ${withListingContractDate} (${(withListingContractDate/properties.length*100).toFixed(0)}%)`);
    
    if (withListingContractDate > 0) {
      console.log(`  ✅ PROBLEM #3 IS RESOLVED - We can calculate time to pending!\n`);
    } else {
      console.log(`  ❌ PROBLEM #3 CONFIRMED - ListingContractDate is empty!\n`);
    }

    return { found: properties.length, hasListingContractDate: withListingContractDate };

  } catch (error) {
    console.error("Error:", error.message);
    return { found: 0, hasListingContractDate: 0 };
  }
}

async function verifyPriceReductions() {
  console.log("\n═════════════════════════════════════════════════════");
  console.log("VERIFYING PROBLEM #4: Price Reductions (Tracking)");
  console.log("═════════════════════════════════════════════════════\n");

  const cityFilter = TOWNS.map(town => `City eq '${town}'`).join(" or ");
  const filter = `(${cityFilter}) and PropertyType eq 'Residential' and PropertySubType eq 'Single Family Residence' and StandardStatus eq 'Active'`;

  const url = `${BRIDGE_API_BASE}/Property?$filter=${encodeURIComponent(filter)}&$select=StreetName,City,ListPrice,OriginalListPrice,LivingArea,StandardStatus&$top=20`;

  try {
    console.log("Checking 20 ACTIVE properties for price reductions...\n");
    
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
    const properties = data.value || [];

    if (properties.length === 0) {
      console.log("❌ NO ACTIVE PROPERTIES FOUND\n");
      return { total: 0, withReductions: 0 };
    }

    console.log(`Found ${properties.length} active properties\n`);

    let withReductions = 0;
    let reductionStats = [];

    properties.forEach((prop, idx) => {
      const original = prop.OriginalListPrice || 0;
      const current = prop.ListPrice || 0;
      
      if (original > 0 && current > 0 && original !== current) {
        const reduction = original - current;
        const reductionPct = (reduction / original * 100).toFixed(1);
        
        console.log(`Property ${idx + 1}: ${prop.StreetName}, ${prop.City}`);
        console.log(`  Original List: $${original.toLocaleString()}`);
        console.log(`  Current List: $${current.toLocaleString()}`);
        console.log(`  Reduction: $${reduction.toLocaleString()} (${reductionPct}%)`);
        console.log(`  ✅ Price reduction detected!\n`);
        
        withReductions++;
        reductionStats.push({
          reduction: reduction,
          pct: parseFloat(reductionPct)
        });
      } else if (original > 0 && current > 0) {
        console.log(`Property ${idx + 1}: ${prop.StreetName}, ${prop.City}`);
        console.log(`  Original List: $${original.toLocaleString()}`);
        console.log(`  Current List: $${current.toLocaleString()}`);
        console.log(`  No price reduction\n`);
      }
    });

    if (withReductions > 0) {
      console.log(`\nRESULT:`);
      console.log(`  Total Checked: ${properties.length}`);
      console.log(`  With Price Reductions: ${withReductions} (${(withReductions/properties.length*100).toFixed(0)}%)`);
      
      const avgReduction = reductionStats.reduce((a, b) => a + b.reduction, 0) / withReductions;
      const avgPct = reductionStats.reduce((a, b) => a + b.pct, 0) / withReductions;
      
      console.log(`  Average Reduction: $${avgReduction.toLocaleString()} (${avgPct.toFixed(1)}%)`);
      console.log(`  ✅ PROBLEM #4 IS RESOLVED - We CAN track price reductions!\n`);
    } else {
      console.log(`\nRESULT:`);
      console.log(`  Total Checked: ${properties.length}`);
      console.log(`  With Price Reductions: 0`);
      console.log(`  ⚠️  No price reductions found in sample`);
      console.log(`  💡 Either no reductions in market, or OriginalListPrice field empty\n`);
    }

    return { total: properties.length, withReductions: withReductions };

  } catch (error) {
    console.error("Error:", error.message);
    return { total: 0, withReductions: 0 };
  }
}

async function main() {
  const pendingResult = await verifyPendingData();
  const priceResult = await verifyPriceReductions();

  console.log("\n═════════════════════════════════════════════════════");
  console.log("VERIFICATION SUMMARY");
  console.log("═════════════════════════════════════════════════════\n");

  console.log("Problem #3: ListingContractDate (Pending Data)");
  if (pendingResult.found === 0) {
    console.log("  Status: ⚠️  UNVERIFIABLE - No pending properties to test");
  } else if (pendingResult.hasListingContractDate > 0) {
    console.log(`  Status: ✅ RESOLVED - ${pendingResult.hasListingContractDate}/${pendingResult.found} pending properties have ListingContractDate`);
  } else {
    console.log(`  Status: ❌ PROBLEM CONFIRMED - No ListingContractDate data`);
  }

  console.log("\nProblem #4: Price Reduction Tracking");
  if (priceResult.withReductions > 0) {
    console.log(`  Status: ✅ RESOLVED - ${priceResult.withReductions}/${priceResult.total} active properties show price reductions`);
  } else if (priceResult.total > 0) {
    console.log(`  Status: ⚠️  UNCERTAIN - OriginalListPrice field might be empty or no reductions in sample`);
  } else {
    console.log(`  Status: ❌ UNVERIFIABLE - No properties to test`);
  }

  console.log("\n" + "═".repeat(51) + "\n");
}

main().catch(console.error);
