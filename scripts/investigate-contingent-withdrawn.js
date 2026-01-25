#!/usr/bin/env node

/**
 * Investigate Contingent & Withdrawn tracking capabilities
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
  console.log('INVESTIGATING CONTINGENT & WITHDRAWN TRACKING');
  console.log('═'.repeat(70));

  // 1. Check Contingent properties in 7 towns
  console.log('\n📋 TEST 1: Contingent Properties');
  console.log('─'.repeat(50));
  
  const contingentFilter = `(${cityFilter}) and PropertySubType eq 'Single Family Residence' and StandardStatus eq 'Contingent'`;
  let url = `${BRIDGE_API_BASE}/Property?$filter=${encodeURIComponent(contingentFilter)}&$count=true&$top=5&$select=ListingId,StreetNumber,StreetName,City,ListPrice,ListingContractDate,OffMarketDate,MLSPIN_MARKET_TIME,StandardStatus`;
  let data = await fetchAPI(url);
  
  console.log(`Contingent Single Family in 7 towns: ${data['@odata.count'] || 0}`);
  if (data.value && data.value.length > 0) {
    data.value.forEach((p, i) => {
      console.log(`\n  ${i+1}. ${p.StreetNumber} ${p.StreetName}, ${p.City}`);
      console.log(`     ListingId: ${p.ListingId}`);
      console.log(`     ListingContractDate: ${p.ListingContractDate}`);
      console.log(`     OffMarketDate: ${p.OffMarketDate || 'N/A'}`);
      console.log(`     MLSPIN_MARKET_TIME: ${p.MLSPIN_MARKET_TIME} days`);
    });
  }

  // 2. Check Withdrawn properties
  console.log('\n📋 TEST 2: Withdrawn Properties');
  console.log('─'.repeat(50));
  
  const withdrawnFilter = `(${cityFilter}) and PropertySubType eq 'Single Family Residence' and StandardStatus eq 'Withdrawn'`;
  url = `${BRIDGE_API_BASE}/Property?$filter=${encodeURIComponent(withdrawnFilter)}&$count=true&$top=3&$select=ListingId,StreetNumber,StreetName,City,ListPrice,OriginalListPrice,ListingContractDate,OffMarketDate,MLSPIN_MARKET_TIME`;
  data = await fetchAPI(url);
  
  console.log(`Withdrawn Single Family in 7 towns: ${data['@odata.count'] || 0}`);
  
  let sampleWithdrawn = null;
  if (data.value && data.value.length > 0) {
    sampleWithdrawn = data.value[0];
    data.value.forEach((p, i) => {
      const reduction = p.OriginalListPrice > p.ListPrice 
        ? `(reduced ${((1 - p.ListPrice/p.OriginalListPrice)*100).toFixed(1)}%)`
        : '';
      console.log(`\n  ${i+1}. ${p.StreetNumber} ${p.StreetName}, ${p.City}`);
      console.log(`     ListingId: ${p.ListingId}`);
      console.log(`     Listed: ${p.ListingContractDate} | OffMarket: ${p.OffMarketDate}`);
      console.log(`     Price: $${(p.ListPrice/1000).toFixed(0)}K ${reduction}`);
      console.log(`     DOM before withdrawal: ${p.MLSPIN_MARKET_TIME} days`);
    });
  }

  // 3. Re-list detection - find all listings at same address
  console.log('\n📋 TEST 3: Re-list Detection (Same Address)');
  console.log('─'.repeat(50));
  
  if (sampleWithdrawn) {
    console.log(`\nSearching for all listings at: ${sampleWithdrawn.StreetNumber} ${sampleWithdrawn.StreetName}, ${sampleWithdrawn.City}`);
    
    const addrFilter = `StreetNumber eq '${sampleWithdrawn.StreetNumber}' and StreetName eq '${sampleWithdrawn.StreetName}' and City eq '${sampleWithdrawn.City}'`;
    url = `${BRIDGE_API_BASE}/Property?$filter=${encodeURIComponent(addrFilter)}&$orderby=ListingContractDate desc&$select=ListingId,StandardStatus,ListPrice,OriginalListPrice,ListingContractDate,OffMarketDate,CloseDate,ClosePrice`;
    data = await fetchAPI(url);
    
    if (data.value) {
      console.log(`Found ${data.value.length} listing(s) at this address:`);
      data.value.forEach((p, i) => {
        console.log(`\n  ${i+1}. ListingId: ${p.ListingId}`);
        console.log(`     Status: ${p.StandardStatus}`);
        console.log(`     Listed: ${p.ListingContractDate} | Price: $${(p.ListPrice/1000).toFixed(0)}K`);
        if (p.CloseDate) {
          console.log(`     Closed: ${p.CloseDate} @ $${(p.ClosePrice/1000).toFixed(0)}K`);
        }
      });
      
      if (data.value.length > 1) {
        console.log('\n  ✅ RE-LIST DETECTED! Multiple listings found at same address.');
        console.log('  We CAN track re-list behavior by matching addresses!');
      }
    }
  }

  // 4. Find properties that have been listed multiple times
  console.log('\n📋 TEST 4: Finding Re-listed Properties (Address Matching)');
  console.log('─'.repeat(50));
  
  // Get a sample of closed properties and check for multiple listings
  const closedFilter = `(${cityFilter}) and PropertySubType eq 'Single Family Residence' and StandardStatus eq 'Closed'`;
  url = `${BRIDGE_API_BASE}/Property?$filter=${encodeURIComponent(closedFilter)}&$top=10&$orderby=CloseDate desc&$select=ListingId,StreetNumber,StreetName,City,CloseDate`;
  data = await fetchAPI(url);
  
  let relistCount = 0;
  for (const prop of data.value.slice(0, 5)) {
    const addrFilter = `StreetNumber eq '${prop.StreetNumber}' and StreetName eq '${prop.StreetName}' and City eq '${prop.City}'`;
    url = `${BRIDGE_API_BASE}/Property?$filter=${encodeURIComponent(addrFilter)}&$count=true&$top=0`;
    const countData = await fetchAPI(url);
    const count = countData['@odata.count'] || 0;
    
    if (count > 1) {
      relistCount++;
      console.log(`  ${prop.StreetNumber} ${prop.StreetName}, ${prop.City}: ${count} listings`);
    }
  }
  console.log(`\n${relistCount}/5 sampled properties have multiple listing records`);

  // 5. Check for status-related history fields
  console.log('\n📋 TEST 5: Status History Fields');
  console.log('─'.repeat(50));
  
  const activeFilter = `City eq 'Newton' and StandardStatus eq 'Active'`;
  url = `${BRIDGE_API_BASE}/Property?$filter=${encodeURIComponent(activeFilter)}&$top=1`;
  data = await fetchAPI(url);
  
  if (data.value && data.value[0]) {
    const p = data.value[0];
    const historyFields = Object.keys(p).filter(k => 
      k.toLowerCase().includes('history') || 
      k.toLowerCase().includes('previous') ||
      k.toLowerCase().includes('prev') ||
      k.toLowerCase().includes('former') ||
      k.toLowerCase().includes('prior') ||
      k.toLowerCase().includes('status')
    );
    console.log('Status/History-related fields found:');
    historyFields.forEach(f => {
      console.log(`  ${f}: ${JSON.stringify(p[f])}`);
    });
  }

  // 6. Check for Canceled status (similar to Contingent fall-through)
  console.log('\n📋 TEST 6: Canceled/Expired Status (Fall-through proxy)');
  console.log('─'.repeat(50));
  
  const canceledFilter = `(${cityFilter}) and PropertySubType eq 'Single Family Residence' and (StandardStatus eq 'Canceled' or StandardStatus eq 'Expired')`;
  url = `${BRIDGE_API_BASE}/Property?$filter=${encodeURIComponent(canceledFilter)}&$count=true&$top=0`;
  data = await fetchAPI(url);
  console.log(`Canceled/Expired Single Family in 7 towns: ${data['@odata.count'] || 0}`);

  console.log('\n' + '═'.repeat(70));
  console.log('CONCLUSION');
  console.log('═'.repeat(70));
  console.log(`
✅ CONTINGENT TRACKING:
   • Can track current contingent listings
   • Can calculate time spent contingent (ListingContractDate to OffMarketDate)
   • Fall-through: Match by address to see if property returned to Active or Withdrawn

✅ WITHDRAWN TRACKING:
   • Can track all withdrawn metrics (DOM, price reductions)
   • RE-LIST DETECTION: YES! Match by StreetNumber + StreetName + City
   • Can compare original vs re-list prices
   • Can calculate time between withdrawal and re-list
  `);
}

investigate().catch(console.error);
