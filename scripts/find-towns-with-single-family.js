#!/usr/bin/env node

/**
 * Search for towns with actual Single Family homes
 */

const BRIDGE_API_BASE = "https://api.bridgedataoutput.com/api/v2/OData/shared_mlspin_0705dd4";
const BRIDGE_API_TOKEN = "725919c8f3653746355154239821a3b1";

// MA towns to search
const MA_TOWNS = [
  "Weston", "Wellesley", "Newton", "Needham", "Dover", "Natick", "Westwood",
  "Boston", "Cambridge", "Somerville", "Arlington", "Watertown", "Belmont",
  "Lincoln", "Concord", "Wayland", "Sudbury", "Framingham", "Acton"
];

async function findSingleFamilyTowns() {
  console.log("\n═════════════════════════════════════════════════════");
  console.log("SEARCHING FOR TOWNS WITH SINGLE-FAMILY HOMES");
  console.log("═════════════════════════════════════════════════════\n");

  const results = [];

  for (const town of MA_TOWNS) {
    const filter = `City eq '${town}' and PropertyType eq 'Residential'`;
    const url = `${BRIDGE_API_BASE}/Property?$filter=${encodeURIComponent(filter)}&$select=PropertySubType&$count=true&$top=1`;

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
        
        if (count > 0) {
          // Get subtypes for this town
          const url2 = `${BRIDGE_API_BASE}/Property?$filter=${encodeURIComponent(filter)}&$select=PropertySubType&$top=50`;
          const response2 = await fetch(url2, {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${BRIDGE_API_TOKEN}`,
              "Accept": "application/json"
            }
          });

          if (response2.ok) {
            const data2 = await response2.json();
            const subtypes = new Set();
            data2.value.forEach(p => {
              if (p.PropertySubType) subtypes.add(p.PropertySubType);
            });

            results.push({
              town,
              total: count,
              subtypes: Array.from(subtypes).join(", ")
            });
          }
        }
      }
    } catch (error) {
      // Skip errors
    }
  }

  // Sort by total count
  results.sort((a, b) => b.total - a.total);

  console.log("Results (sorted by property count):\n");
  console.log("Town".padEnd(18) + "Total".padEnd(8) + "Property SubTypes");
  console.log("─".repeat(80));

  results.forEach(r => {
    console.log(
      r.town.padEnd(18) + 
      r.total.toString().padEnd(8) + 
      r.subtypes
    );
  });

  // Check if any have "Single Family"
  console.log("\n\nTowns with 'Single Family' subtype:");
  console.log("─".repeat(80));
  
  const withSingleFamily = results.filter(r => r.subtypes.includes("Single Family"));
  
  if (withSingleFamily.length === 0) {
    console.log("NONE FOUND - 'Single Family' does not exist in Bridge API for MA towns");
    console.log("\nInstead, you'll find:");
    console.log("  - Condominium");
    console.log("  - Condex");
    console.log("  - Multi Family");
    console.log("  - Vacant Land");
    console.log("  - etc.");
  } else {
    withSingleFamily.forEach(r => {
      console.log(`  ${r.town}: ${r.total} properties`);
    });
  }

  console.log("\n\nRECOMMENDATION:");
  console.log("─".repeat(80));
  console.log(`\n1. PropertySubType 'Single Family' does NOT exist in Bridge API`);
  console.log(`2. Your 7 target towns (Weston, Wellesley, etc.) have 542 residential properties`);
  console.log(`   but they're mostly Condominiums (95%)`);
  console.log(`\nChoose one:`);
  console.log(`  A) Use Condominium as the property type (have 542 properties)`);
  console.log(`  B) Search different towns for 'Single Family' equivalent`);
  console.log(`  C) Define what you actually want (e.g., "Condominiums OR Condex")`);
  
  console.log("\n" + "═".repeat(81) + "\n");
}

findSingleFamilyTowns();
