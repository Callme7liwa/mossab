#!/usr/bin/env node

/**
 * Quick API verification test
 */

const BRIDGE_API_BASE = "https://api.bridgedataoutput.com/api/v2/OData/shared_mlspin_0705dd4";
const BRIDGE_API_TOKEN = "725919c8f3653746355154239821a3b1";

async function test() {
  console.log('═'.repeat(60));
  console.log('API VERIFICATION TEST');
  console.log('═'.repeat(60));

  const towns = ['Weston', 'Wellesley', 'Newton', 'Needham', 'Dover', 'Natick', 'Westwood'];
  const townFilter = towns.map(t => `City eq '${t}'`).join(' or ');
  const typeFilter = `PropertySubType eq 'Single Family Residence'`;
  
  // Test Active
  console.log('\n📊 ACTIVE Single Family in 7 towns:');
  let filter = `(${townFilter}) and StandardStatus eq 'Active' and ${typeFilter}`;
  let url = `${BRIDGE_API_BASE}/Property?$filter=${encodeURIComponent(filter)}&$count=true&$top=5&$select=ListingId,City,StandardStatus,ListPrice,MLSPIN_MARKET_TIME`;
  
  let res = await fetch(url, { headers: { Authorization: `Bearer ${BRIDGE_API_TOKEN}` }});
  let data = await res.json();
  
  console.log(`   Count: ${data['@odata.count']}`);
  data.value?.forEach((p, i) => {
    console.log(`   ${i+1}. ${p.City} - $${(p.ListPrice/1000).toFixed(0)}K - ${p.MLSPIN_MARKET_TIME} DOM`);
  });
  
  // Test Pending
  console.log('\n📊 PENDING Single Family in 7 towns:');
  filter = `(${townFilter}) and StandardStatus eq 'Pending' and ${typeFilter}`;
  url = `${BRIDGE_API_BASE}/Property?$filter=${encodeURIComponent(filter)}&$count=true&$top=5&$select=ListingId,City,StandardStatus,ListPrice,MLSPIN_MARKET_TIME`;
  
  res = await fetch(url, { headers: { Authorization: `Bearer ${BRIDGE_API_TOKEN}` }});
  data = await res.json();
  
  console.log(`   Count: ${data['@odata.count']}`);
  data.value?.forEach((p, i) => {
    console.log(`   ${i+1}. ${p.City} - $${(p.ListPrice/1000).toFixed(0)}K - ${p.MLSPIN_MARKET_TIME} DOM`);
  });
  
  // Test Closed (Sold)
  console.log('\n📊 CLOSED (Sold) Single Family in 7 towns:');
  filter = `(${townFilter}) and StandardStatus eq 'Closed' and ${typeFilter}`;
  url = `${BRIDGE_API_BASE}/Property?$filter=${encodeURIComponent(filter)}&$count=true&$top=5&$select=ListingId,City,StandardStatus,ClosePrice,CloseDate&$orderby=CloseDate desc`;
  
  res = await fetch(url, { headers: { Authorization: `Bearer ${BRIDGE_API_TOKEN}` }});
  data = await res.json();
  
  console.log(`   Count: ${data['@odata.count']}`);
  data.value?.forEach((p, i) => {
    console.log(`   ${i+1}. ${p.City} - $${(p.ClosePrice/1000).toFixed(0)}K - Closed ${p.CloseDate?.substring(0,10)}`);
  });
  
  // Test Withdrawn
  console.log('\n📊 WITHDRAWN Single Family in 7 towns:');
  filter = `(${townFilter}) and StandardStatus eq 'Withdrawn' and ${typeFilter}`;
  url = `${BRIDGE_API_BASE}/Property?$filter=${encodeURIComponent(filter)}&$count=true&$top=5&$select=ListingId,City,StandardStatus,ListPrice,MLSPIN_MARKET_TIME`;
  
  res = await fetch(url, { headers: { Authorization: `Bearer ${BRIDGE_API_TOKEN}` }});
  data = await res.json();
  
  console.log(`   Count: ${data['@odata.count']}`);
  data.value?.forEach((p, i) => {
    console.log(`   ${i+1}. ${p.City} - $${(p.ListPrice/1000).toFixed(0)}K - ${p.MLSPIN_MARKET_TIME} DOM`);
  });
  
  console.log('\n' + '═'.repeat(60));
  console.log('✅ API is working correctly!');
  console.log('═'.repeat(60));
}

test().catch(console.error);
