#!/usr/bin/env node

/**
 * Investigate Contingent Fall-Through Detection
 * 
 * A "fall-through" occurs when a property goes from Contingent back to Active/Withdrawn
 * We can detect this by finding properties with multiple status changes
 */

const BRIDGE_API_BASE = "https://api.bridgedataoutput.com/api/v2/OData/shared_mlspin_0705dd4";
const BRIDGE_API_TOKEN = "725919c8f3653746355154239821a3b1";

const TOWNS = ["Weston", "Wellesley", "Newton", "Needham", "Dover", "Natick", "Westwood"];
const cityFilter = TOWNS.map(town => `City eq '${town}'`).join(" or ");

async function fetchAPI(url) {
  const response = await fetch(url, {
    headers: { "Authorization": `Bearer ${BRIDGE_API_TOKEN}` }
  });
  return response.json();
}

async function investigate() {
  console.log('═'.repeat(70));
  console.log('INVESTIGATING CONTINGENT FALL-THROUGH DETECTION');
  console.log('═'.repeat(70));

  // Strategy: Find properties that have multiple listings in close succession
  // where one listing went from Active -> OffMarket (Contingent) -> back to Active
  
  // First, let's look at Canceled/Expired listings - these might indicate fall-throughs
  console.log('\n📋 TEST 1: Recent Canceled/Expired (potential fall-throughs)');
  console.log('─'.repeat(50));
  
  const canceledFilter = `(${cityFilter}) and PropertySubType eq 'Single Family Residence' and (StandardStatus eq 'Canceled' or StandardStatus eq 'Expired')`;
  let url = `${BRIDGE_API_BASE}/Property?$filter=${encodeURIComponent(canceledFilter)}&$top=5&$orderby=OffMarketDate desc&$select=ListingId,StreetNumber,StreetName,City,StandardStatus,ListingContractDate,OffMarketDate,MLSPIN_MARKET_TIME,ListPrice`;
  let data = await fetchAPI(url);
  
  console.log(`Found ${data.value?.length || 0} Canceled/Expired listings\n`);
  
  // Check if any of these were re-listed as Active
  for (const p of data.value || []) {
    console.log(`${p.StreetNumber} ${p.StreetName}, ${p.City}`);
    console.log(`  Status: ${p.StandardStatus} (expired: ${p.OffMarketDate})`);
    
    // Search for other listings at same address
    const addrFilter = `StreetNumber eq '${p.StreetNumber}' and StreetName eq '${p.StreetName}' and City eq '${p.City}'`;
    const addrUrl = `${BRIDGE_API_BASE}/Property?$filter=${encodeURIComponent(addrFilter)}&$select=ListingId,StandardStatus,ListingContractDate,OffMarketDate&$orderby=ListingContractDate desc`;
    const addrData = await fetchAPI(addrUrl);
    
    if (addrData.value && addrData.value.length > 1) {
      console.log(`  ⚠️ Found ${addrData.value.length} listings at this address:`);
      addrData.value.forEach((listing, i) => {
        console.log(`    ${i+1}. ${listing.StandardStatus} (listed: ${listing.ListingContractDate})`);
      });
    }
    console.log('');
  }

  // Now let's check the MLSPIN_PREV_MARKET_TIME field - this might indicate previous listing attempts
  console.log('\n📋 TEST 2: Properties with MLSPIN_PREV_MARKET_TIME > 0');
  console.log('─'.repeat(50));
  
  const prevTimeFilter = `(${cityFilter}) and PropertySubType eq 'Single Family Residence' and MLSPIN_PREV_MARKET_TIME gt 0`;
  url = `${BRIDGE_API_BASE}/Property?$filter=${encodeURIComponent(prevTimeFilter)}&$count=true&$top=5&$select=ListingId,StreetNumber,StreetName,City,StandardStatus,MLSPIN_MARKET_TIME,MLSPIN_PREV_MARKET_TIME,MLSPIN_MARKET_TIME_PROPERTY,MLSPIN_MARKET_TIME_PROPERTY_PREV`;
  data = await fetchAPI(url);
  
  console.log(`Properties with MLSPIN_PREV_MARKET_TIME > 0: ${data['@odata.count'] || 0}\n`);
  
  if (data.value) {
    data.value.forEach((p, i) => {
      console.log(`${i+1}. ${p.StreetNumber} ${p.StreetName}, ${p.City} (${p.StandardStatus})`);
      console.log(`   MLSPIN_MARKET_TIME: ${p.MLSPIN_MARKET_TIME} days`);
      console.log(`   MLSPIN_PREV_MARKET_TIME: ${p.MLSPIN_PREV_MARKET_TIME} days`);
      console.log(`   MLSPIN_MARKET_TIME_PROPERTY: ${p.MLSPIN_MARKET_TIME_PROPERTY} days`);
      console.log(`   MLSPIN_MARKET_TIME_PROPERTY_PREV: ${p.MLSPIN_MARKET_TIME_PROPERTY_PREV} days`);
      console.log('');
    });
  }

  // Check what the MLSPIN_MARKET_TIME_BROKER fields mean
  console.log('\n📋 TEST 3: Understanding Market Time Fields');
  console.log('─'.repeat(50));
  
  const activeFilter = `(${cityFilter}) and PropertySubType eq 'Single Family Residence' and StandardStatus eq 'Active'`;
  url = `${BRIDGE_API_BASE}/Property?$filter=${encodeURIComponent(activeFilter)}&$top=3&$select=ListingId,StreetName,City,MLSPIN_MARKET_TIME,MLSPIN_MARKET_TIME_BROKER,MLSPIN_MARKET_TIME_BROKER_PREV,MLSPIN_MARKET_TIME_PROPERTY,MLSPIN_MARKET_TIME_PROPERTY_PREV`;
  data = await fetchAPI(url);
  
  console.log('Active listings with all market time fields:\n');
  if (data.value) {
    data.value.forEach((p, i) => {
      console.log(`${i+1}. ${p.StreetName}, ${p.City}`);
      console.log(`   MLSPIN_MARKET_TIME: ${p.MLSPIN_MARKET_TIME}`);
      console.log(`   MLSPIN_MARKET_TIME_BROKER: ${p.MLSPIN_MARKET_TIME_BROKER}`);
      console.log(`   MLSPIN_MARKET_TIME_BROKER_PREV: ${p.MLSPIN_MARKET_TIME_BROKER_PREV}`);
      console.log(`   MLSPIN_MARKET_TIME_PROPERTY: ${p.MLSPIN_MARKET_TIME_PROPERTY}`);
      console.log(`   MLSPIN_MARKET_TIME_PROPERTY_PREV: ${p.MLSPIN_MARKET_TIME_PROPERTY_PREV}`);
      console.log('');
    });
  }

  console.log('\n' + '═'.repeat(70));
  console.log('FALL-THROUGH DETECTION STRATEGIES');
  console.log('═'.repeat(70));
  console.log(`
Method 1: Address Matching
  • Find properties with multiple listings in same year
  • Track status progression: Active → Contingent → Canceled/Withdrawn → Active
  • ✅ FULLY POSSIBLE

Method 2: MLSPIN_PREV_MARKET_TIME
  • This field tracks previous marketing time
  • If > 0, property was previously listed
  • ✅ AVAILABLE (need to verify exact meaning)

Method 3: MLSPIN_MARKET_TIME_PROPERTY vs MLSPIN_MARKET_TIME_BROKER
  • PROPERTY time = total time across all brokers
  • BROKER time = time with current broker
  • Difference indicates property was re-listed
  • ✅ AVAILABLE

Conclusion: Contingent fall-through CAN be tracked via:
  1. Multiple listings at same address with status progression
  2. MLSPIN_PREV_MARKET_TIME > 0 indicates previous listing attempt
  3. Canceled/Expired status indicates deal fell through
  `);
}

investigate().catch(console.error);
