#!/usr/bin/env node

/**
 * Find the actual PropertySubType value for single-family homes
 * in the 7 target towns
 */

const BRIDGE_API_BASE = "https://api.bridgedataoutput.com/api/v2/OData/shared_mlspin_0705dd4";
const BRIDGE_API_TOKEN = "725919c8f3653746355154239821a3b1";

const TOWNS = ["Weston", "Wellesley", "Newton", "Needham", "Dover", "Natick", "Westwood"];

async function findPropertySubTypes() {
  console.log("\n═════════════════════════════════════════════════════");
  console.log("FINDING SINGLE-FAMILY HOME PropertySubType VALUES");
  console.log("═════════════════════════════════════════════════════\n");

  const cityFilter = TOWNS.map(town => `City eq '${town}'`).join(" or ");
  const filter = `(${cityFilter}) and PropertyType eq 'Residential'`;

  const url = `${BRIDGE_API_BASE}/Property?$filter=${encodeURIComponent(filter)}&$select=PropertySubType,City,StreetName,ListPrice&$top=100`;

  try {
    console.log("Fetching residential properties from 7 towns...\n");
    
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
      console.log("No properties found!");
      return;
    }

    // Collect all PropertySubType values
    const subtypes = new Map();
    
    properties.forEach(prop => {
      const subtype = prop.PropertySubType || "Unknown";
      if (!subtypes.has(subtype)) {
        subtypes.set(subtype, []);
      }
      subtypes.get(subtype).push({
        city: prop.City,
        street: prop.StreetName,
        price: prop.ListPrice
      });
    });

    console.log(`Found ${properties.length} residential properties in 7 towns\n`);
    console.log("Property SubTypes Distribution:\n");

    // Sort by count (descending)
    const sorted = Array.from(subtypes.entries()).sort((a, b) => b[1].length - a[1].length);

    sorted.forEach(([subtype, props]) => {
      console.log(`\n${subtype}: ${props.length} properties`);
      console.log("─".repeat(50));
      props.slice(0, 3).forEach(prop => {
        console.log(`  ${prop.street}, ${prop.city} - $${(prop.price || 0).toLocaleString()}`);
      });
      if (props.length > 3) {
        console.log(`  ... and ${props.length - 3} more`);
      }
    });

    console.log("\n\n📋 RECOMMENDATION:");
    console.log("─".repeat(50));
    
    const mostCommon = sorted[0];
    if (mostCommon) {
      console.log(`\nThe most common subtype is: "${mostCommon[0]}" (${mostCommon[1].length} properties)`);
      console.log(`\nUse this filter for single-family homes:`);
      console.log(`  PropertySubType eq '${mostCommon[0]}'`);
    }

    // Show if "Single Family" exists
    const singleFamily = subtypes.get("Single Family");
    if (singleFamily) {
      console.log(`\n\nNote: "Single Family" exists with ${singleFamily.length} properties`);
    } else {
      console.log(`\nNote: "Single Family" does NOT exist in this data`);
      console.log("Use the PropertySubType value shown above instead.");
    }

    console.log("\n" + "═".repeat(51) + "\n");

  } catch (error) {
    console.error("Error:", error.message);
  }
}

findPropertySubTypes();
