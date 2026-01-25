#!/usr/bin/env node

/**
 * Test for "Single Family Residence" PropertySubType in the 7 target towns
 */

const BRIDGE_API_BASE = "https://api.bridgedataoutput.com/api/v2/OData/shared_mlspin_0705dd4";
const BRIDGE_API_TOKEN = "725919c8f3653746355154239821a3b1";

const TOWNS = ["Weston", "Wellesley", "Newton", "Needham", "Dover", "Natick", "Westwood"];
const STATUSES = ["Active", "Pending", "Sold", "Contingent", "Withdrawn", "Off Market"];
const PROPERTY_SUBTYPE = "Single Family Residence";

async function testSingleFamilyResidences() {
  console.log("\n═════════════════════════════════════════════════════");
  console.log("SEARCHING FOR 'Single Family Residence' PROPERTIES");
  console.log("═════════════════════════════════════════════════════\n");

  console.log("Towns: " + TOWNS.join(", "));
  console.log("Property SubType: " + PROPERTY_SUBTYPE);
  console.log("Statuses: " + STATUSES.join(", "));
  console.log("");

  // Count total
  const cityFilter = TOWNS.map(town => `City eq '${town}'`).join(" or ");
  const statusFilter = STATUSES.map(status => `StandardStatus eq '${status}'`).join(" or ");
  const filter = `(${cityFilter}) and (${statusFilter}) and PropertyType eq 'Residential' and PropertySubType eq '${PROPERTY_SUBTYPE}'`;

  const url = `${BRIDGE_API_BASE}/Property?$filter=${encodeURIComponent(filter)}&$count=true`;

  try {
    console.log("Counting total Single Family Residences...\n");
    
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
    const totalCount = data["@odata.count"] || 0;

    console.log(`TOTAL SINGLE FAMILY RESIDENCES: ${totalCount.toLocaleString()}\n`);

    if (totalCount === 0) {
      console.log("ERROR: No properties found with PropertySubType 'Single Family Residence'");
      console.log("This might be the wrong property type name.\n");
    } else {
      // Get breakdown by status
      console.log("Breakdown by Status:\n");
      
      for (const status of STATUSES) {
        const statusFilter2 = `(${cityFilter}) and StandardStatus eq '${status}' and PropertyType eq 'Residential' and PropertySubType eq '${PROPERTY_SUBTYPE}'`;
        const url2 = `${BRIDGE_API_BASE}/Property?$filter=${encodeURIComponent(statusFilter2)}&$count=true&$top=1`;

        try {
          const response2 = await fetch(url2, {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${BRIDGE_API_TOKEN}`,
              "Accept": "application/json"
            }
          });

          if (response2.ok) {
            const data2 = await response2.json();
            const count = data2["@odata.count"] || 0;
            console.log(`  ${status.padEnd(12)} : ${count.toLocaleString()}`);
          }
        } catch (error) {
          console.log(`  ${status.padEnd(12)} : Error`);
        }
      }

      // Get sample
      console.log("\n\nSample Properties:\n");
      const sampleUrl = `${BRIDGE_API_BASE}/Property?$filter=${encodeURIComponent(filter)}&$select=StreetNumber,StreetName,City,ListPrice,ClosePrice,StandardStatus,BedroomsTotal,BathroomsTotalInteger,LivingArea&$top=3`;

      try {
        const sampleResponse = await fetch(sampleUrl, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${BRIDGE_API_TOKEN}`,
            "Accept": "application/json"
          }
        });

        if (sampleResponse.ok) {
          const sampleData = await sampleResponse.json();
          
          if (sampleData.value && sampleData.value.length > 0) {
            sampleData.value.forEach((prop, idx) => {
              console.log(`\nProperty ${idx + 1}:`);
              console.log(`  Address: ${prop.StreetNumber} ${prop.StreetName}, ${prop.City}`);
              console.log(`  Status: ${prop.StandardStatus}`);
              console.log(`  Price: $${(prop.ListPrice || prop.ClosePrice || 0).toLocaleString()}`);
              console.log(`  Beds: ${prop.BedroomsTotal || "N/A"} | Baths: ${prop.BathroomsTotalInteger || "N/A"} | Sqft: ${(prop.LivingArea || "N/A").toLocaleString()}`);
            });
          }
        }
      } catch (error) {
        console.log("Could not fetch samples");
      }

      // Storage estimation
      console.log("\n\nStorage Estimation:");
      console.log("─".repeat(50));
      const sizeWithAllFields = (totalCount * 10000) / (1024 * 1024);
      const sizeWithMinimalFields = (totalCount * 500) / (1024 * 1024);
      console.log(`  All 389 fields : ${sizeWithAllFields.toFixed(1)} MB`);
      console.log(`  15 key fields  : ${sizeWithMinimalFields.toFixed(1)} MB`);
      console.log(`  localStorage   : 5-10 MB limit`);
      
      if (sizeWithAllFields > 10) {
        console.log(`\n  WARNING: All fields won't fit in localStorage!`);
        console.log(`  SOLUTION: Use 15 key fields (${sizeWithMinimalFields.toFixed(1)} MB)`);
      } else {
        console.log(`\n  OK: Fits in localStorage with all fields!`);
      }
    }

    console.log("\n" + "═".repeat(51) + "\n");

  } catch (error) {
    console.error("Error:", error.message);
  }
}

testSingleFamilyResidences();
